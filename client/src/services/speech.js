// Speech-to-text service using Web Speech API for live captions

class SpeechService {
  constructor({ onCaption, onError }) {
    this.onCaption = onCaption;
    this.onError = onError;
    this.recognition = null;
    this.active = false;
    this._init();
  }

  _init() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.onError?.('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      this.onCaption?.(final || interim, !!final);
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.onError?.(event.error);
      }
    };

    this.recognition.onend = () => {
      if (this.active) {
        // Auto-restart on end
        setTimeout(() => {
          if (this.active) {
            try {
              this.recognition.start();
            } catch (e) {
              // ignore
            }
          }
        }, 300);
      }
    };
  }

  start() {
    if (!this.recognition) return false;
    try {
      this.recognition.start();
      this.active = true;
      return true;
    } catch (e) {
      console.warn('Speech recognition start error:', e);
      return false;
    }
  }

  stop() {
    this.active = false;
    try {
      this.recognition?.stop();
    } catch (e) {
      // ignore
    }
  }

  get isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
}

export default SpeechService;
