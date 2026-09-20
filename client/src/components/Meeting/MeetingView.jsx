import React from 'react';
import VideoGrid from './VideoGrid';
import ControlsDock from './ControlsDock';
import FloatingReactions from './FloatingReactions';
import CaptionsOverlay from './CaptionsOverlay';
import ChatSidebar from './Sidebars/ChatSidebar';
import PeopleSidebar from './Sidebars/PeopleSidebar';
import InfoSidebar from './Sidebars/InfoSidebar';
import WhiteboardSidebar from './Sidebars/WhiteboardSidebar';
import LeaveModal from './Modals/LeaveModal';
import AdmitModal from './Modals/AdmitModal';
import SettingsModal from './Modals/SettingsModal';
import { useMeeting } from '../../context/MeetingContext';

export default function MeetingView() {
  const {
    activePanel, showLeaveModal, showSettingsModal,
    isHost, lobbyRequests, isRecording,
  } = useMeeting();

  return (
    <div className="flex flex-col h-full bg-meet-bg overflow-hidden">
      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 bg-meet-red bg-opacity-10 border-b border-meet-red border-opacity-30 py-1.5 text-meet-red text-xs font-medium flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-meet-red animate-pulse" />
          Recording in progress
        </div>
      )}

      {/* Main area: video + sidebars */}
      <div className="flex flex-1 min-h-0">
        {/* Video stage */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <VideoGrid />
          <CaptionsOverlay />
          <FloatingReactions />
        </div>

        {/* Sidebars */}
        {activePanel === 'chat' && <ChatSidebar />}
        {activePanel === 'people' && <PeopleSidebar />}
        {activePanel === 'info' && <InfoSidebar />}
        {activePanel === 'whiteboard' && <WhiteboardSidebar />}
      </div>

      {/* Control Dock */}
      <ControlsDock />

      {/* Modals */}
      {showLeaveModal && <LeaveModal />}
      {showSettingsModal && <SettingsModal />}
      {isHost && lobbyRequests.length > 0 && <AdmitModal />}
    </div>
  );
}
