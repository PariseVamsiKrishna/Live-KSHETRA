import React, { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, ChevronDown, Settings, User, ArrowRight
} from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext';
import { createAnalyser, getVolume } from '../../services/audio';

export default function LobbyView() {
  const {
    roomId, localUser, setLocalUser,
    devices, selectedDevices, setSelectedDevices,
    getUserMedia, joinMeeting, localStream, enumerateDevices,
  } = useMeeting();

  const videoRef = useRef(null);
  const analyserRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [name, setName] = useState(localUser.name || '');
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [blurBg, setBlurBg] = useState(false);
  const [joining, setJoining] = useState(false);

  // Request media on mount
  useEffect(() => {
    let stream;
    async function init() {
      stream = await getUserMedia(selectedDevices.audioId, selectedDevices.videoId);
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      const analyser = createAnalyser(stream);
      analyserRef.current = analyser;
    }
    init();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Device change
  async function handleDeviceChange(type, deviceId) {
    setSelectedDevices((prev) => ({
      ...prev,
      [type === 'audio' ? 'audioId' : 'videoId']: deviceId,
    }));
    const newStream = await getUserMedia(
      type === 'audio' ? deviceId : selectedDevices.audioId,
      type === 'video' ? deviceId : selectedDevices.videoId
    );
    if (newStream && videoRef.current) {
      videoRef.current.srcObject = newStream;
    }
    if (analyserRef.current) {
      analyserRef.current = createAnalyser(newStream);
    }
  }

  // Audio level meter
  useEffect(() => {
    if (!audioOn) { setAudioLevel(0); return; }
    const id = setInterval(() => {
      setAudioLevel(getVolume(analyserRef.current));
    }, 80);
    return () => clearInterval(id);
  }, [audioOn]);

  // Mirror video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.transform = 'scaleX(-1)';
    }
  }, []);

  function toggleAudio() {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) track.enabled = !track.enabled;
    setAudioOn((v) => !v);
  }

  function toggleVideo() {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) track.enabled = !track.enabled;
    setVideoOn((v) => !v);
  }

  async function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);
    const stream = videoRef.current?.srcObject;
    stream?.getTracks().forEach((t) => t.stop());
    const freshStream = await getUserMedia(selectedDevices.audioId, selectedDevices.videoId);
    if (freshStream) {
      if (freshStream.getAudioTracks()[0]) freshStream.getAudioTracks()[0].enabled = audioOn;
      if (freshStream.getVideoTracks()[0]) freshStream.getVideoTracks()[0].enabled = videoOn;
    }
    // isHost is set by Hero/JoinRedirect before navigating to lobby view
    await joinMeeting({ name: name.trim(), roomId, stream: freshStream, asHost: localUser.isHost });
  }

  const meetingLink = `${window.location.origin}/join/${roomId}`;

  return (
    <div className="flex-1 flex items-center justify-center lobby-bg p-4">
      <div className="flex flex-col lg:flex-row gap-8 items-center justify-center w-full max-w-4xl">


        {/* Video preview */}
        <div className="flex flex-col gap-4 w-full max-w-md">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-meet-tile shadow-2xl">
            {videoOn ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${blurBg ? 'backdrop-blur-xl' : ''}`}
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-2" style={{ background: 'linear-gradient(135deg, #FF9933, #e6821a)' }}>
                  <User className="w-10 h-10 text-white" />
                </div>
                <span className="text-meet-textSoft text-sm">{name || 'You'}</span>
              </div>
            )}

            {/* Audio level indicator */}
            {audioOn && (
              <div className="absolute bottom-3 left-3 flex items-end gap-0.5 h-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-meet-green rounded-sm transition-all duration-100"
                    style={{ height: `${Math.min(100, audioLevel * i * 0.4)}%`, minHeight: 3 }}
                  />
                ))}
              </div>
            )}

            {/* Background blur badge */}
            {blurBg && (
              <div className="absolute top-3 right-3 bg-meet-blue text-meet-bg text-xs px-2 py-0.5 rounded-full">
                Blur on
              </div>
            )}
          </div>

          {/* Quick controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleAudio}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                audioOn ? 'bg-meet-surface hover:bg-meet-surfaceLight' : 'bg-meet-red hover:bg-red-600'
              }`}
              title={audioOn ? 'Mute' : 'Unmute'}
            >
              {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                videoOn ? 'bg-meet-surface hover:bg-meet-surfaceLight' : 'bg-meet-red hover:bg-red-600'
              }`}
              title={videoOn ? 'Stop camera' : 'Start camera'}
            >
              {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setBlurBg((v) => !v)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all text-xs font-bold ${
                blurBg ? 'bg-meet-blue text-meet-bg' : 'bg-meet-surface hover:bg-meet-surfaceLight'
              }`}
              title="Toggle background blur"
            >
              BG
            </button>
          </div>
        </div>

        {/* Join panel */}
        <div className="flex flex-col gap-5 w-full max-w-sm">
          <div>
            <h2 className="text-2xl font-medium text-meet-text mb-1">Ready to join?</h2>
            <p className="text-meet-textSoft text-sm truncate" title={meetingLink}>
              {roomId}
            </p>
          </div>

          {/* Name input */}
          <div>
            <label className="text-meet-textSoft text-xs mb-1.5 block">Your name</label>
            <input
              type="text"
              className="meet-input"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
              maxLength={40}
            />
          </div>

          {/* Device selectors */}
          <div className="space-y-3">
            <DeviceSelect
              label="Microphone"
              devices={devices.audio}
              value={selectedDevices.audioId}
              onChange={(id) => handleDeviceChange('audio', id)}
            />
            <DeviceSelect
              label="Camera"
              devices={devices.video}
              value={selectedDevices.videoId}
              onChange={(id) => handleDeviceChange('video', id)}
            />
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={!name.trim() || joining}
            className="meet-btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Joining...
              </span>
            ) : (
              <>Join now <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeviceSelect({ label, devices, value, onChange }) {
  if (!devices?.length) return null;
  return (
    <div>
      <label className="text-meet-textSoft text-xs mb-1 block">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-meet-tile border border-meet-border rounded-lg px-3 py-2.5 text-meet-text text-sm pr-8 focus:outline-none focus:border-meet-blue cursor-pointer"
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-meet-textSoft pointer-events-none" />
      </div>
    </div>
  );
}
