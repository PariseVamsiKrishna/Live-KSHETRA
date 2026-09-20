import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  Hand, MessageSquare, Users, Info, MoreVertical, LogOut,
  Captions, Circle, Settings, LayoutGrid,
  SmilePlus, Presentation,
} from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';
import { createAnalyser, getVolume } from '../../services/audio';

const EMOJIS = ['👍', '❤️', '👏', '😂', '🎉', '😮', '🙌', '🔥'];

export default function ControlsDock() {
  const {
    localUser, toggleAudio, toggleVideo, toggleScreenShare, toggleHandRaise,
    toggleCaptions, captionsEnabled,
    activePanel, setActivePanel,
    sendReaction, unreadChat,
    setShowLeaveModal, setShowSettingsModal,
    isRecording, toggleRecording,
    isHost, muteAll, toggleLock, roomLocked,
    localStream,
  } = useMeeting();

  const [showEmojis, setShowEmojis] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef(null);
  const emojiRef = useRef(null);
  const moreRef = useRef(null);

  const { roomId } = useMeeting();

  // Audio level analyser for mic indicator
  useEffect(() => {
    if (!localStream || !localUser.audioOn) {
      setAudioLevel(0);
      return;
    }
    const analyser = createAnalyser(localStream);
    analyserRef.current = analyser;
    const id = setInterval(() => {
      setAudioLevel(getVolume(analyser));
    }, 80);
    return () => clearInterval(id);
  }, [localStream, localUser.audioOn]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojis(false);
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function togglePanel(panel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  const audioLevelRingSize = localUser.audioOn ? Math.min(16, audioLevel / 6) : 0;

  return (
    <div className="relative flex-shrink-0 flex items-center justify-between px-4 py-3 bg-meet-bg border-t border-meet-border">
      {/* Left: Meeting info */}
      <div className="hidden sm:flex items-center gap-2 min-w-[160px]">
        <div className="text-meet-textSoft text-xs font-mono truncate max-w-[140px]">
          {roomId}
        </div>
      </div>

      {/* Center: Control buttons */}
      <div className="flex items-center gap-2 mx-auto">
        {/* Mic */}
        <div className="relative">
          <button
            onClick={toggleAudio}
            className={`dock-btn ${!localUser.audioOn ? 'dock-btn-muted' : ''}`}
            title={localUser.audioOn ? 'Mute microphone' : 'Unmute microphone'}
            style={
              localUser.audioOn && audioLevel > 8
                ? { boxShadow: `0 0 0 ${audioLevelRingSize}px rgba(138,180,248,0.5)` }
                : {}
            }
          >
            {localUser.audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          {/* Level indicator dots */}
          {localUser.audioOn && audioLevel > 5 && (
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-meet-blue"
                  style={{ opacity: audioLevel / 100 > i * 0.3 ? 1 : 0.2 }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          className={`dock-btn ${!localUser.videoOn ? 'dock-btn-muted' : ''}`}
          title={localUser.videoOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {localUser.videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`dock-btn ${localUser.screenSharing ? 'dock-btn-active' : ''}`}
          title={localUser.screenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {localUser.screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Hand Raise */}
        <button
          onClick={toggleHandRaise}
          className={`dock-btn ${localUser.handRaised ? 'dock-btn-active' : ''}`}
          title={localUser.handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Reactions */}
        <div className="relative" ref={emojiRef}>
          <button
            onClick={() => setShowEmojis((v) => !v)}
            className={`dock-btn ${showEmojis ? 'bg-meet-surface' : ''}`}
            title="React"
          >
            <SmilePlus className="w-5 h-5" />
          </button>
          {showEmojis && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#292b2e] border border-meet-border rounded-2xl px-3 py-2 flex gap-1 shadow-2xl animate-pop-in">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { sendReaction(emoji); setShowEmojis(false); }}
                  className="text-2xl hover:scale-125 transition-transform p-1 rounded-xl hover:bg-meet-surface"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CC Captions */}
        <button
          onClick={toggleCaptions}
          className={`dock-btn ${captionsEnabled ? 'dock-btn-active' : ''}`}
          title={captionsEnabled ? 'Turn off captions' : 'Turn on captions'}
        >
          <Captions className="w-5 h-5" />
        </button>

        {/* More options */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMore((v) => !v)}
            className={`dock-btn ${showMore ? 'bg-meet-surface' : ''}`}
            title="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMore && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-52 bg-[#292b2e] border border-meet-border rounded-xl shadow-2xl overflow-hidden animate-pop-in z-20">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-meet-surface text-sm text-meet-text"
                onClick={() => { setShowSettingsModal(true); setShowMore(false); }}
              >
                <Settings className="w-4 h-4 text-meet-textSoft" /> Settings
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-meet-surface text-sm text-meet-text"
                onClick={() => { togglePanel('whiteboard'); setShowMore(false); }}
              >
                <Presentation className="w-4 h-4 text-meet-textSoft" /> Whiteboard
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-meet-surface text-sm"
                onClick={() => { toggleRecording(); setShowMore(false); }}
              >
                <Circle className={`w-4 h-4 ${isRecording ? 'text-meet-red fill-meet-red animate-pulse' : 'text-meet-textSoft'}`} />
                <span className={isRecording ? 'text-meet-red' : 'text-meet-text'}>
                  {isRecording ? 'Stop recording' : 'Record meeting'}
                </span>
              </button>
              {isHost && (
                <>
                  <div className="border-t border-meet-border" />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-meet-surface text-sm text-meet-text"
                    onClick={() => { muteAll(); setShowMore(false); }}
                  >
                    <MicOff className="w-4 h-4 text-meet-textSoft" /> Mute all participants
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-meet-surface text-sm text-meet-text"
                    onClick={() => { toggleLock(); setShowMore(false); }}
                  >
                    <LayoutGrid className="w-4 h-4 text-meet-textSoft" />
                    {roomLocked ? 'Unlock meeting' : 'Lock meeting'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Leave button */}
        <button
          onClick={() => setShowLeaveModal(true)}
          className="dock-btn-danger ml-2"
          title="Leave call"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Sidebar toggles */}
      <div className="hidden sm:flex items-center gap-1 min-w-[160px] justify-end">
        <SidebarBtn
          icon={<Info className="w-5 h-5" />}
          active={activePanel === 'info'}
          onClick={() => togglePanel('info')}
          title="Meeting details"
        />
        <SidebarBtn
          icon={<Users className="w-5 h-5" />}
          active={activePanel === 'people'}
          onClick={() => togglePanel('people')}
          title="Participants"
        />
        <SidebarBtn
          icon={
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {unreadChat > 0 && (
                <span className="absolute -top-1 -right-1 bg-meet-blue text-meet-bg text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadChat > 9 ? '9+' : unreadChat}
                </span>
              )}
            </div>
          }
          active={activePanel === 'chat'}
          onClick={() => togglePanel('chat')}
          title="Chat"
        />
      </div>
    </div>
  );
}

function SidebarBtn({ icon, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      className={`dock-btn ${active ? 'bg-meet-blue text-meet-bg' : ''}`}
      title={title}
    >
      {icon}
    </button>
  );
}


