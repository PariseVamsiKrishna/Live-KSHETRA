import React from 'react';
import { useMeeting } from '../../context/MeetingContext';

export default function CaptionsOverlay() {
  const { captionsEnabled, captions } = useMeeting();

  if (!captionsEnabled || !captions.length) return null;

  const { senderName, text } = captions[0];

  return (
    <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4 pointer-events-none z-30">
      <div className="captions-bar max-w-2xl">
        {senderName && (
          <span className="text-meet-blue text-sm font-medium mr-2">{senderName}:</span>
        )}
        <span className="text-white text-sm">{text}</span>
      </div>
    </div>
  );
}
