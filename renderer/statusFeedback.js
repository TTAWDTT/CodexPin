const CodexPinStatusFeedbackFactory = () => {
  function shouldPlayCompletionPing(previousStatus, nextStatus) {
    if (!previousStatus || !nextStatus) return false;
    if (previousStatus.integrationState !== 'connected') return false;
    if (nextStatus.integrationState !== 'connected') return false;
    if (!previousStatus.isActive || nextStatus.isActive) return false;
    if (!previousStatus.sessionId || !nextStatus.sessionId) return false;
    return previousStatus.sessionId === nextStatus.sessionId;
  }

  function createCompletionPingPlayer() {
    let audioContext = null;

    return async function playCompletionPing() {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;

        if (!audioContext) {
          audioContext = new AudioContextCtor();
        }

        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(988, now);
        oscillator.frequency.exponentialRampToValueAtTime(784, now + 0.18);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.24);
      } catch {
        // 音频失败不应影响小组件本身。
      }
    };
  }

  return {
    shouldPlayCompletionPing,
    createCompletionPingPlayer,
  };
};

(function attach(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CodexPinStatusFeedback = factory();
  }
})(typeof self !== 'undefined' ? self : this, CodexPinStatusFeedbackFactory);
