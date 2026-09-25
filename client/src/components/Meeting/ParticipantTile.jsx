import React, { useRef, useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Pin,
  PinOff,
  Volume2,
  SignalHigh,
  SignalMedium,
  SignalLow,
  SignalZero,
} from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';
import { createAnalyser, getVolume } from '../../services/audio';

export default function ParticipantTile({
  stream,
  participant,
  isSelf = false,
  isSpotlight = false,
  isPinned = false,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const volRef = useRef(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const { setPinnedId, localUser, networkQuality } = useMeeting();

  const { name, audioOn, videoOn, handRaised, isHost, screenSharing } = participant || {};
  const displayName = isSelf ? `${localUser.name || name} (You)` : name;

  // Whether we should visually render the video or the initials avatar
  const showVideo = Boolean(stream && (videoOn !== false || screenSharing));

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.warn(`[ParticipantTile] Video play error for ${displayName}:`, err.message);
      });
    }
  }, [stream, showVideo, displayName]);

  // Dedicated audio element for remote participants to guarantee voice playback
  useEffect(() => {
    if (!isSelf && audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
      audioRef.current.play()
        .then(() => setAudioBlocked(false))
        .catch((err) => {
          console.warn(`[ParticipantTile] Audio autoplay blocked for ${displayName}:`, err.message);
          setAudioBlocked(true);
        });
    }
  }, [stream, isSelf, displayName]);

  // Audio analyser for speaking indicator
  useEffect(() => {
    if (!stream || !audioOn) return;
    const analyser = createAnalyser(stream);
    analyserRef.current = analyser;
    const id = setInterval(() => {
      const vol = getVolume(analyser);
      if (volRef.current) {
        volRef.current.style.opacity = vol > 8 ? '1' : '0';
        volRef.current.style.boxShadow = vol > 8
          ? `0 0 0 3px rgba(255,153,51,${Math.min(1, vol / 60)})`
          : 'none';
      }
    }, 100);
    return () => clearInterval(id);
  }, [stream, audioOn]);

  const handleUnblockAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => setAudioBlocked(false)).catch(console.warn);
    }
    if (videoRef.current) {
      videoRef.current.play().catch(console.warn);
    }
  };

  // Signal strength calculation
  let quality = isSelf ? null : (networkQuality[participant?.id] || null);
  if (isSelf) {
    const peerQualities = Object.values(networkQuality || {});
    if (peerQualities.length > 0) {
      const avgLevel = Math.round(
        peerQualities.reduce((acc, q) => acc + (q.level || 0), 0) / peerQualities.length
      );
      quality = {
        level: Math.max(1, avgLevel),
        rtt: peerQualities[0]?.rtt || 30,
        status: avgLevel >= 3 ? 'Excellent' : avgLevel === 2 ? 'Fair' : 'Poor',
      };
    } else {
      quality = { level: 3, rtt: null, status: 'Ready' };
    }
  } else if (!quality) {
    quality = stream
      ? { level: 3, rtt: null, status: 'Connected' }
      : { level: 0, rtt: null, status: 'Connecting...' };
  }

  // Mirror self view
  const videoStyle = isSelf && !localUser.screenSharing
    ? { transform: 'scaleX(-1)' }
    : {};

  return (
    <div
      ref={volRef}
      className={`participant-tile group transition-all duration-300 relative overflow-hidden select-none ${
        isSpotlight ? 'rounded-lg' : 'rounded-xl'
      }`}
      style={{ background: '#1e2129' }}
      onClick={audioBlocked ? handleUnblockAudio : undefined}
    >
      {/* Remote audio playback element (always mounted for remote peers) */}
      {!isSelf && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
        />
      )}

      {/* Video element (always mounted if stream exists to prevent detach on toggle) */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          muted={isSelf}
          playsInline
          className={`w-full h-full object-cover ${!showVideo ? 'hidden' : ''}`}
          style={videoStyle}
        />
      )}

      {/* Avatar placeholder when video is off or stream is pending */}
      {!showVideo && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
          <div
            className="rounded-full flex items-center justify-center font-semibold text-white select-none shadow-lg"
            style={{
              width: isSpotlight ? 96 : 60,
              height: isSpotlight ? 96 : 60,
              fontSize: isSpotlight ? 36 : 22,
              background: nameToColor(displayName),
            }}
          >
            {(displayName || '?')[0].toUpperCase()}
          </div>
          {!isSpotlight && (
            <span className="text-meet-textSoft text-xs">{displayName}</span>
          )}
        </div>
      )}

      {/* Tap to enable audio notice if browser blocked autoplay */}
      {audioBlocked && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-3 text-center cursor-pointer z-10 animate-fade-in">
          <Volume2 className="w-8 h-8 text-live-saffron animate-bounce" />
          <span className="text-white text-xs font-medium">Click tile to enable audio</span>
        </div>
      )}

      {/* Name + host tag pill (Bottom Left) */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
        <div className="bg-black/70 backdrop-blur-sm rounded-md px-2 py-0.5 flex items-center gap-1.5 text-xs text-white">
          {!audioOn && <MicOff className="w-3 h-3 text-meet-red" />}
          <span className="max-w-[120px] truncate">{displayName}</span>
          {isHost && <span className="text-live-saffron text-xs">★</span>}
        </div>
      </div>

      {/* Signal strength indicator (Bottom Right) */}
      <div className="absolute bottom-2 right-2 z-10 pointer-events-auto">
        <SignalStrengthBadge quality={quality} />
      </div>

      {/* Hand raised badge (Top Left) */}
      {handRaised && (
        <div className="absolute top-2 left-2 bg-live-saffron text-white rounded-full px-2.5 py-0.5 text-xs flex items-center gap-1 font-medium shadow-md animate-pop-in z-10">
          ✋ Hand raised
        </div>
      )}

      {/* Pin button (Top Right) */}
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-full p-1.5 hover:bg-black/80 z-10"
        onClick={(e) => {
          e.stopPropagation();
          setPinnedId((prev) => (prev === participant?.id ? null : participant?.id));
        }}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        {isPinned ? <PinOff className="w-3.5 h-3.5 text-white" /> : <Pin className="w-3.5 h-3.5 text-white" />}
      </button>

      {/* Screen share badge */}
      {screenSharing && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-live-saffron text-white text-xs px-2.5 py-0.5 rounded-full font-medium shadow-md z-10">
          Presenting
        </div>
      )}
    </div>
  );
}

