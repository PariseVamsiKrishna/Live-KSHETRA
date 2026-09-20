import React, { useState } from 'react';
import { Video, Plus, Link, Hash, Check, Lock, Shield } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';

export default function Hero() {
  const { setView, setRoomId, generateRoomId, setLocalUser } = useMeeting();
  const [joinCode, setJoinCode]       = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [justCopied, setJustCopied]   = useState(false);

  function handleStartMeeting() {
    const id = generateRoomId();
    setRoomId(id);
    setLocalUser((u) => ({ ...u, isHost: true }));
    setView('lobby');
    setShowNewMenu(false);
  }

  function handleCopyLater() {
    const id   = generateRoomId();
    const link = `${window.location.origin}/join/${id}`;
    navigator.clipboard.writeText(link);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2500);
    setShowNewMenu(false);
  }

  function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().replace(/\s+/g, '-').toLowerCase();
    if (!code) return;
    setRoomId(code);
    setView('lobby');
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 lobby-bg">
      {/* Brand shield */}
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl mb-6 animate-saffron-pulse"
        style={{ background: 'linear-gradient(135deg, #FF9933 0%, #e6821a 100%)' }}
      >
        <Shield className="w-10 h-10 text-white" />
      </div>

      {/* Hero headline */}
      <h1 className="text-4xl sm:text-5xl font-semibold text-meet-text text-center mb-3 leading-tight">
        Secure, Real-Time<br />
        <span style={{ color: '#FF9933' }}>Video Collaboration</span>
      </h1>
      <p className="text-meet-textSoft text-center mb-10 text-sm max-w-sm">
        Live Kshetra — where every conversation is protected by<br />
        Row Level Security and private Realtime channels
      </p>

      {/* Action row */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full max-w-md">
        {/* New Meeting */}
        <div className="relative">
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm text-white transition-all hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FF9933, #e6821a)' }}
            onClick={() => setShowNewMenu((v) => !v)}
          >
            <Video className="w-4 h-4" />
            New meeting
          </button>

          {showNewMenu && (
            <div className="absolute top-full left-0 mt-2 w-68 bg-[#1e2129] rounded-xl shadow-2xl border border-meet-border overflow-hidden z-30 animate-pop-in">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-meet-surface transition-colors text-meet-text text-sm"
                onClick={handleStartMeeting}
              >
                <Plus className="w-4 h-4 text-live-saffron" />
                <div className="text-left">
                  <div className="font-medium">Start an instant meeting</div>
                  <div className="text-meet-textSoft text-xs">Secured with RLS</div>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-meet-surface transition-colors text-meet-text text-sm border-t border-meet-border"
                onClick={handleCopyLater}
              >
                {justCopied ? <Check className="w-4 h-4 text-meet-green" /> : <Link className="w-4 h-4 text-live-saffron" />}
                <div className="text-left">
                  <div className="font-medium">{justCopied ? 'Link copied!' : 'Create a meeting for later'}</div>
                  <div className="text-meet-textSoft text-xs">Share the private link</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Join by code */}
        <form onSubmit={handleJoin} className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-meet-textSoft" />
            <input
              type="text"
              className="meet-input pl-9"
              placeholder="Enter a code or link"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: '#FF9933' }}
          >
            Join
          </button>
        </form>
      </div>

      {/* Trust badges */}
      <div className="flex items-center gap-6 mt-10 flex-wrap justify-center">
        {[
          { icon: '🔐', label: 'Row Level Security' },
          { icon: '🕵️', label: 'Anonymous sign-in' },
          { icon: '📡', label: 'Private Realtime channels' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-meet-textSoft text-xs">
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
