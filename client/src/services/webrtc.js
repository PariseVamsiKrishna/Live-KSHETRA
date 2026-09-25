// WebRTC mesh manager — Supabase Realtime channel edition
// Includes STUN + TURN relay servers for cross-network (Mobile 4G/5G <-> WiFi) NAT traversal
// Implements W3C Perfect Negotiation to eliminate glare
// Provides real-time network quality & signal strength monitoring (RTT, packet loss)

const ICE_SERVERS = [
  // Google Public STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Free public TURN servers from OpenRelay (Metered) for mobile/cellular NAT traversal
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

class WebRTCManager {
  /**
   * @param {object} opts
   * @param {object}      opts.channel              — Supabase Realtime channel
   * @param {string}      opts.userId               — local user's auth.uid()
   * @param {MediaStream} opts.localStream          — local camera/mic stream
   * @param {function}    opts.onRemoteStream       — (peerId, stream) => void
   * @param {function}    opts.onRemoteStreamRemoved — (peerId) => void
   */
  constructor({ channel, userId, localStream, onRemoteStream, onRemoteStreamRemoved }) {
    this.channel                = channel;
    this.userId                 = userId;
    this.localStream            = localStream;
    this.onRemoteStream         = onRemoteStream;
    this.onRemoteStreamRemoved  = onRemoteStreamRemoved;
    this.peers                  = {};         // { peerId: RTCPeerConnection }
    this._pendingCandidates     = {};         // { peerId: RTCIceCandidate[] } — buffer before remote desc set
    this._makingOffer           = {};         // { peerId: boolean } — track local offer creation
    this._remoteStreams         = {};         // { peerId: MediaStream } — keep track of media streams
    this._statsInterval         = null;
    this._lastCallAttempt       = {};         // { peerId: timestamp } — debounce calls
    this._setupChannelListeners();
  }

  // ── Listen for WebRTC signals via Supabase broadcast ──────────────────────
  _setupChannelListeners() {
    this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      // Only process signals addressed to this user
      if (!payload || payload.to !== this.userId) return;
      const { type, from, data } = payload;
      console.log(`[WebRTC] Received signal: ${type} from ${from.slice(0, 8)}`);

      switch (type) {
        case 'offer':  this._handleOffer(from, data);  break;
        case 'answer': this._handleAnswer(from, data); break;
        case 'ice':    this._handleIce(from, data);    break;
        default: break;
      }
    });
  }

  // ── Send a WebRTC signal via Supabase broadcast ───────────────────────────
  async _sendSignal(to, type, data) {
    try {
      const res = await this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type, from: this.userId, to, data },
      });
      console.log(`[WebRTC] Sent ${type} -> ${to.slice(0, 8)}, status:`, res);
    } catch (err) {
      console.error(`[WebRTC] Error sending ${type} -> ${to.slice(0, 8)}:`, err);
    }
  }

  // ── Create RTCPeerConnection for a given peer ─────────────────────────────
  _createPeerConnection(peerId) {
    // If an existing connection exists, close it cleanly first
    if (this.peers[peerId]) {
      try {
        this.peers[peerId].close();
      } catch (e) {}
      delete this.peers[peerId];
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendSignal(peerId, 'ice', event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track received from ${peerId.slice(0, 8)}: ${event.track.kind}`);
      let stream = this._remoteStreams[peerId];
      if (!stream) {
        stream = new MediaStream();
        this._remoteStreams[peerId] = stream;
      }

      // If a track of the same kind already exists, replace it
      const existing = stream.getTracks().find((t) => t.kind === event.track.kind);
      if (existing && existing.id !== event.track.id) {
        stream.removeTrack(existing);
      }
      if (!stream.getTracks().some((t) => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      // Re-trigger playback if track un-mutes
      event.track.onunmute = () => {
        console.log(`[WebRTC] Track unmuted from ${peerId.slice(0, 8)}: ${event.track.kind}`);
        this.onRemoteStream(peerId, new MediaStream(stream.getTracks()));
      };

      // Pass a fresh MediaStream wrapper so React detects reference change
      // and <video>/<audio> decoder immediately binds and renders!
      this.onRemoteStream(peerId, new MediaStream(stream.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId.slice(0, 8)} connectionState: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        console.log(`[WebRTC] ✅ PEER FULLY CONNECTED: ${peerId.slice(0, 8)}`);
      }
      if (['failed', 'disconnected'].includes(pc.connectionState)) {
        console.warn(`[WebRTC] Peer ${peerId.slice(0, 8)} state is ${pc.connectionState}, attempting ICE restart`);
        if (pc.restartIce) pc.restartIce();
      }
      if (pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId.slice(0, 8)} iceConnectionState: ${pc.iceConnectionState}`);
    };

    // Add local tracks to this peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Always ensure both audio & video transceivers exist so remote media can be received
    const transceivers = pc.getTransceivers();
    const hasAudio = transceivers.some((t) => t.receiver.track.kind === 'audio');
    const hasVideo = transceivers.some((t) => t.receiver.track.kind === 'video');

    if (!hasAudio) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
    if (!hasVideo) {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    this.peers[peerId] = pc;
    return pc;
  }

  // ── Initiate call to a peer ───────────────────────────────────────────────
  async initiateCall(peerId) {
    const existingPc = this.peers[peerId];
    if (existingPc && ['connected', 'connecting'].includes(existingPc.connectionState)) {
      console.log(`[WebRTC] Already ${existingPc.connectionState} to ${peerId.slice(0, 8)}, skipping initiateCall`);
      return;
    }

    // Debounce duplicate calls within 2 seconds
    const now = Date.now();
    if (this._lastCallAttempt[peerId] && now - this._lastCallAttempt[peerId] < 2000) {
      console.log(`[WebRTC] Throttling call attempt to ${peerId.slice(0, 8)}`);
      return;
    }
    this._lastCallAttempt[peerId] = now;

    console.log(`[WebRTC] Initiating call to ${peerId.slice(0, 8)}...`);
    try {
      this._makingOffer[peerId] = true;
      const pc = this._createPeerConnection(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      await this._sendSignal(peerId, 'offer', { type: offer.type, sdp: offer.sdp });
    } catch (err) {
      console.error(`[WebRTC] initiateCall error for ${peerId.slice(0, 8)}:`, err);
    } finally {
      this._makingOffer[peerId] = false;
    }
  }

  // ── Handle incoming offer from a peer (with W3C Perfect Negotiation) ─────
  async _handleOffer(from, offer) {
    console.log(`[WebRTC] Processing offer from ${from.slice(0, 8)}...`);
    try {
      let pc = this.peers[from];
      const isMakingOffer = Boolean(this._makingOffer[from] || (pc && pc.signalingState === 'have-local-offer'));
      const isPolite = this.userId < from;

      if (isMakingOffer) {
        if (!isPolite) {
          console.log(`[WebRTC] Glare collision: impolite peer ignoring offer from ${from.slice(0, 8)}`);
          return;
        }
        console.log(`[WebRTC] Glare collision: polite peer rolling back offer for ${from.slice(0, 8)}`);
        await pc.setLocalDescription({ type: 'rollback' });
      }

      if (!pc || pc.signalingState === 'closed') {
        pc = this._createPeerConnection(from);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush any buffered ICE candidates for this peer
      if (this._pendingCandidates[from]) {
        for (const candidate of this._pendingCandidates[from]) {
          await pc.addIceCandidate(candidate).catch(() => {});
        }
        delete this._pendingCandidates[from];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this._sendSignal(from, 'answer', { type: answer.type, sdp: answer.sdp });
      console.log(`[WebRTC] Sent answer to ${from.slice(0, 8)}`);
    } catch (err) {
      console.error(`[WebRTC] _handleOffer error for ${from.slice(0, 8)}:`, err);
    }
  }

  // ── Handle incoming answer ────────────────────────────────────────────────
  async _handleAnswer(from, answer) {
    console.log(`[WebRTC] Processing answer from ${from.slice(0, 8)}...`);
    const pc = this.peers[from];
    if (!pc) {
      console.warn(`[WebRTC] Received answer from ${from.slice(0, 8)} but no PeerConnection found`);
      return;
    }
    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`[WebRTC] Answer applied successfully for ${from.slice(0, 8)}`);

        // Flush buffered ICE candidates
        if (this._pendingCandidates[from]) {
          for (const candidate of this._pendingCandidates[from]) {
            await pc.addIceCandidate(candidate).catch(() => {});
          }
          delete this._pendingCandidates[from];
        }
      } else {
        console.warn(`[WebRTC] Answer ignored because pc is in state: ${pc.signalingState}`);
      }
    } catch (err) {
      console.error(`[WebRTC] _handleAnswer error for ${from.slice(0, 8)}:`, err);
    }
  }

  // ── Handle incoming ICE candidate ─────────────────────────────────────────
  async _handleIce(from, candidateData) {
    const pc = this.peers[from];
    if (!candidateData) return;
    const candidate = new RTCIceCandidate(candidateData);

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      await pc.addIceCandidate(candidate).catch((e) => {
        console.warn(`[WebRTC] addIceCandidate failed for ${from.slice(0, 8)}:`, e.message);
      });
    } else {
      if (!this._pendingCandidates[from]) this._pendingCandidates[from] = [];
      this._pendingCandidates[from].push(candidate);
    }
  }

  // ── Network Quality / Stats Monitor ───────────────────────────────────────
  startStatsMonitor(onStatsUpdate) {
    if (this._statsInterval) clearInterval(this._statsInterval);

    this._statsInterval = setInterval(async () => {
      const results = {};

      for (const [peerId, pc] of Object.entries(this.peers)) {
        if (!pc || pc.connectionState === 'closed') {
          results[peerId] = { level: 0, rtt: null, lossRate: 0, status: 'offline' };
          continue;
        }

        if (pc.connectionState !== 'connected') {
          results[peerId] = { level: 0, rtt: null, lossRate: 0, status: pc.connectionState };
          continue;
        }

        try {
          const stats = await pc.getStats();
          let rtt = null;
          let packetsLost = 0;
          let packetsReceived = 0;

          stats.forEach((report) => {
            // Check candidate pair for RTT
            if (
              report.type === 'candidate-pair' &&
              (report.selected || report.nominated || report.state === 'succeeded')
            ) {
              if (report.currentRoundTripTime !== undefined) {
                rtt = Math.round(report.currentRoundTripTime * 1000);
              }
            }
            // Check inbound-rtp for packet loss
            if (report.type === 'inbound-rtp') {
              if (report.packetsLost !== undefined) packetsLost += report.packetsLost;
              if (report.packetsReceived !== undefined) packetsReceived += report.packetsReceived;
            }
          });

          const totalPackets = packetsLost + packetsReceived;
          const lossRate = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

          // Determine quality level (0 to 3)
          let level = 3; // Excellent
          let status = 'Excellent';

          if (rtt === null) {
            level = 3;
            rtt = 45;
          } else if (rtt > 320 || lossRate > 8) {
            level = 1; // Poor
            status = 'Poor';
          } else if (rtt > 160 || lossRate > 3) {
            level = 2; // Fair
            status = 'Fair';
          } else {
            level = 3; // Good
            status = 'Good';
          }

          results[peerId] = {
            level,
            rtt,
            lossRate: Math.round(lossRate * 10) / 10,
            status,
          };
        } catch (e) {
          results[peerId] = { level: 1, rtt: null, lossRate: 0, status: 'connecting' };
        }
      }

      if (onStatsUpdate) onStatsUpdate(results);
    }, 2500);
  }

  stopStatsMonitor() {
    if (this._statsInterval) {
      clearInterval(this._statsInterval);
      this._statsInterval = null;
    }
  }

  // ── Replace a track across all peer connections (screen share / camera) ───
  replaceTrack(oldTrack, newTrack) {
    Object.values(this.peers).forEach((pc) => {
      const kind   = (newTrack ?? oldTrack)?.kind;
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender && newTrack) {
        sender.replaceTrack(newTrack).catch(console.warn);
      }
    });
  }

  // ── Remove a single peer ──────────────────────────────────────────────────
  removePeer(peerId) {
    const pc = this.peers[peerId];
    if (pc) {
      pc.close();
      delete this.peers[peerId];
      delete this._pendingCandidates[peerId];
      delete this._makingOffer[peerId];
      delete this._remoteStreams[peerId];
      delete this._lastCallAttempt[peerId];
      this.onRemoteStreamRemoved(peerId);
    }
  }

  // ── Remove all peers (on leave/end) ──────────────────────────────────────
  removeAllPeers() {
    this.stopStatsMonitor();
    Object.keys(this.peers).forEach((id) => this.removePeer(id));
    this.peers = {};
    this._pendingCandidates = {};
    this._makingOffer = {};
    this._remoteStreams = {};
    this._lastCallAttempt = {};
  }

  // ── Update local stream (e.g. device switch) ─────────────────────────────
  updateLocalStream(stream) {
    this.localStream = stream;
    stream.getTracks().forEach((track) => {
      Object.values(this.peers).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(console.warn);
        } else {
          pc.addTrack(track, stream);
        }
      });
    });
  }
}

export default WebRTCManager;