function SignalStrengthBadge({ quality }) {
  const level = quality?.level ?? 0;
  const rtt = quality?.rtt;
  const status = quality?.status || 'Connecting';

  let icon = <SignalZero className="w-3 h-3 text-gray-400" />;
  let colorClass = 'text-gray-400';

  if (level >= 3) {
    icon = <SignalHigh className="w-3 h-3 text-emerald-400" />;
    colorClass = 'text-emerald-400';
  } else if (level === 2) {
    icon = <SignalMedium className="w-3 h-3 text-amber-400" />;
    colorClass = 'text-amber-400';
  } else if (level === 1) {
    icon = <SignalLow className="w-3 h-3 text-rose-400" />;
    colorClass = 'text-rose-400';
  }

  const tooltip = rtt ? `Connection: ${status} (${rtt} ms RTT)` : `Connection: ${status}`;

  return (
    <div
      className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[10px] select-none shadow-sm cursor-help hover:bg-black/85 transition-colors"
      title={tooltip}
    >
      {icon}
      {rtt !== null && rtt !== undefined && (
        <span className={`font-mono text-[9px] font-medium ${colorClass}`}>{rtt}ms</span>
      )}
    </div>
  );
}

function nameToColor(name = '') {
  const colors = [
    '#1a73e8', '#ea4335', '#34a853', '#fbbc04',
    '#9334ea', '#00897b', '#f06292', '#ff7043',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return colors[Math.abs(hash) % colors.length];
}
