// Audio service: visualizer + sound effects via Web Audio API

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Play a simple chime / beep
export function playTone({ frequency = 880, duration = 0.15, volume = 0.3, type = 'sine', rampTo = 0 } = {}) {
  try {
    const ctx = getAudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(rampTo || 0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

// Hand raise chime (ascending two notes)
export function playHandRaise() {
  playTone({ frequency: 660, duration: 0.12, volume: 0.25 });
  setTimeout(() => playTone({ frequency: 880, duration: 0.18, volume: 0.2 }), 120);
}

// Join room ding
export function playJoin() {
  playTone({ frequency: 523, duration: 0.1, volume: 0.2 });
  setTimeout(() => playTone({ frequency: 659, duration: 0.15, volume: 0.18 }), 100);
}

// Leave room tone
export function playLeave() {
  playTone({ frequency: 659, duration: 0.1, volume: 0.2 });
  setTimeout(() => playTone({ frequency: 523, duration: 0.15, volume: 0.18 }), 100);
}

// Notification ding
export function playNotification() {
  playTone({ frequency: 784, duration: 0.18, volume: 0.22 });
}

// Create an audio analyser for a MediaStream
export function createAnalyser(stream) {
  try {
    const ctx = getAudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    return analyser;
  } catch (e) {
    console.warn('Analyser creation failed:', e);
    return null;
  }
}

// Get volume level 0-100 from analyser
export function getVolume(analyser) {
  if (!analyser) return 0;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);
  const sum = dataArray.reduce((a, b) => a + b, 0);
  return Math.min(100, (sum / bufferLength / 255) * 400);
}
