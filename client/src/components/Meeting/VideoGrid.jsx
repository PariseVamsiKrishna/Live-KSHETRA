import React from 'react';
import { useMeeting } from '../../context/MeetingContext';
import ParticipantTile from './ParticipantTile';

export default function VideoGrid() {
  const { localUser, localStream, screenStream, participants, remoteStreams, pinnedId, currentUserId } = useMeeting();

  // Build tile list: self + remote participants
  const selfParticipant = {
    id: 'self',
    name: localUser.name,
    audioOn: localUser.audioOn,
    videoOn: localUser.videoOn,
    handRaised: localUser.handRaised,
    screenSharing: localUser.screenSharing,
    isHost: localUser.isHost,
  };

  const selfStream = localUser.screenSharing ? screenStream : localStream;

  // All tiles: [ { participant, stream, isSelf } ]
  // Filter out 'self' and currentUserId so the local user is not rendered as a remote duplicate
  const remoteTiles = participants
    .filter((p) => p.id !== 'self' && p.id !== currentUserId)
    .map((p) => ({
      participant: p,
      stream: remoteStreams[p.id] || null,
      isSelf: false,
    }));

  const allTiles = [
    { participant: selfParticipant, stream: selfStream, isSelf: true },
    ...remoteTiles,
  ];

  const total = allTiles.length;

  // Check if someone is screen sharing
  const screenSharingParticipant = participants.find((p) => p.screenSharing) ||
    (localUser.screenSharing ? selfParticipant : null);

  // Pinned or screen sharing triggers spotlight
  const spotlightId = pinnedId || (screenSharingParticipant?.id);
  const spotlight = spotlightId ? allTiles.find((t) => t.participant.id === spotlightId) : null;
  const strips = spotlight ? allTiles.filter((t) => t.participant.id !== spotlightId) : [];

  if (spotlight) {
    // Spotlight / presenter view
    return (
      <div className="video-grid-spotlight flex-1">
        {/* Main spotlight tile */}
        <div className="rounded-xl overflow-hidden">
          <ParticipantTile
            key={spotlight.participant.id}
            stream={spotlight.stream}
            participant={spotlight.participant}
            isSelf={spotlight.isSelf}
            isSpotlight={true}
            isPinned={pinnedId === spotlight.participant.id}
          />
        </div>

        {/* Side strip */}
        {strips.length > 0 && (
          <div className="spotlight-strip">
            {strips.map((t) => (
              <div key={t.participant.id} className="h-40 flex-shrink-0">
                <ParticipantTile
                  stream={t.stream}
                  participant={t.participant}
                  isSelf={t.isSelf}
                  isSpotlight={false}
                  isPinned={pinnedId === t.participant.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular adaptive grid
  const count = Math.min(total, 16);
  return (
    <div
      className="video-grid flex-1 p-2"
      data-count={count}
    >
      {allTiles.slice(0, 16).map((t) => (
        <ParticipantTile
          key={t.participant.id}
          stream={t.stream}
          participant={t.participant}
          isSelf={t.isSelf}
          isSpotlight={false}
          isPinned={pinnedId === t.participant.id}
        />
      ))}
    </div>
  );
}
