// Meeting recorder using MediaRecorder API

class MeetingRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
  }

  start(stream) {
    if (this.isRecording) return;
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-recording-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.chunks = [];
    };

    this.mediaRecorder.start(1000);
    this.isRecording = true;
  }

  stop() {
    if (!this.isRecording) return;
    this.mediaRecorder?.stop();
    this.isRecording = false;
  }

  get status() {
    return this.isRecording ? 'recording' : 'idle';
  }
}

export default MeetingRecorder;
