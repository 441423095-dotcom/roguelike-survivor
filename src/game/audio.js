// Every sound in the game is synthesised here, through the Web Audio context
// Phaser already owns — the project ships no audio files at all.
//
// Effects are short oscillator and noise envelopes. The music is a loop of bass,
// lead and hat steps, queued a little ahead of the clock by a Phaser timer on
// whichever scene asked for it.

const A = {
  ctx: null,
  master: null,
  compressor: null,
  sfx: null,
  music: null,
  drone: null,
  noise: null,
  pan: 0,
  shotAt: 0,
  hitAt: 0,
  killAt: 0
};

let track = null;

// Kept deliberately low: the mix should sit under the player's ears, not shout
// at them. The compressor below is what lets a wall of explosions stay soft on
// the ears while still sounding big.
const MASTER_VOLUME = 0.5;
const SFX_VOLUME = 0.78;
const MUSIC_VOLUME = 0.24;

export function initAudio(scene) {
  const sound = scene && scene.sound;
  const ctx = sound && sound.context;
  if (!ctx) return;

  if (A.ctx === ctx) return;
  A.ctx = ctx;
  A.drone = null;

  A.master = ctx.createGain();
  A.master.gain.value = MASTER_VOLUME;

  // A gentle glue compressor: it rounds off the peaks that make a busy mix
  // sound harsh, so volume can come from weight rather than brightness.
  if (ctx.createDynamicsCompressor) {
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.knee.value = 22;
    glue.ratio.value = 3;
    glue.attack.value = 0.006;
    glue.release.value = 0.25;

    A.master.connect(glue);
    glue.connect(ctx.destination);
    A.compressor = glue;
  } else {
    A.master.connect(ctx.destination);
  }

  A.sfx = ctx.createGain();
  A.sfx.gain.value = SFX_VOLUME;
  A.sfx.connect(A.master);

  A.music = ctx.createGain();
  A.music.gain.value = MUSIC_VOLUME;
  A.music.connect(A.master);

  A.noise = makeNoise(ctx, 0.5);
}

/// iOS keeps the context asleep until the player touches something.
export function resumeAudio() {
  if (!A.ctx) return;
  if (A.ctx.state === 'suspended') {
    const pending = A.ctx.resume();
    if (pending && pending.catch) pending.catch(() => {});
  }
}

function makeNoise(ctx, seconds) {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function clock() {
  return A.ctx ? A.ctx.currentTime : 0;
}

/// Where a sound sits in the stereo field, from the x of whatever made it. A
/// hit on the left of the arena lands a little to the left; the player's own
/// actions stay near the middle, so nothing ever sounds detached.
export function panFor(x, width) {
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0) return 0;
  const n = (x / width) * 2 - 1;
  return Math.max(-0.5, Math.min(0.5, n * 0.7));
}

/// Routes one voice through a panner when the browser allows it. Every voice
/// builds its own, so a hundred overlapping shots still pan independently.
function connectPan(node, dest, pan) {
  const ctx = A.ctx;
  if (!ctx || !dest) return;

  if (pan && Math.abs(pan) > 0.01 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(panner);
    panner.connect(dest);
    return;
  }

  node.connect(dest);
}

function tone(opts) {
  const ctx = A.ctx;
  if (!ctx) return;

  const {
    freq = 440,
    to = null,
    type = 'square',
    dur = 0.12,
    vol = 0.2,
    at = 0,
    pan = 0,
    bus = A.sfx
  } = opts;

  if (!bus) return;

  const start = A.ctx.currentTime + Math.max(0, at);
  const stop = start + Math.max(0.02, dur);

  const osc = A.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), start);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), stop);

  const gain = A.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  osc.connect(gain);
  connectPan(gain, bus, pan);
  osc.start(start);
  osc.stop(stop + 0.03);
}

function noise(opts) {
  const ctx = A.ctx;
  if (!ctx || !A.noise) return;

  const {
    dur = 0.18,
    vol = 0.25,
    at = 0,
    filter = 1200,
    type = 'lowpass',
    slide = null,
    pan = 0,
    bus = A.sfx
  } = opts;

  if (!bus) return;

  const start = A.ctx.currentTime + Math.max(0, at);
  const stop = start + Math.max(0.02, dur);

  const src = A.ctx.createBufferSource();
  src.buffer = A.noise;

  const band = A.ctx.createBiquadFilter();
  band.type = type;
  band.frequency.setValueAtTime(Math.max(60, filter), start);
  if (slide) {
    band.frequency.exponentialRampToValueAtTime(Math.max(60, slide), stop);
  }

  const gain = A.ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.0002, vol), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  src.connect(band);
  band.connect(gain);
  connectPan(gain, bus, pan);
  src.start(start);
  src.stop(stop + 0.03);
}

