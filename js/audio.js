// All sounds and the music are synthesized with Web Audio; there are no sound files.

const Sound = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let noiseBuffer = null;
  let musicOn = true;
  let nextNoteTime = 0;
  let step = 0;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      setInterval(scheduleMusic, 50);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, { type = 'sine', vol = 0.3, when = 0, slideTo = null, dest = null } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(dest || master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function hiss(dur, freq, { vol = 0.3, filter = 'lowpass', freqTo = null, q = 1 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function arpeggio(notes, gap, opts) {
    notes.forEach((n, i) => tone(n, gap * 2.2, Object.assign({ when: i * gap }, opts)));
  }

  // A cheeky circus waltz in A minor: bass on the beat, chords after, melody on top.
  const MELODY = [440, 0, 523, 494, 440, 0, 330, 0, 349, 0, 440, 415, 349, 0, 330, 0,
    294, 0, 349, 330, 294, 0, 247, 0, 330, 0, 415, 392, 440, 0, 0, 0];
  const BASS = [110, 82, 110, 82, 87, 131, 87, 131, 73, 110, 73, 110, 82, 123, 82, 123];

  function scheduleMusic() {
    if (!ctx) return;
    const beat = 0.2;
    if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + 0.05;
    while (nextNoteTime < ctx.currentTime + 0.3) {
      const when = nextNoteTime - ctx.currentTime;
      if (musicOn) {
        const m = MELODY[step % MELODY.length];
        if (m) tone(m, beat * 1.6, { type: 'triangle', vol: 0.5, when, dest: musicGain });
        if (step % 2 === 0) {
          const b = BASS[(step / 2) % BASS.length];
          tone(b, beat * 1.4, { type: 'sine', vol: step % 4 === 0 ? 0.9 : 0.5, when, dest: musicGain });
        }
      }
      nextNoteTime += beat;
      step++;
    }
  }

  return {
    start: ensure,
    toggleMusic() {
      musicOn = !musicOn;
      return musicOn;
    },
    fire() {
      hiss(0.55, 1400, { vol: 0.45, freqTo: 250 });
      tone(90, 0.5, { type: 'sawtooth', vol: 0.12, slideTo: 60 });
    },
    bubbles() {
      for (let i = 0; i < 5; i++) tone(500 + Math.random() * 600, 0.08, { vol: 0.12, when: i * 0.06, slideTo: 1400 });
    },
    flap() { hiss(0.14, 700, { vol: 0.2 }); },
    jump() { tone(300, 0.18, { type: 'triangle', vol: 0.25, slideTo: 620 }); },
    land() { hiss(0.1, 300, { vol: 0.15 }); },
    splash() { hiss(0.6, 2000, { vol: 0.4, freqTo: 200 }); },
    dig() { hiss(0.25, 260, { vol: 0.35 }); },
    popOut() { tone(200, 0.2, { type: 'triangle', vol: 0.3, slideTo: 700 }); hiss(0.3, 400, { vol: 0.3 }); },
    coin() { tone(988, 0.1, { type: 'square', vol: 0.12 }); tone(1319, 0.25, { type: 'square', vol: 0.12, when: 0.08 }); },
    netShot() { tone(700, 0.25, { type: 'square', vol: 0.08, slideTo: 180 }); hiss(0.2, 1200, { vol: 0.15, filter: 'bandpass' }); },
    netted() { tone(400, 0.5, { type: 'sawtooth', vol: 0.15, slideTo: 150 }); },
    freed() { arpeggio([523, 659, 784, 1047], 0.07, { type: 'triangle', vol: 0.25 }); },
    burnNet() { hiss(0.2, 900, { vol: 0.3 }); },
    caught() { arpeggio([392, 370, 349, 262], 0.22, { type: 'sawtooth', vol: 0.15 }); },
    checkpoint() { arpeggio([523, 659, 784], 0.1, { type: 'triangle', vol: 0.25 }); },
    boing() { tone(180, 0.35, { type: 'triangle', vol: 0.3, slideTo: 520 }); },
    bark() { tone(420, 0.08, { type: 'sawtooth', vol: 0.15, slideTo: 260 }); tone(440, 0.08, { type: 'sawtooth', vol: 0.15, slideTo: 270, when: 0.14 }); },
    beep() { tone(880, 0.1, { type: 'square', vol: 0.1 }); tone(660, 0.1, { type: 'square', vol: 0.1, when: 0.12 }); },
    growl() { tone(110, 0.5, { type: 'sawtooth', vol: 0.18, slideTo: 80 }); hiss(0.4, 300, { vol: 0.15 }); },
    screech() { tone(1800, 0.4, { type: 'sawtooth', vol: 0.08, slideTo: 900 }); },
    snap() { hiss(0.08, 2500, { vol: 0.5, filter: 'highpass' }); tone(200, 0.1, { type: 'square', vol: 0.1, when: 0.12 }); },
    hey() { tone(260, 0.25, { type: 'sawtooth', vol: 0.12, slideTo: 330 }); },
    evilLaugh() { [0, 0.18, 0.36, 0.54].forEach((w) => tone(200, 0.14, { type: 'sawtooth', vol: 0.14, when: w, slideTo: 150 })); },
    burn() { hiss(0.8, 600, { vol: 0.35, freqTo: 120 }); },
    win() { arpeggio([523, 659, 784, 1047, 784, 1047, 1319], 0.14, { type: 'triangle', vol: 0.3 }); },
  };
})();
