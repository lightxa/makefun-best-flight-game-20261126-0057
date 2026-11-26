// All sound is synthesized with WebAudio: no audio files, no network. An engine hum
// whose pitch follows the throttle, wind noise that grows with speed, and short chimes
// for rings, landings and crashes. Created lazily on the first user gesture.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Looping wind: a noise buffer through a bandpass filter.
      const length = context.sampleRate;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const band = context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 700;
      windGain = context.createGain();
      windGain.gain.value = 0;
      noise.connect(band);
      band.connect(windGain);
      windGain.connect(master);
      noise.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    /** Call on the first gesture; safe to call any time. */
    unlock() { if (ensure() && context.state === 'suspended') context.resume(); },
    /** Continuous engine and wind, called every frame with the plane's state. */
    update(throttle, speed01, flying) {
      if (!context || muted) return;
      const target = flying ? 0.05 + throttle * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 62, context.currentTime, 0.1);
      windGain.gain.setTargetAtTime(flying ? speed01 * 0.05 : 0, context.currentTime, 0.15);
    },
    ring() { tone(880, 0.18, 'sine', 0.22); tone(1318, 0.3, 'sine', 0.18, 0.09); },
    land() { tone(220, 0.25, 'triangle', 0.25); tone(165, 0.35, 'triangle', 0.2, 0.08); },
    crash() { tone(90, 0.6, 'sawtooth', 0.3); tone(55, 0.8, 'square', 0.2, 0.05); },
    click() { tone(660, 0.07, 'sine', 0.15); },
    warning() { tone(440, 0.12, 'square', 0.1); tone(440, 0.12, 'square', 0.1, 0.18); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
  };
}
