// WebRTC mesh manager — Supabase Realtime channel edition
// Includes STUN + free TURN relay servers for cross-network (Mobile 4G/5G <-> WiFi) NAT traversal
// Implements W3C Perfect Negotiation to completely eliminate glare/collisions

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
    this._remoteStreams         = {};         // { peerId: MediaStream } — keep stream reference
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
    // If an existing connection exists and is already connected, don't recreate
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
      // Reuse or create MediaStream for this peer
      let stream = this._remoteStreams[peerId];
      if (!stream) {
        stream = event.streams[0] || new MediaStream();
        this._remoteStreams[peerId] = stream;
      }
      if (!stream.getTracks().includes(event.track)) {
        stream.addTrack(event.track);
      }
      this.onRemoteStream(peerId, stream);
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

    this.peers[peerId] = pc;
    return pc;
  }

  // ── Initiate call to a peer ───────────────────────────────────────────────
  async initiateCall(peerId) {
    if (this.peers[peerId] && this.peers[peerId].connectionState === 'connected') {
      console.log(`[WebRTC] Already connected to ${peerId.slice(0, 8)}, skipping initiateCall`);
      return;
    }

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
      this.onRemoteStreamRemoved(peerId);
    }
  }

  // ── Remove all peers (on leave/end) ──────────────────────────────────────
  removeAllPeers() {
    Object.keys(this.peers).forEach((id) => this.removePeer(id));
    this.peers = {};
    this._pendingCandidates = {};
    this._makingOffer = {};
    this._remoteStreams = {};
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
