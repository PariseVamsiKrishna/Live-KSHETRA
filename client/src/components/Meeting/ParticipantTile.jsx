import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Pin, PinOff, Hand } from 'lucide-react';
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
  const analyserRef = useRef(null);
  const volRef = useRef(null);
  const { setPinnedId, localUser } = useMeeting();

  const { name, audioOn, videoOn, handRaised, isHost, screenSharing } = participant || {};
  const displayName = isSelf ? `${localUser.name || name} (You)` : name;

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
          ? `0 0 0 3px rgba(138,180,248,${Math.min(1, vol / 60)})`
          : 'none';
      }
    }, 100);
    return () => clearInterval(id);
  }, [stream, audioOn]);

  // Mirror self view
  const videoStyle = isSelf && !localUser.screenSharing
    ? { transform: 'scaleX(-1)' }
    : {};

  return (
    <div
      ref={volRef}
      className={`participant-tile group transition-all duration-300 ${
        isSpotlight ? 'rounded-lg' : 'rounded-xl'
      }`}
      style={{ background: '#2d2f31' }}
    >
      {/* Video element */}
      {stream && (videoOn || screenSharing) ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isSelf}
          playsInline
          className="w-full h-full object-cover"
          style={videoStyle}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
          <div
            className="rounded-full flex items-center justify-center font-semibold text-white select-none"
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

      {/* Name + host tag pill */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <div className="bg-black bg-opacity-60 rounded-md px-2 py-0.5 flex items-center gap-1.5 text-xs text-white">
          {!audioOn && <MicOff className="w-3 h-3 text-meet-red" />}
          <span className="max-w-[120px] truncate">{displayName}</span>
          {isHost && <span className="text-meet-yellow text-xs">★</span>}
        </div>
      </div>

      {/* Hand raised badge */}
      {handRaised && (
        <div className="absolute top-2 left-2 bg-meet-yellow text-meet-bg rounded-full px-2 py-0.5 text-xs flex items-center gap-1 font-medium animate-pop-in">
          ✋ Hand raised
        </div>
      )}

      {/* Pin button */}
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-60 rounded-full p-1.5 hover:bg-opacity-80"
        onClick={() => setPinnedId((prev) => (prev === participant?.id ? null : participant?.id))}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
      </button>

      {/* Screen share badge */}
      {screenSharing && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-meet-blue text-meet-bg text-xs px-2 py-0.5 rounded-full">
          Presenting
        </div>
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
