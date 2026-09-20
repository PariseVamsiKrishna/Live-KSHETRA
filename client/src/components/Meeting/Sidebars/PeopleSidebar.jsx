import React, { useState } from 'react';
import { X, Mic, MicOff, UserX, Search, Hand, Shield } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

function nameToColor(name = '') {
  const colors = ['#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9334ea', '#00897b', '#f06292', '#ff7043'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return colors[Math.abs(hash) % colors.length];
}

export default function PeopleSidebar() {
  const { participants, localUser, isHost, muteAll, kickUser, setActivePanel } = useMeeting();
  const [search, setSearch] = useState('');

  const allParticipants = [
    {
      id: 'self',
      name: localUser.name,
      audioOn: localUser.audioOn,
      videoOn: localUser.videoOn,
      handRaised: localUser.handRaised,
      isHost: localUser.isHost,
    },
    ...participants.filter((p) => p.id !== 'self'),
  ];

  const handRaisedQueue = allParticipants.filter((p) => p.handRaised);
  const filtered = allParticipants.filter((p) =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="sidebar-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-meet-border flex-shrink-0">
        <h3 className="font-medium text-meet-text text-sm">People ({allParticipants.length})</h3>
        <div className="flex items-center gap-1">
          {isHost && (
            <button
              onClick={muteAll}
              className="text-xs text-meet-textSoft hover:text-meet-text px-2 py-1 rounded hover:bg-meet-surface transition-colors flex items-center gap-1"
              title="Mute all"
            >
              <MicOff className="w-3.5 h-3.5" /> Mute all
            </button>
          )}
          <button onClick={() => setActivePanel(null)} className="p-1 hover:bg-meet-surface rounded-full ml-1">
            <X className="w-4 h-4 text-meet-textSoft" />
          </button>
        </div>
      </div>

      {/* Hand raise queue */}
      {handRaisedQueue.length > 0 && (
        <div className="px-4 py-3 border-b border-meet-border bg-meet-yellow bg-opacity-10">
          <div className="flex items-center gap-2 text-meet-yellow text-xs font-medium mb-2">
            <Hand className="w-3.5 h-3.5" /> Hand raise queue ({handRaisedQueue.length})
          </div>
          {handRaisedQueue.map((p) => (
            <div key={p.id} className="text-meet-text text-xs py-0.5">✋ {p.name}</div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2 border-b border-meet-border flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-meet-textSoft" />
          <input
            type="text"
            className="meet-input pl-8 py-2 text-xs"
            placeholder="Search participants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.map((p) => {
          const isSelf = p.id === 'self';
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-meet-surface group"
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                style={{ background: nameToColor(p.name) }}
              >
                {(p.name || '?')[0].toUpperCase()}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-meet-text text-sm truncate">{p.name}</span>
                  {isSelf && <span className="text-meet-textSoft text-xs">(you)</span>}
                  {p.isHost && (
                    <Shield className="w-3 h-3 text-meet-yellow flex-shrink-0" title="Host" />
                  )}
                  {p.handRaised && <span className="text-xs">✋</span>}
                </div>
              </div>

              {/* Status icons + host actions */}
              <div className="flex items-center gap-1.5">
                {p.audioOn ? (
                  <Mic className="w-3.5 h-3.5 text-meet-textSoft" />
                ) : (
                  <MicOff className="w-3.5 h-3.5 text-meet-red" />
                )}
                {isHost && !isSelf && (
                  <button
                    onClick={() => kickUser(p.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-meet-surface rounded transition-all"
                    title={`Remove ${p.name}`}
                  >
                    <UserX className="w-3.5 h-3.5 text-meet-red" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
