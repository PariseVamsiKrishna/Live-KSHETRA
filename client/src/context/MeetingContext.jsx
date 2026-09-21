import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import WebRTCManager from '../services/webrtc';
import { playJoin, playLeave, playHandRaise, playNotification } from '../services/audio';
import SpeechService from '../services/speech';
import MeetingRecorder from '../services/recorder';

const MeetingContext = createContext(null);

export function MeetingProvider({ children }) {
  // ── Supabase refs ────────────────────────────────────────────────────────────
  const channelRef   = useRef(null);   // Supabase Realtime private channel
  const myUserIdRef  = useRef(null);   // auth.uid() of local user
  const webrtcRef    = useRef(null);
  const speechRef    = useRef(null);
  const recorderRef  = useRef(null);

  // ── Local media ──────────────────────────────────────────────────────────────
  const [localStream, setLocalStream]   = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const localStreamRef = useRef(null);

  // ── Remote streams ───────────────────────────────────────────────────────────
  const [remoteStreams, setRemoteStreams] = useState({}); // { userId: MediaStream }

  // ── Meeting state ────────────────────────────────────────────────────────────
  const [view, setView]       = useState('landing'); // landing | lobby | meeting | waiting | error
  const [roomId, setRoomId]   = useState(null);
  const [localUser, setLocalUser] = useState({
    name: '', audioOn: true, videoOn: true,
    handRaised: false, screenSharing: false, isHost: false, backgroundBlur: false,
  });
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost]     = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Devices ──────────────────────────────────────────────────────────────────
  const [devices, setDevices]                 = useState({ audio: [], video: [] });
  const [selectedDevices, setSelectedDevices] = useState({ audioId: '', videoId: '' });

  // ── Panels ───────────────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState(null);

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadChat, setUnreadChat]     = useState(0);

  // ── Reactions ────────────────────────────────────────────────────────────────
  const [reactions, setReactions] = useState([]);

  // ── Captions ─────────────────────────────────────────────────────────────────
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captions, setCaptions]               = useState([]);
  const captionTimeoutRef = useRef(null);

  // ── Recording ────────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);

  // ── Lobby requests ───────────────────────────────────────────────────────────
  const [lobbyRequests, setLobbyRequests] = useState([]);

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [showLeaveModal, setShowLeaveModal]       = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // ── Pinned tile ──────────────────────────────────────────────────────────────
  const [pinnedId, setPinnedId] = useState(null);

  // ── Whiteboard ───────────────────────────────────────────────────────────────
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([]);

  // ── Speaker ──────────────────────────────────────────────────────────────────
  const [speakerId, setSpeakerId] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const enumerateDevices = useCallback(async () => {
    try {
      const list  = await navigator.mediaDevices.enumerateDevices();
      const audio = list.filter((d) => d.kind === 'audioinput');
      const video = list.filter((d) => d.kind === 'videoinput');
      setDevices({ audio, video });
      setSelectedDevices((prev) => ({
        audioId: prev.audioId || audio[0]?.deviceId || '',
        videoId: prev.videoId || video[0]?.deviceId || '',
      }));
    } catch (e) {
      console.warn('[Live Kshetra] Device enumeration failed:', e);
    }
  }, []);

  const getUserMedia = useCallback(async (audioId, videoId) => {
    const constraints = {
      audio: audioId ? { deviceId: { exact: audioId } } : true,
      video: videoId
        ? { deviceId: { exact: videoId }, width: 1280, height: 720 }
        : { width: 1280, height: 720 },
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      await enumerateDevices();
      return stream;
    } catch (_) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (e2) {
        console.error('[Live Kshetra] getUserMedia failed:', e2);
        return null;
      }
    }
  }, [enumerateDevices]);

  function generateRoomId() {
    const chars = 'abcdefghijkmnopqrstuvwxyz';
    const seg   = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Presence helpers — rebuild participants list from Supabase presence state
  // ─────────────────────────────────────────────────────────────────────────────
  function presenceStateToParticipants(state) {
    return Object.values(state)
      .flat()
      .map((p) => ({
        id:            p.userId,
        name:          p.name,
        audioOn:       p.audioOn  ?? true,
        videoOn:       p.videoOn  ?? true,
        handRaised:    p.handRaised ?? false,
        screenSharing: p.screenSharing ?? false,
        isHost:        p.isHost ?? false,
      }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // joinMeeting — main entry point
  // ─────────────────────────────────────────────────────────────────────────────
  const joinMeeting = useCallback(async ({ name, roomId: rid, stream, asHost = false }) => {
    try {
      // Reset any stale modal state from a previous session
      setShowLeaveModal(false);
      setShowSettingsModal(false);

      // 1. Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated. Enable Anonymous Sign-In in Supabase dashboard.');
      myUserIdRef.current = user.id;

      const rId = rid || generateRoomId();
      setRoomId(rId);
      setLocalUser((u) => ({ ...u, name, isHost: asHost }));
      setIsHost(asHost);

      // 2. If host: create room record (upsert safe for reconnects)
      if (asHost) {
        const { error: roomErr } = await supabase
          .from('rooms')
          .upsert({ code: rId, created_by: user.id, title: 'Live Kshetra Meeting' }, { onConflict: 'code' });
        if (roomErr) throw roomErr;
      } else {
        // Check room exists and is not locked
        const { data: room, error: roomFetchErr } = await supabase
          .from('rooms')
          .select('locked, created_by')
          .eq('code', rId)
          .single();
        if (roomFetchErr || !room) throw new Error('Meeting not found. Check the room code and try again.');
        if (room.locked) throw new Error('This meeting is locked by the host.');
        if (room.created_by === user.id) setIsHost(true); // rejoining as original host
      }

      // 3. Register as participant
      const { error: partErr } = await supabase
        .from('room_participants')
        .upsert({ room_code: rId, user_id: user.id, display_name: name }, { onConflict: 'room_code,user_id' });
      if (partErr) throw partErr;

      // 4. Set up local stream
      const lStream = stream || localStreamRef.current;
      if (!lStream) throw new Error('Could not access camera/microphone.');
      localStreamRef.current = lStream;
      setLocalStream(lStream);

      // 5. Create Supabase private Realtime channel
      const channel = supabase.channel(`room:${rId}`, {
        config: { private: true },
      });
      channelRef.current = channel;

      // 6. Attach WebRTC manager (channel passed in — listeners set up before subscribe)
      webrtcRef.current = new WebRTCManager({
        channel,
        userId: user.id,
        localStream: lStream,
        onRemoteStream:        (peerId, remoteStream) => setRemoteStreams((prev) => ({ ...prev, [peerId]: remoteStream })),
        onRemoteStreamRemoved: (peerId)               => setRemoteStreams((prev) => { const n = { ...prev }; delete n[peerId]; return n; }),
      });

      // 7. Speech recognition
      speechRef.current = new SpeechService({
        onCaption: (text, isFinal) => {
          if (text.trim()) {
            setCaptions([{ senderName: 'You', text, timestamp: Date.now() }]);
            clearTimeout(captionTimeoutRef.current);
            captionTimeoutRef.current = setTimeout(() => setCaptions([]), 4000);
            if (isFinal) {
              channel.send({ type: 'broadcast', event: 'caption', payload: { senderName: name, text, timestamp: Date.now() } });
            }
          }
        },
      });

      // 8. Recorder
      recorderRef.current = new MeetingRecorder();

      // ── Presence listeners ──────────────────────────────────────────────────

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setParticipants(presenceStateToParticipants(state));
      });

      channel.on('presence', { event: 'join' }, ({ newPresences }) => {
        let hasNewPeer = false;
        newPresences.forEach((p) => {
          if (p.userId && p.userId !== user.id) {
            hasNewPeer = true;
            // ── WebRTC glare prevention ──────────────────────────────────────
            // If BOTH sides call each other simultaneously (glare condition),
            // both offers collide and the connection fails.
            // Fix: only the peer with the SMALLER userId initiates the call.
            // The peer with the LARGER userId waits to receive the offer.
            if (user.id < p.userId) {
              webrtcRef.current?.initiateCall(p.userId);
            }
            // The other peer (larger userId) will initiate to US, and our
            // WebRTC manager's _handleOffer will answer automatically.
          }
        });
        if (hasNewPeer) playJoin();
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p) => {
          webrtcRef.current?.removePeer(p.userId);
          setRemoteStreams((prev) => { const n = { ...prev }; delete n[p.userId]; return n; });
        });
        playLeave();
      });

      // ── Broadcast listeners ─────────────────────────────────────────────────

      channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChatMessages((prev) => [...prev, payload]);
        if (payload.senderId !== user.id) {
          setUnreadChat((c) => c + 1);
          playNotification();
        }
      });

      channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const x = 20 + Math.random() * 60;
        setReactions((prev) => [...prev, { ...payload, x }]);
        setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== payload.id)), 3500);
      });

      channel.on('broadcast', { event: 'caption' }, ({ payload }) => {
        setCaptions([payload]);
        clearTimeout(captionTimeoutRef.current);
        captionTimeoutRef.current = setTimeout(() => setCaptions([]), 4000);
      });

      channel.on('broadcast', { event: 'whiteboard-draw' }, ({ payload }) => {
        setWhiteboardStrokes((prev) => [...prev, payload.stroke]);
      });

      channel.on('broadcast', { event: 'whiteboard-clear' }, () => {
        setWhiteboardStrokes([]);
      });

      channel.on('broadcast', { event: 'whiteboard-undo' }, () => {
        setWhiteboardStrokes((prev) => prev.slice(0, -1));
      });

      channel.on('broadcast', { event: 'lobby-request' }, ({ payload }) => {
        if (asHost) {
          setLobbyRequests((prev) => [...prev, payload]);
          playNotification();
        }
      });

      channel.on('broadcast', { event: 'force-mute' }, ({ payload }) => {
        if (payload.targetId === user.id || payload.targetId === 'all') {
          toggleAudio(false);
        }
      });

      channel.on('broadcast', { event: 'kick' }, ({ payload }) => {
        if (payload.targetId === user.id) {
          cleanupAndLeave(false);
          setView('landing');
        }
      });

      channel.on('broadcast', { event: 'meeting-ended' }, () => {
        cleanupAndLeave(false);
        setView('landing');
      });

      channel.on('broadcast', { event: 'room-lock-changed' }, ({ payload }) => {
        setRoomLocked(payload.locked);
      });

      channel.on('broadcast', { event: 'admit' }, ({ payload }) => {
        if (payload.targetId === user.id) {
          setView('meeting');
        }
      });

      channel.on('broadcast', { event: 'deny' }, ({ payload }) => {
        if (payload.targetId === user.id) {
          cleanupAndLeave(false);
          setView('landing');
        }
      });

      // 9. Subscribe and track presence
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId:        user.id,
            name,
            audioOn:       true,
            videoOn:       true,
            handRaised:    false,
            screenSharing: false,
            isHost:        asHost,
          });
          setView('meeting');
        } else if (status === 'CHANNEL_ERROR') {
          setErrorMsg('Could not connect to the meeting room. Check your Supabase configuration.');
          setView('error');
        }
      });

    } catch (err) {
      console.error('[Live Kshetra] joinMeeting error:', err);
      setErrorMsg(err.message || 'Failed to join meeting.');
      setView('error');
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Media controls
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleAudio = useCallback((forceState) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    const newState = forceState !== undefined ? forceState : !track.enabled;
    track.enabled = newState;
    setLocalUser((u) => ({ ...u, audioOn: newState }));
    channelRef.current?.track({ audioOn: newState });
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const newState = !track.enabled;
    track.enabled = newState;
    setLocalUser((u) => ({ ...u, videoOn: newState }));
    channelRef.current?.track({ videoOn: newState });
  }, []);

  const toggleHandRaise = useCallback(() => {
    setLocalUser((u) => {
      const newHand = !u.handRaised;
      channelRef.current?.track({ handRaised: newHand });
      if (newHand) playHandRaise();
      return { ...u, handRaised: newHand };
    });
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      const lStream = localStreamRef.current;
      const videoTrack = lStream?.getVideoTracks()[0];
      if (videoTrack) webrtcRef.current?.replaceTrack(null, videoTrack);
      setScreenStream(null);
      setLocalUser((u) => ({ ...u, screenSharing: false }));
      channelRef.current?.track({ screenSharing: false });
    } else {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: true });
        setScreenStream(sStream);
        const screenTrack = sStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current?.getVideoTracks()[0];
        webrtcRef.current?.replaceTrack(oldTrack, screenTrack);
        setLocalUser((u) => ({ ...u, screenSharing: true }));
        channelRef.current?.track({ screenSharing: true });
        screenTrack.onended = () => toggleScreenShare();
      } catch (e) {
        console.warn('[Live Kshetra] Screen share failed:', e);
      }
    }
  }, [screenStream]);

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => {
      if (!prev) {
        speechRef.current?.start();
      } else {
        speechRef.current?.stop();
        setCaptions([]);
      }
      return !prev;
    });
  }, []);

  const toggleRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.isRecording) {
      rec.stop();
      setIsRecording(false);
    } else if (localStreamRef.current) {
      rec.start(localStreamRef.current);
      setIsRecording(true);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Collaboration broadcasts
  // ─────────────────────────────────────────────────────────────────────────────

  const sendChat = useCallback((message) => {
    const payload = {
      id:         crypto.randomUUID(),
      senderId:   myUserIdRef.current,
      senderName: localUser.name,
      message,
      timestamp:  Date.now(),
    };
    // Optimistically add own message
    setChatMessages((prev) => [...prev, payload]);
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload });
  }, [localUser.name]);

  const sendReaction = useCallback((emoji) => {
    const payload = { id: crypto.randomUUID(), senderId: myUserIdRef.current, senderName: localUser.name, emoji, timestamp: Date.now() };
    channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload });
  }, [localUser.name]);

  const sendWhiteboardStroke = useCallback((stroke) => {
    setWhiteboardStrokes((prev) => [...prev, stroke]);
    channelRef.current?.send({ type: 'broadcast', event: 'whiteboard-draw', payload: { stroke } });
  }, []);

  const clearWhiteboard = useCallback(() => {
    setWhiteboardStrokes([]);
    channelRef.current?.send({ type: 'broadcast', event: 'whiteboard-clear', payload: {} });
  }, []);

  const undoWhiteboard = useCallback(() => {
    setWhiteboardStrokes((prev) => prev.slice(0, -1));
    channelRef.current?.send({ type: 'broadcast', event: 'whiteboard-undo', payload: {} });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Host controls
  // ─────────────────────────────────────────────────────────────────────────────

  const muteAll = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'force-mute', payload: { targetId: 'all' } });
    toggleAudio(false); // also mute self
  }, [toggleAudio]);

  const kickUser = useCallback((targetId) => {
    channelRef.current?.send({ type: 'broadcast', event: 'kick', payload: { targetId } });
  }, []);

  const toggleLock = useCallback(async () => {
    const newLocked = !roomLocked;
    setRoomLocked(newLocked);
    await supabase.from('rooms').update({ locked: newLocked }).eq('code', roomId);
    channelRef.current?.send({ type: 'broadcast', event: 'room-lock-changed', payload: { locked: newLocked } });
  }, [roomId, roomLocked]);

  const admitUser = useCallback((targetId) => {
    channelRef.current?.send({ type: 'broadcast', event: 'admit', payload: { targetId } });
    setLobbyRequests((prev) => prev.filter((r) => r.userId !== targetId));
  }, []);

  const denyUser = useCallback((targetId) => {
    channelRef.current?.send({ type: 'broadcast', event: 'deny', payload: { targetId } });
    setLobbyRequests((prev) => prev.filter((r) => r.userId !== targetId));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Leave / End
  // ─────────────────────────────────────────────────────────────────────────────

  function cleanupAndLeave(broadcast = true) {
    if (broadcast) {
      channelRef.current?.send({ type: 'broadcast', event: 'meeting-ended', payload: {} });
    }
    // Stop media
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    // Cleanup WebRTC
    webrtcRef.current?.removeAllPeers();
    webrtcRef.current = null;
    // Cleanup speech
    speechRef.current?.stop();
    speechRef.current = null;
    // Cleanup recorder
    recorderRef.current?.stop();
    recorderRef.current = null;
    // Unsubscribe channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    // Remove from participants table
    const userId = myUserIdRef.current;
    const rId    = roomId;
    if (userId && rId) {
      supabase.from('room_participants').delete().eq('room_code', rId).eq('user_id', userId);
    }
    // Reset state
    setRemoteStreams({});
    setParticipants([]);
    setChatMessages([]);
    setReactions([]);
    setCaptions([]);
    setLobbyRequests([]);
    setRoomId(null);
    setIsHost(false);
    setRoomLocked(false);
    setCaptionsEnabled(false);
    setIsRecording(false);
    setActivePanel(null);
    setPinnedId(null);
    setShowLeaveModal(false);    // ← Fix: reset modal so it never shows on next join
    setShowSettingsModal(false); // ← Fix: same for settings modal
    setLocalUser({ name: '', audioOn: true, videoOn: true, handRaised: false, screenSharing: false, isHost: false, backgroundBlur: false });
    myUserIdRef.current = null;
    playLeave();
  }

  const leaveMeeting = useCallback(() => {
    cleanupAndLeave(false);
    setView('landing');
  }, [roomId]);

  const endMeeting = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'meeting-ended', payload: {} });
    setTimeout(() => { cleanupAndLeave(false); setView('landing'); }, 500);
  }, [roomId]);

  // Clear unread when chat opens
  useEffect(() => {
    if (activePanel === 'chat') setUnreadChat(0);
  }, [activePanel]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────────────────────────
  const value = {
    // Media
    localStream, screenStream, localStreamRef, remoteStreams,
    // State
    view, setView, roomId, setRoomId,
    localUser, setLocalUser,
    participants, setParticipants,
    isHost, roomLocked,
    errorMsg,
    // Devices
    devices, selectedDevices, setSelectedDevices,
    // Panels
    activePanel, setActivePanel,
    // Chat
    chatMessages, unreadChat, sendChat,
    // Reactions
    reactions, sendReaction,
    // Captions
    captionsEnabled, captions, toggleCaptions,
    // Recording
    isRecording, toggleRecording,
    // Lobby
    lobbyRequests, admitUser, denyUser,
    // Modals
    showLeaveModal, setShowLeaveModal,
    showSettingsModal, setShowSettingsModal,
    // Controls
    toggleAudio, toggleVideo, toggleHandRaise, toggleScreenShare,
    muteAll, kickUser, toggleLock,
    // Whiteboard
    whiteboardStrokes, sendWhiteboardStroke, clearWhiteboard, undoWhiteboard,
    // Speaker & Pin
    speakerId, setSpeakerId, pinnedId, setPinnedId,
    // Actions
    joinMeeting, getUserMedia, enumerateDevices,
    leaveMeeting, endMeeting, generateRoomId,
  };

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>;
}

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error('useMeeting must be used inside MeetingProvider');
  return ctx;
}
