import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

export default function SettingsModal() {
  const { setShowSettingsModal, devices, selectedDevices, setSelectedDevices, localUser, setLocalUser } = useMeeting();
  const [blur, setBlur] = useState(localUser.backgroundBlur || false);

  function save() {
    setLocalUser((u) => ({ ...u, backgroundBlur: blur }));
    setShowSettingsModal(false);
  }

  return (
    <div className="modal-backdrop" onClick={() => setShowSettingsModal(false)}>
      <div className="modal-box max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-meet-text text-lg font-medium">Settings</h3>
          <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-meet-surface rounded-full">
            <X className="w-5 h-5 text-meet-textSoft" />
          </button>
        </div>

        <div className="space-y-4">
          <DeviceSelect
            label="Microphone"
            devices={devices.audio}
            value={selectedDevices.audioId}
            onChange={(id) => setSelectedDevices((p) => ({ ...p, audioId: id }))}
          />
          <DeviceSelect
            label="Camera"
            devices={devices.video}
            value={selectedDevices.videoId}
            onChange={(id) => setSelectedDevices((p) => ({ ...p, videoId: id }))}
          />
          <div>
            <label className="text-meet-textSoft text-xs mb-2 block">Background effects</label>
            <button
              onClick={() => setBlur((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                blur ? 'border-meet-blue bg-meet-blue bg-opacity-10 text-meet-blue' : 'border-meet-border text-meet-text hover:bg-meet-surface'
              }`}
            >
              <span className="text-sm">Background Blur</span>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${blur ? 'bg-meet-blue' : 'bg-meet-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${blur ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowSettingsModal(false)} className="meet-btn-ghost flex-1 justify-center">Cancel</button>
          <button onClick={save} className="meet-btn-primary flex-1 justify-center">Save</button>
        </div>
      </div>
    </div>
  );
}

function DeviceSelect({ label, devices, value, onChange }) {
  if (!devices?.length) return (
    <div>
      <label className="text-meet-textSoft text-xs mb-1 block">{label}</label>
      <div className="meet-input text-meet-textSoft">No {label.toLowerCase()} found</div>
    </div>
  );
  return (
    <div>
      <label className="text-meet-textSoft text-xs mb-1.5 block">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-meet-tile border border-meet-border rounded-lg px-3 py-2.5 text-meet-text text-sm pr-8 focus:outline-none focus:border-meet-blue cursor-pointer"
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} (${d.deviceId.slice(0, 8)})`}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-meet-textSoft pointer-events-none" />
      </div>
    </div>
  );
}
