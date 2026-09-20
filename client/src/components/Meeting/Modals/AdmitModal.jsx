import React from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

export default function AdmitModal() {
  const { lobbyRequests, admitUser, denyUser } = useMeeting();

  if (!lobbyRequests.length) return null;

  const req = lobbyRequests[0]; // Process one at a time

  return (
    <div className="fixed bottom-24 right-4 z-50 animate-slide-in-up">
      <div className="bg-[#292b2e] border border-meet-border rounded-2xl p-4 shadow-2xl w-72">
        <p className="text-meet-textSoft text-xs mb-1">Waiting to join</p>
        <p className="text-meet-text text-sm font-medium mb-4">
          <span className="text-meet-blue">{req.name}</span> wants to join
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => denyUser(req.socketId)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full border border-meet-border text-meet-text hover:bg-meet-surface text-sm transition-colors"
          >
            <UserX className="w-4 h-4" /> Deny
          </button>
          <button
            onClick={() => admitUser(req.socketId)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full bg-meet-blue text-meet-bg hover:bg-opacity-90 text-sm transition-colors font-medium"
          >
            <UserCheck className="w-4 h-4" /> Admit
          </button>
        </div>
        {lobbyRequests.length > 1 && (
          <p className="text-meet-textSoft text-xs mt-2 text-center">
            +{lobbyRequests.length - 1} more waiting
          </p>
        )}
      </div>
    </div>
  );
}
