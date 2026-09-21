// WebRTC mesh manager — Supabase Realtime channel edition
// Replaces Socket.io with Supabase broadcast events for signaling

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
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
    this._setupChannelListeners();
  }

  // ── Listen for WebRTC signals via Supabase broadcast ──────────────────────
  _setupChannelListeners() {
    this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      // Only process signals addressed to this user
      if (!payload || payload.to !== this.userId) return;
      const { type, from, data } = payload;

      switch (type) {
        case 'offer':  this._handleOffer(from, data);  break;
        case 'answer': this._handleAnswer(from, data); break;
        case 'ice':    this._handleIce(from, data);    break;
        default: break;
      }
    });
  }

  // ── Send a WebRTC signal via Supabase broadcast ───────────────────────────
  _sendSignal(to, type, data) {
    this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: { type, from: this.userId, to, data },
    });
  }

  // ── Create RTCPeerConnection for a given peer ─────────────────────────────
  _createPeerConnection(peerId) {
    // Close any stale connection first
    if (this.peers[peerId]) {
      this.peers[peerId].close();
      delete this.peers[peerId];
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendSignal(peerId, 'ice', event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      // Use the first stream if available, otherwise wrap the tracks
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.onRemoteStream(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] ${peerId.slice(0,8)} → ${pc.connectionState}`);
      if (['failed', 'disconnected'].includes(pc.connectionState)) {
        // Attempt an ICE restart before giving up
        if (pc.restartIce) pc.restartIce();
      }
      if (pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE ${peerId.slice(0,8)} → ${pc.iceConnectionState}`);
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

  // ── Initiate call to a new peer (called on presence join by smaller userId) ─
  async initiateCall(peerId) {
    if (this.peers[peerId]) return; // already have a connection
    try {
      const pc    = this._createPeerConnection(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      this._sendSignal(peerId, 'offer', { type: offer.type, sdp: offer.sdp });
    } catch (err) {
      console.error('[WebRTC] initiateCall error:', err);
    }
  }

  // ── Handle incoming offer from a peer ────────────────────────────────────
  async _handleOffer(from, offer) {
    try {
      // Close any existing connection for this peer (clean restart)
      const pc = this._createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush any buffered ICE candidates
      if (this._pendingCandidates[from]) {
        for (const candidate of this._pendingCandidates[from]) {
          await pc.addIceCandidate(candidate).catch(() => {});
        }
        delete this._pendingCandidates[from];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this._sendSignal(from, 'answer', { type: answer.type, sdp: answer.sdp });
    } catch (err) {
      console.error('[WebRTC] _handleOffer error:', err);
    }
  }

  // ── Handle incoming answer ────────────────────────────────────────────────
  async _handleAnswer(from, answer) {
    const pc = this.peers[from];
    if (!pc) return;
    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        // Flush buffered ICE candidates
        if (this._pendingCandidates[from]) {
          for (const candidate of this._pendingCandidates[from]) {
            await pc.addIceCandidate(candidate).catch(() => {});
          }
          delete this._pendingCandidates[from];
        }
      }
    } catch (err) {
      console.error('[WebRTC] _handleAnswer error:', err);
    }
  }

  // ── Handle incoming ICE candidate ─────────────────────────────────────────
  async _handleIce(from, candidateData) {
    const pc = this.peers[from];
    if (!pc || !candidateData) return;
    const candidate = new RTCIceCandidate(candidateData);
    if (pc.remoteDescription) {
      await pc.addIceCandidate(candidate).catch(() => {});
    } else {
      // Remote description not set yet — buffer the candidate
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
      this.onRemoteStreamRemoved(peerId);
    }
  }

  // ── Remove all peers (on leave/end) ──────────────────────────────────────
  removeAllPeers() {
    Object.keys(this.peers).forEach((id) => this.removePeer(id));
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
