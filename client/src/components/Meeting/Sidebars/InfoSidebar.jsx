import React, { useState } from 'react';
import { X, Copy, Check, Link, Hash, ExternalLink, Shield } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

export default function InfoSidebar() {
  const { roomId, setActivePanel } = useMeeting();
  const [copied, setCopied] = useState(false);

  const meetingLink = `${window.location.origin}/join/${roomId}`;

  function copyJoiningInfo() {
    const text = `Join my Live Kshetra secure video call\nLink: ${meetingLink}\nCode: ${roomId}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function copyLink() {
    navigator.clipboard.writeText(meetingLink);
  }

  return (
    <div className="sidebar-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-meet-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-live-saffron" />
          <h3 className="font-medium text-meet-text text-sm">Meeting details</h3>
        </div>
        <button onClick={() => setActivePanel(null)} className="p-1 hover:bg-meet-surface rounded-full">
          <X className="w-4 h-4 text-meet-textSoft" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-5">
        {/* Security badge */}
        <div className="flex items-center gap-2 bg-live-saffronGlow border border-live-saffron border-opacity-30 rounded-xl px-3 py-2">
          <span className="text-live-saffron text-xs">🔐 Private channel · RLS protected</span>
        </div>

        {/* Meeting link */}
        <div>
          <div className="flex items-center gap-2 text-meet-textSoft text-xs mb-2">
            <Link className="w-3.5 h-3.5" /> Meeting link
          </div>
          <div className="flex items-center gap-2 bg-meet-tile border border-meet-border rounded-lg px-3 py-2.5">
            <span className="text-live-saffron text-xs flex-1 truncate break-all">{meetingLink}</span>
            <button onClick={copyLink} className="text-meet-textSoft hover:text-meet-text flex-shrink-0" title="Copy link">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Meeting code */}
        <div>
          <div className="flex items-center gap-2 text-meet-textSoft text-xs mb-2">
            <Hash className="w-3.5 h-3.5" /> Meeting code
          </div>
          <div className="bg-meet-tile border border-meet-border rounded-lg px-3 py-2.5">
            <span className="text-meet-text font-mono text-sm tracking-widest">{roomId}</span>
          </div>
        </div>

        {/* Copy joining info */}
        <button
          onClick={copyJoiningInfo}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-meet-border hover:bg-meet-surface transition-colors text-sm text-meet-text"
        >
          {copied ? (
            <><Check className="w-4 h-4 text-meet-green" /> Copied!</>
          ) : (
            <><Copy className="w-4 h-4" /> Copy joining info</>
          )}
        </button>

        <div className="text-meet-textSoft text-xs leading-relaxed">
          Share this Live Kshetra link. Only admitted participants can view or send messages in this private channel.
        </div>
      </div>
    </div>
  );
}
