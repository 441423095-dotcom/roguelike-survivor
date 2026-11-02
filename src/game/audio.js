// Every sound in the game is synthesised here, through the Web Audio context
// Phaser already owns — the project ships no audio files at all.
//
// Effects are short oscillator and noise envelopes. The music is a loop of bass,
// lead and hat steps, queued a little ahead of the clock by a Phaser timer on
// whichever scene asked for it.

const A = {
  ctx: null,
  master: null,
  sfx: null,
  music: null,
  noise: null,
  shotAt: 0,
  hitAt: 0,
  killAt: 0
};

let track = null;

const MUSIC_VOLUME = 0.26;

export function initAudio(scene) {
  const sound = scene && scene.sound;
  const ctx = sound && sound.context;
  if (!ctx) return;

  if (A.ctx === ctx) return;
  A.ctx = ctx;

  A.master = ctx.createGain();
  A.master.gain.value = 0.5;
  A.master.connect(ctx.destination);

  A.sfx = ctx.createGain();
  A.sfx.gain.value = 0.85;
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
  gain.connect(bus);
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
  gain.connect(bus);
  src.start(start);
  src.stop(stop + 0.03);
}

export const Sfx = {
  /// Ten weapons fire on their own timers, so this one is rate-limited: it is the
  // texture of the battle, not ten separate guns.
  shoot() {
    if (!A.ctx || clock() - A.shotAt < 0.07) return;
    A.shotAt = clock();
    tone({ freq: 640, to: 280, type: 'square', dur: 0.06, vol: 0.045 });
    noise({ dur: 0.04, vol: 0.025, filter: 2400, type: 'highpass' });
  },

  hit() {
    if (!A.ctx || clock() - A.hitAt < 0.05) return;
    A.hitAt = clock();
    noise({ dur: 0.05, vol: 0.05, filter: 3200, type: 'bandpass' });
  },

  kill() {
    if (!A.ctx || clock() - A.killAt < 0.06) return;
    A.killAt = clock();
    tone({ freq: 220, to: 70, type: 'triangle', dur: 0.14, vol: 0.07 });
    noise({ dur: 0.12, vol: 0.08, filter: 900, slide: 240 });
  },

  coin() {
    tone({ freq: 1046, type: 'square', dur: 0.05, vol: 0.045 });
    tone({ freq: 1568, type: 'square', dur: 0.06, vol: 0.035, at: 0.05 });
  },

  gem() {
    tone({ freq: 880, type: 'sine', dur: 0.045, vol: 0.03 });
  },

  hurt() {
    tone({ freq: 190, to: 55, type: 'sawtooth', dur: 0.28, vol: 0.15 });
    noise({ dur: 0.22, vol: 0.13, filter: 1400, slide: 300 });
  },

  heartbeat() {
    tone({ freq: 70, to: 40, type: 'sine', dur: 0.13, vol: 0.2 });
    tone({ freq: 62, to: 34, type: 'sine', dur: 0.15, vol: 0.16, at: 0.2 });
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

  boss() {
    tone({ freq: 90, to: 60, type: 'sawtooth', dur: 0.7, vol: 0.18 });
    noise({ dur: 0.7, vol: 0.1, filter: 400, slide: 120 });
  },

  flame() {
    noise({ dur: 0.35, vol: 0.13, filter: 700, slide: 260, type: 'bandpass' });
    tone({ freq: 120, to: 80, type: 'sawtooth', dur: 0.3, vol: 0.05 });
  },

  mine() {
    noise({ dur: 0.32, vol: 0.18, filter: 1200, slide: 180 });
    tone({ freq: 140, to: 50, type: 'square', dur: 0.25, vol: 0.1 });
  },

  zap() {
    tone({ freq: 1600, to: 320, type: 'square', dur: 0.2, vol: 0.08 });
    noise({ dur: 0.18, vol: 0.07, filter: 3000, slide: 900, type: 'bandpass' });
  },

  heal() {
    tone({ freq: 660, type: 'sine', dur: 0.18, vol: 0.07 });
    tone({ freq: 990, type: 'sine', dur: 0.22, vol: 0.05, at: 0.12 });
  }
};

// ---------------------------------------------------------------- music

// Each track is a bar of sixteen steps: a bass pulse, a lead line, a quiet
// arpeggio and a hat, plus a pad chord on the downbeat.
const TRACKS = {
  menu: {
    bpm: 86,
    bass: [
      45, null, null, null, 43, null, null, null,
      41, null, null, null, 43, null, null, null
    ],
    lead: [
      72, null, 76, null, 79, null, 76, null,
      72, null, 74, null, 71, null, null, null
    ],
    arp: [
      69, 72, 76, 72, 67, 71, 74, 71,
      65, 69, 72, 69, 67, 71, 74, 76
    ],
    hat: [
      0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 1, 0, 0, 0, 1, 1
    ],
    pad: [45, 48, 52]
  },
  battle: {
    bpm: 146,
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
    pad: [40, 43, 47]
  },
  boss: {
    bpm: 158,
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

    if (def.hat && def.hat[index % def.hat.length]) {
      noise({
        dur: 0.03,
        vol: 0.04,
        at,
        filter: 5400,
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

/// Switches the running loop: 'menu', 'battle' or 'boss'. The scene that started
/// the music keeps scheduling it.
export function setMusicTrack(name) {
  if (!track || !name || track.name === name) return;
  track.name = name;
  track.step = 0;
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

  scheduleMusic();
}

export function stopMusic() {
  if (!track) return;
  if (track.timer) track.timer.remove();
  track = null;
}