export const Sfx = {
  /// One gun sound per weapon family, so the loadout can be heard as well as
  /// seen: a kinetic pop, an energy pew, a rocket's launch, a blade's whoosh.
  /// Ten weapons fire on their own timers, so the whole thing is rate-limited —
  /// it is the texture of the battle, not ten separate guns.
  shoot(style = 'bullet', pan = 0) {
    if (!A.ctx || clock() - A.shotAt < 0.05) return;
    A.shotAt = clock();

    if (style === 'energy') {
      // Laser: a falling whistle with a little air on top, never a shrill beep.
      tone({ freq: 1180, to: 520, type: 'sine', dur: 0.08, vol: 0.032, pan });
      tone({
        freq: 1760,
        to: 880,
        type: 'triangle',
        dur: 0.05,
        vol: 0.016,
        at: 0.01,
        pan
      });
      noise({ dur: 0.05, vol: 0.012, filter: 3200, type: 'highpass', pan });
      return;
    }

    if (style === 'explosive') {
      // Rocket: the launch is a low push and a hiss of escaping air.
      tone({ freq: 150, to: 60, type: 'triangle', dur: 0.18, vol: 0.07, pan });
      noise({ dur: 0.22, vol: 0.048, filter: 900, slide: 300, pan });
      return;
    }

    if (style === 'blade') {
      // Thrown blade: a short, airy sweep rather than a report.
      noise({
        dur: 0.16,
        vol: 0.055,
        filter: 1800,
        slide: 700,
        type: 'bandpass',
        pan
      });
      tone({ freq: 900, to: 300, type: 'triangle', dur: 0.08, vol: 0.018, pan });
      return;
    }

    // Kinetic: a soft pop, not a crack.
    tone({ freq: 620, to: 300, type: 'square', dur: 0.055, vol: 0.034, pan });
    noise({ dur: 0.035, vol: 0.018, filter: 2200, type: 'highpass', pan });
  },

  /// 平底锅: a metal ring, short and slightly detuned, so it reads as a pan
  /// rather than another gun.
  clang(pan = 0) {
    if (!A.ctx || clock() - (A.clangAt || 0) < 0.09) return;
    A.clangAt = clock();

    tone({ freq: 604, to: 560, type: 'triangle', dur: 0.28, vol: 0.07, pan });
    tone({ freq: 912, to: 880, type: 'square', dur: 0.16, vol: 0.024, pan });
    tone({ freq: 1480, to: 1420, type: 'sine', dur: 0.12, vol: 0.016, pan });
    noise({ dur: 0.06, vol: 0.026, filter: 2600, type: 'bandpass', pan });
  },

  hit(pan = 0) {
    if (!A.ctx || clock() - A.hitAt < 0.05) return;
    A.hitAt = clock();
    noise({ dur: 0.05, vol: 0.045, filter: 3200, type: 'bandpass', pan });
  },

  kill(pan = 0) {
    if (!A.ctx || clock() - A.killAt < 0.06) return;
    A.killAt = clock();
    tone({ freq: 220, to: 70, type: 'triangle', dur: 0.14, vol: 0.065, pan });
    noise({ dur: 0.12, vol: 0.07, filter: 900, slide: 240, pan });
  },

  coin(pan = 0) {
    // A vacuumed pile of coins lands in the same frame; one chime is the sound.
    if (!A.ctx || clock() - (A.coinAt || 0) < 0.06) return;
    A.coinAt = clock();
    tone({ freq: 1046, type: 'square', dur: 0.05, vol: 0.04, pan });
    tone({ freq: 1568, type: 'square', dur: 0.06, vol: 0.03, at: 0.05, pan });
  },

  gem(pan = 0) {
    if (!A.ctx || clock() - (A.gemAt || 0) < 0.05) return;
    A.gemAt = clock();
    tone({ freq: 880, type: 'sine', dur: 0.045, vol: 0.028, pan });
  },

  hurt(pan = 0) {
    tone({ freq: 190, to: 55, type: 'sawtooth', dur: 0.28, vol: 0.14, pan });
    noise({ dur: 0.22, vol: 0.12, filter: 1400, slide: 300, pan });
  },

  /// A low thump that gets heavier and closer to the surface as the run turns
  /// bad. The HUD calls it more often and with more power under 30% and 15%.
  heartbeat(power = 1) {
    const p = Math.max(0.2, Math.min(1, power));
    const vol = 0.1 + 0.16 * p;

    tone({ freq: 76 - 10 * p, to: 36, type: 'sine', dur: 0.14, vol });
    tone({
      freq: 66 - 8 * p,
      to: 30,
      type: 'sine',
      dur: 0.16,
      vol: vol * 0.8,
      at: 0.2
    });
    noise({ dur: 0.09, vol: vol * 0.22, filter: 220, slide: 90 });
  },

  dash() {
    noise({ dur: 0.2, vol: 0.1, filter: 500, slide: 2600, type: 'bandpass' });
  },

  blink() {
    tone({ freq: 1400, to: 420, type: 'sine', dur: 0.18, vol: 0.09 });
    noise({ dur: 0.14, vol: 0.05, filter: 2200, slide: 600, type: 'bandpass' });
  },

  levelUp() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) =>
      tone({ freq, type: 'triangle', dur: 0.16, vol: 0.08, at: i * 0.07 })
    );
  },

  waveClear() {
    [392, 523, 659].forEach((freq, i) =>
      tone({ freq, type: 'square', dur: 0.2, vol: 0.06, at: i * 0.1 })
    );
  },

  gameOver() {
    [392, 330, 262, 196].forEach((freq, i) =>
      tone({ freq, type: 'sawtooth', dur: 0.5, vol: 0.1, at: i * 0.22 })
    );
    noise({ dur: 0.8, vol: 0.09, filter: 700, slide: 120, at: 0.1 });
  },

  buy() {
    tone({ freq: 660, type: 'square', dur: 0.07, vol: 0.06 });
    tone({ freq: 990, type: 'square', dur: 0.09, vol: 0.05, at: 0.07 });
  },

  click() {
    tone({ freq: 720, type: 'square', dur: 0.035, vol: 0.045 });
  },

  /// A boss arriving: a sub-bass swell that is felt more than heard, then a
  /// two-tone alarm over it. Dark and slow, never loud and sharp.
  boss() {
    tone({ freq: 58, to: 26, type: 'sine', dur: 1.5, vol: 0.28 });
    tone({ freq: 40, to: 20, type: 'triangle', dur: 1.7, vol: 0.15, at: 0.02 });
    noise({ dur: 1.3, vol: 0.085, filter: 240, slide: 70 });

    tone({ freq: 740, type: 'square', dur: 0.32, vol: 0.032, at: 0.42 });
    tone({ freq: 555, type: 'square', dur: 0.34, vol: 0.032, at: 0.8 });
    tone({ freq: 740, type: 'square', dur: 0.36, vol: 0.028, at: 1.18 });
    tone({ freq: 370, to: 300, type: 'sawtooth', dur: 0.5, vol: 0.018, at: 1.55 });
  },

  flame(pan = 0) {
    noise({
      dur: 0.35,
      vol: 0.12,
      filter: 700,
      slide: 260,
      type: 'bandpass',
      pan
    });
    tone({ freq: 120, to: 80, type: 'sawtooth', dur: 0.3, vol: 0.045, pan });
  },

  mine(pan = 0) {
    noise({ dur: 0.32, vol: 0.16, filter: 1200, slide: 180, pan });
    tone({ freq: 140, to: 50, type: 'square', dur: 0.25, vol: 0.09, pan });
  },

  zap(pan = 0) {
    tone({ freq: 1600, to: 320, type: 'square', dur: 0.2, vol: 0.07, pan });
    noise({
      dur: 0.18,
      vol: 0.06,
      filter: 3000,
      slide: 900,
      type: 'bandpass',
      pan
    });
  },

  heal() {
    tone({ freq: 660, type: 'sine', dur: 0.18, vol: 0.07 });
    tone({ freq: 990, type: 'sine', dur: 0.22, vol: 0.05, at: 0.12 });
  }
};

