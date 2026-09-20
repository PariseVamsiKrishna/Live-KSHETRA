import React from 'react';
import { useMeeting } from '../../context/MeetingContext';

export default function FloatingReactions() {
  const { reactions } = useMeeting();

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-24 text-4xl animate-float-up select-none"
          style={{ left: `${r.x}%` }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );
}
