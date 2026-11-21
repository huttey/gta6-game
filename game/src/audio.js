// Synthesised sound, WebAudio only — no audio files, no network. Everything is an
// oscillator or a short noise burst, started on the first user gesture (browsers block
// audio before one). M mutes; the engine hum follows the car's speed, the siren wails
// while the police are after the player.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, volume, frequency) {
    if (!ensure() || muted) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** speed01 is 0..1 of the car's top speed; 0 silences the engine. */
    engine(speed01) {
      if (!ensure() || muted) return;
      engineOsc.frequency.value = 45 + speed01 * 130;
      engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
    },
    siren(on, dt) {
      if (!ensure() || muted) return;
      if (!on) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenTimer += dt;
      const high = Math.floor(sirenTimer / 0.45) % 2 === 0;
      sirenOsc.frequency.value = high ? 950 : 700;
      sirenGain.gain.value = 0.035;
    },
    shot() {
      noiseBurst(0.12, 0.5, 1800);
    },
    punch() {
      noiseBurst(0.08, 0.35, 500);
    },
    crash() {
      noiseBurst(0.25, 0.5, 300);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      setTimeout(() => tone(990, 0.12, 'sine', 0.25), 90);
    },
    jingle() {
      tone(523, 0.14, 'triangle', 0.3);
      setTimeout(() => tone(659, 0.14, 'triangle', 0.3), 140);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.3), 280);
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.25, 110);
    },
  };
}