// ---------------------------------------------------------------- music

// Each track is a bar of sixteen steps: a bass pulse, a lead line, a quiet
// arpeggio and a hat, plus a pad chord on the downbeat. `kick` lays the low
// drum in (the menus have none, battle has a march, the boss a sprint), and
// `drone` starts the ambient bed that sits under the menus.
const TRACKS = {
  menu: {
    bpm: 72,
    bass: [
      45, null, null, null, 43, null, null, null,
      41, null, null, null, 43, null, null, null
    ],
    lead: [
      72, null, null, null, null, null, 76, null,
      72, null, null, null, null, null, null, null
    ],
    arp: [
      69, null, null, null, 67, null, null, null,
      65, null, null, null, 67, null, null, null
    ],
    hat: [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    kick: [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    pad: [45, 48, 52],
    drone: true
  },
  battle: {
    bpm: 142,
    bass: [
      40, 40, null, 40, null, 40, null, 40,
      43, null, 43, null, 45, 45, null, null
    ],
    lead: [
      64, null, 67, null, 71, null, 67, 64,
      62, null, 64, null, 71, null, 74, null
    ],
    arp: [
      76, 79, 83, 79, 76, 79, 83, 86,
      74, 76, 79, 76, 74, 71, 67, 71
    ],
    hat: [
      1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 1
    ],
    // A marching kick, twice a beat at this tempo: urgent without flailing.
    kick: [
      1, 0, 0, 1, 0, 0, 1, 0,
      1, 0, 0, 1, 0, 0, 1, 1
    ],
    pad: [40, 43, 47]
  },
  boss: {
    bpm: 152,
    bass: [
      36, null, 36, null, 36, null, 39, null,
      36, null, 36, null, 41, null, 39, null
    ],
    lead: [
      63, null, 66, null, 70, null, 66, 63,
      61, null, 63, null, 70, null, 73, null
    ],
    arp: [
      75, 78, 82, 78, 75, 78, 82, 85,
      73, 75, 78, 75, 73, 70, 66, 70
    ],
    hat: [
      1, 1, 1, 0, 1, 1, 1, 0,
      1, 1, 1, 0, 1, 1, 1, 1
    ],
    kick: [
      1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 1, 1, 1
    ],
    pad: [36, 39, 43]
  }
};

function midi(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function pickNote(list, index) {
  if (!list || list.length === 0) return null;
  const note = list[index % list.length];
  return note === undefined ? null : note;
}

/// The low drum that gives the battle its pulse: a sine that drops fast into
/// the floor, with a whisper of click on the front so it reads in a busy mix.
function kick(at, vol = 0.1) {
  tone({
    freq: 118,
    to: 42,
    type: 'sine',
    dur: 0.2,
    vol,
    at,
    bus: A.music
  });
  noise({
    dur: 0.03,
    vol: vol * 0.22,
    filter: 1900,
    type: 'highpass',
    at,
    bus: A.music
  });
}

function scheduleMusic() {
  if (!A.ctx || !track) return;

  const def = TRACKS[track.name] || TRACKS.battle;
  const stepLen = 60 / def.bpm / 4;
  let guard = 0;

  while (track.next < A.ctx.currentTime + 0.6 && guard < 48) {
    guard += 1;

    const index = track.step % def.bass.length;
    const at = Math.max(0, track.next - A.ctx.currentTime);

    const bassNote = pickNote(def.bass, index);
    if (bassNote !== null) {
      tone({
        freq: midi(bassNote),
        type: 'triangle',
        dur: stepLen * 3.2,
        vol: 0.12,
        at,
        bus: A.music
      });
    }

    const leadNote = pickNote(def.lead, index);
    if (leadNote !== null) {
      tone({
        freq: midi(leadNote),
        type: 'square',
        dur: stepLen * 1.4,
        vol: 0.035,
        at,
        bus: A.music
      });
    }

    const arpNote = pickNote(def.arp, index);
    if (arpNote !== null) {
      tone({
        freq: midi(arpNote),
        type: 'sine',
        dur: stepLen * 0.8,
        vol: 0.02,
        at,
        bus: A.music
      });
    }

    if (def.kick && def.kick[index % def.kick.length]) {
      kick(at, 0.1);
    }

    if (def.hat && def.hat[index % def.hat.length]) {
      noise({
        dur: 0.03,
        vol: 0.03,
        at,
        filter: 5200,
        type: 'highpass',
        bus: A.music
      });
    }

    // One chord per bar, held under everything else.
    if (track.step % 16 === 0 && def.pad) {
      def.pad.forEach((note, i) =>
        tone({
          freq: midi(note),
          type: 'triangle',
          dur: stepLen * 14,
          vol: 0.026,
          at: at + i * 0.012,
          bus: A.music
        })
      );
    }

    track.step += 1;
    track.next += stepLen;
  }
}

/// The ambient bed behind the menus: a low A2 with a fifth and a slightly
/// detuned octave above it, filtered down to a warm hum, plus a slow LFO that
/// breathes the filter and a whisper of air. No beat — the battle brings that.
function startDrone() {
  const ctx = A.ctx;
  if (!ctx || !A.music || A.drone) return;

  const gain = A.ctx.createGain();
  gain.gain.value = 0.0001;
  gain.gain.setTargetAtTime(0.075, ctx.currentTime + 0.05, 1.6);
  gain.connect(A.music);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 340;
  filter.Q.value = 0.8;
  filter.connect(gain);

  const oscs = [];
  const voices = [
    { mult: 1, type: 'sine', vol: 0.9 },
    { mult: 1.5, type: 'triangle', vol: 0.22 },
    { mult: 2.01, type: 'triangle', vol: 0.1 }
  ];
  const root = 110; // A2

  for (const voice of voices) {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.value = root * voice.mult;

    const mix = ctx.createGain();
    mix.gain.value = voice.vol;
    osc.connect(mix);
    mix.connect(filter);
    osc.start();
    oscs.push(osc);
  }

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 150;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();
  oscs.push(lfo);

  const sources = [];
  if (A.noise) {
    const air = ctx.createBufferSource();
    air.buffer = A.noise;
    air.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200;
    band.Q.value = 0.7;

    const airGain = ctx.createGain();
    airGain.gain.value = 0.012;

    air.connect(band);
    band.connect(airGain);
    airGain.connect(A.music);
    air.start();
    sources.push(air);
  }

  A.drone = { gain, oscs, sources };
}

function stopDrone() {
  const drone = A.drone;
  A.drone = null;
  if (!drone || !A.ctx) return;

  const ctx = A.ctx;
  const stopAt = ctx.currentTime + 1.1;

  try {
    drone.gain.gain.cancelScheduledValues(ctx.currentTime);
    drone.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
  } catch (error) {
    // A closed context is already silent; nothing to fade.
  }

  for (const node of drone.oscs.concat(drone.sources)) {
    try {
      node.stop(stopAt);
    } catch (error) {
      // Already stopped.
    }
  }
}

/// The menu keeps its ambient bed; the run hands the low end to the kick drum.
function syncAmbience() {
  if (track && track.name === 'menu') startDrone();
  else stopDrone();
}

/// Switches the running loop: 'menu', 'battle' or 'boss'. The scene that started
/// the music keeps scheduling it.
export function setMusicTrack(name) {
  if (!track || !name || track.name === name) return;
  track.name = name;
  track.step = 0;
  syncAmbience();
}

/// Pulls the music back while a menu sits over the run, and puts it back after.
export function duckMusic(scale) {
  if (!A.ctx || !A.music) return;
  const target = Math.max(0.12, Math.min(1, scale)) * MUSIC_VOLUME;
  A.music.gain.cancelScheduledValues(A.ctx.currentTime);
  A.music.gain.setTargetAtTime(target, A.ctx.currentTime, 0.2);
}

export function startMusic(scene, name) {
  initAudio(scene);
  if (!A.ctx || !scene || !scene.time) return;
  if (track && track.scene === scene && track.name === name) return;

  stopMusic();

  track = {
    scene,
    name: name || 'battle',
    step: 0,
    next: A.ctx.currentTime + 0.12,
    timer: null
  };

  const timer = scene.time.addEvent({
    delay: 140,
    loop: true,
    callback: scheduleMusic
  });
  track.timer = timer;

  scene.events.once('shutdown', () => {
    if (track && track.timer === timer) stopMusic();
  });

  syncAmbience();
  scheduleMusic();
}

/// Stops the step sequencer only. The ambient bed is left alone on purpose, so
/// moving between menu screens never makes it swell and drop; the next track
/// that starts decides whether it belongs.
export function stopMusic() {
  if (track && track.timer) track.timer.remove();
  track = null;
}
