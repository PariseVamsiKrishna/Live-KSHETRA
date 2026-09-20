// WebRTC mesh manager — Supabase Realtime channel edition
// Replaces Socket.io with Supabase broadcast events for signaling

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

class WebRTCManager {
  /**
   * @param {object} opts
   * @param {object}   opts.channel            — Supabase Realtime channel (already subscribed)
   * @param {string}   opts.userId             — local user's Supabase auth.uid()
   * @param {MediaStream} opts.localStream     — local camera/mic stream
   * @param {function} opts.onRemoteStream     — (peerId, stream) => void
   * @param {function} opts.onRemoteStreamRemoved — (peerId) => void
   */
  constructor({ channel, userId, localStream, onRemoteStream, onRemoteStreamRemoved }) {
    this.channel = channel;
    this.userId = userId;
    this.localStream = localStream;
    this.onRemoteStream = onRemoteStream;
    this.onRemoteStreamRemoved = onRemoteStreamRemoved;
    this.peers = {}; // { peerId: RTCPeerConnection }
    this._setupChannelListeners();
  }

  // ── Listen for WebRTC signals via Supabase broadcast ──────────────────────
  _setupChannelListeners() {
    this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      // Only process signals addressed to this user
      if (!payload || payload.to !== this.userId) return;

      const { type, from, data } = payload;
      if (type === 'offer') {
        this._handleOffer(from, data);
      } else if (type === 'answer') {
        const pc = this.peers[from];
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription(data)).catch(console.warn);
        }
      } else if (type === 'ice') {
        const pc = this.peers[from];
        if (pc && data) {
          pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
        }
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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendSignal(peerId, 'ice', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        this.onRemoteStream(peerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        this.removePeer(peerId);
      }
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

  // ── Initiate call to a new peer (called by presence join handler) ────────
  async initiateCall(peerId) {
    if (this.peers[peerId]) return; // already connected
    const pc = this._createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this._sendSignal(peerId, 'offer', offer);
  }

  // ── Handle incoming offer from a peer ─────────────────────────────────────
  async _handleOffer(from, offer) {
    const pc = this._createPeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this._sendSignal(from, 'answer', answer);
  }

  // ── Replace a track across all peer connections (screen share / camera) ──
  replaceTrack(oldTrack, newTrack) {
    Object.values(this.peers).forEach((pc) => {
      const kind = newTrack ? newTrack.kind : oldTrack?.kind;
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender && newTrack) {
        sender.replaceTrack(newTrack);
      }
    });
  }

  // ── Remove a single peer ─────────────────────────────────────────────────
  removePeer(peerId) {
    const pc = this.peers[peerId];
    if (pc) {
      pc.close();
      delete this.peers[peerId];
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
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      });
    });
  }
}

export default WebRTCManager;
