import React, { useState, useEffect } from 'react';
import { Shield, Clock } from 'lucide-react';

export default function Navbar() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-meet-border bg-meet-bg">
      {/* Live Kshetra Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #FF9933 0%, #e6821a 100%)' }}
        >
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-semibold text-meet-text text-sm tracking-tight">Live Kshetra</span>
          <span className="text-[10px] text-live-saffron font-medium tracking-wide">SECURE · REALTIME</span>
        </div>
      </div>

      {/* Time & Date */}
      <div className="flex items-center gap-3 text-meet-textSoft text-sm">
        <Clock className="w-4 h-4" />
        <span>{time}</span>
        <span className="text-meet-border">·</span>
        <span>{date}</span>
      </div>
    </nav>
  );
}
