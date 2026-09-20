import React from 'react';
import { PhoneOff, LogOut } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

export default function LeaveModal() {
  const { setShowLeaveModal, leaveMeeting, endMeeting, isHost } = useMeeting();

  return (
    <div className="modal-backdrop" onClick={() => setShowLeaveModal(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-meet-text text-lg font-medium mb-2">Leave meeting?</h3>
        <p className="text-meet-textSoft text-sm mb-6">
          {isHost
            ? 'You can leave the meeting or end it for everyone.'
            : 'You will be removed from this meeting.'}
        </p>

        <div className="flex flex-col gap-3">
          <button onClick={leaveMeeting} className="meet-btn-danger w-full justify-center py-3">
            <LogOut className="w-4 h-4" /> Leave meeting
          </button>
          {isHost && (
            <button
              onClick={endMeeting}
              className="w-full py-3 rounded-full border border-meet-red text-meet-red hover:bg-meet-red hover:bg-opacity-10 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <PhoneOff className="w-4 h-4" /> End meeting for everyone
            </button>
          )}
          <button
            onClick={() => setShowLeaveModal(false)}
            className="meet-btn-ghost w-full justify-center text-meet-textSoft hover:text-meet-text"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
