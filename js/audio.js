
/* ============================================================
   HOKM PRO v7.0 — PREMIUM AUDIO ENGINE
   Web Audio API | 30+ Sound Effects | Ambient Music
   Compatible with previous HokmAudio API
   ============================================================ */

(function (global) {
  'use strict';

  const NOTES = {
    C3: 130.81, E3: 164.81, G3: 196,
    A3: 220, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63,
    F4: 349.23, G4: 392, A4: 440, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25,
    G5: 783.99, A5: 880, C6: 1046.50
  };

  const CHORDS = [
    [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5],
    [NOTES.A3, NOTES.C4, NOTES.E4, NOTES.A4],
    [NOTES.F4, NOTES.A4, NOTES.C5],
    [NOTES.G3, NOTES.B3, NOTES.D4, NOTES.G4],
    [NOTES.D4, NOTES.F4, NOTES.A4, NOTES.D5],
    [NOTES.E4, NOTES.G4, NOTES.B4, NOTES.E5]
  ];

  const state = {
    ctx: null,
    master: null,
    sfx: null,
    music: null,
    reverb: null,
    initialized: false,
    unlocked: false,
    musicPlaying: false,
    musicEnabled: false,
    sfxEnabled: true,
    sfxVolume: 0.6,
    musicVolume: 0.18,
    chordIndex: 0,
    padNodes: [],
    timers: [],
    arpTimer: null,
    lastPlayed: new Map()
  };

  const storage = () => global.HokmStorage;

  function loadSettings() {
    try {
      const s = storage()?.getSettings?.();
      if (!s) return;

      state.sfxEnabled = s.soundEnabled !== false;
      state.musicEnabled = s.musicEnabled === true;
      state.sfxVolume = (s.sfxVolume ?? 60) / 100;
      state.musicVolume = (s.musicVolume ?? 18) / 100;
    } catch (_) {}
  }

  function saveSettings() {
    try {
      storage()?.updateSettings?.({
        soundEnabled: state.sfxEnabled,
        musicEnabled: state.musicEnabled,
        sfxVolume: Math.round(state.sfxVolume * 100),
        musicVolume: Math.round(state.musicVolume * 100)
      });
    } catch (_) {}
  }

  function init() {
    if (state.initialized) return true;

    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;

      state.ctx = new AC();

      state.master = state.ctx.createGain();
      state.master.gain.value = 0.85;
      state.master.connect(state.ctx.destination);

      state.sfx = state.ctx.createGain();
      state.sfx.gain.value = state.sfxVolume;
      state.sfx.connect(state.master);

      state.music = state.ctx.createGain();
      state.music.gain.value = state.musicVolume;
      state.music.connect(state.master);

      state.reverb = createReverb(2.5, 3);
      state.initialized = true;

      console.log('[HOKM AUDIO] Premium engine ready');
      return true;
    } catch (e) {
      console.warn('[HOKM AUDIO]', e);
      return false;
    }
  }

  function createReverb(duration, decay) {
    const ctx = state.ctx;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] =
          (Math.random() * 2 - 1) *
          Math.pow(1 - i / length, decay);
      }
    }

    const convolver = ctx.createConvolver();
    convolver.buffer = buffer;
    convolver.connect(state.music);
    return convolver;
  }

  function unlock() {
    if (!init()) return;

    if (state.ctx.state === 'suspended') {
      state.ctx.resume().then(() => {
        state.unlocked = true;
        if (state.musicEnabled) startMusicInternal();
      }).catch(() => {});
    } else {
      state.unlocked = true;
      if (state.musicEnabled) startMusicInternal();
    }
  }

  function bindUnlock() {
    const events = ['pointerdown', 'keydown', 'touchstart'];

    const handler = () => {
      unlock();
      if (state.unlocked) {
        events.forEach(e =>
          document.removeEventListener(e, handler, true)
        );
      }
    };

    events.forEach(e =>
      document.addEventListener(e, handler, {
        capture: true,
        passive: true
      })
    );
  }

  function tone(options = {}) {
    if (!state.ctx || !state.sfxEnabled) return;

    const {
      freq = 440,
      duration = 0.12,
      volume = 0.25,
      type = 'sine',
      attack = 0.005,
      release = 0.08,
      delay = 0,
      ramp = null,
      detune = 0
    } = options;

    const ctx = state.ctx;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.value = detune;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(
      0.0001, now + duration + release
    );

    if (ramp) {
      osc.frequency.exponentialRampToValueAtTime(
        ramp, now + duration
      );
    }

    osc.connect(gain);
    gain.connect(state.sfx);

    osc.start(now);
    osc.stop(now + duration + release + 0.03);
  }

  function noise(options = {}) {
    if (!state.ctx || !state.sfxEnabled) return;

    const {
      duration = 0.1,
      volume = 0.2,
      frequency = 1800,
      type = 'lowpass',
      delay = 0
    } = options;

    const ctx = state.ctx;
    const now = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));

    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * fade;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(
      0.0001, now + duration
    );

    source.connect(filter);
    filter.connect(gain);
    gain.connect(state.sfx);

    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function chord(freqs, options = {}) {
    freqs.forEach((freq, i) => {
      tone({
        ...options,
        freq,
        delay: (options.delay || 0) + i * 0.035
      });
    });
  }

  function playOnce(name, fn, cooldown = 35) {
    const now = Date.now();
    const last = state.lastPlayed.get(name) || 0;

    if (now - last < cooldown) return;

    state.lastPlayed.set(name, now);
    fn();
  }

  /* ================= SOUND LIBRARY ================= */

  const SOUNDS = {

    click() {
      tone({ freq: 950, ramp: 1250, duration: 0.045, volume: 0.16 });
    },

    softClick() {
      tone({ freq: 650, duration: 0.045, type: 'triangle', volume: 0.12 });
    },

    modalOpen() {
      tone({ freq: 440, ramp: 660, duration: 0.1, volume: 0.2 });
      tone({ freq: 660, delay: 0.07, duration: 0.13, volume: 0.14 });
    },

    modalClose() {
      tone({ freq: 660, ramp: 440, duration: 0.12, volume: 0.17 });
    },

    notification() {
      tone({ freq: 880, duration: 0.08, volume: 0.18 });
      tone({ freq: 1174.66, delay: 0.09, duration: 0.14, volume: 0.16 });
    },

    playCard() {
      noise({ duration: 0.09, frequency: 2100, type: 'highpass', volume: 0.17 });
      tone({ freq: 180, duration: 0.07, type: 'triangle', volume: 0.13 });
    },

    deal() {
      noise({ duration: 0.055, frequency: 2800, type: 'highpass', volume: 0.13 });
      tone({ freq: 290, duration: 0.05, type: 'triangle', volume: 0.09 });
    },

    shuffle() {
      for (let i = 0; i < 7; i++) {
        noise({
          duration: 0.055,
          frequency: 1900 + i * 180,
          type: 'highpass',
          volume: 0.11,
          delay: i * 0.055
        });
      }
    },

    winTrick() {
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone({ freq: f, duration: 0.17, volume: 0.2, delay: i * 0.105 })
      );
    },

    loseTrick() {
      tone({ freq: 390, ramp: 260, duration: 0.19, volume: 0.16 });
    },

    claimHokm() {
      chord([NOTES.C4, NOTES.E4, NOTES.G4], {
        duration: 0.28, volume: 0.17, type: 'sine'
      });
      tone({ freq: NOTES.C6, duration: 0.35, delay: 0.2, volume: 0.18 });
    },

    pass() {
      tone({ freq: 500, ramp: 390, duration: 0.1, type: 'triangle' });
    },

    win() {
      const melody = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5, NOTES.E5];

      melody.forEach((f, i) => {
        tone({
          freq: f,
          duration: i === 4 ? 0.5 : 0.16,
          volume: 0.21,
          type: 'triangle',
          delay: i * 0.13
        });
      });

      chord([NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5], {
        delay: 0.75, duration: 0.65, volume: 0.14
      });
    },

    lose() {
      [NOTES.G4, NOTES.E4, NOTES.C4].forEach((f, i) => {
        tone({
          freq: f,
          duration: 0.24,
          volume: 0.17,
          delay: i * 0.19
        });
      });
    },

    gameStart() {
      [440, 554.37, 659.25, 880].forEach((f, i) => {
        tone({ freq: f, duration: 0.16, volume: 0.17, delay: i * 0.12 });
      });
    },

    timeout() {
      tone({ freq: 850, ramp: 350, type: 'square', duration: 0.13, volume: 0.12 });
      tone({ freq: 600, ramp: 250, type: 'square', duration: 0.13, delay: 0.16, volume: 0.1 });
    },

    error() {
      tone({ freq: 300, duration: 0.12, type: 'triangle', volume: 0.15 });
      tone({ freq: 220, duration: 0.16, type: 'triangle', delay: 0.12, volume: 0.13 });
    },

    success() {
      tone({ freq: 587.33, duration: 0.1, volume: 0.17 });
      tone({ freq: 880, duration: 0.2, delay: 0.11, volume: 0.19 });
    },

    coin() {
      tone({ freq: 988, duration: 0.07, type: 'sine', volume: 0.16 });
      tone({ freq: 1318.51, duration: 0.12, delay: 0.065, volume: 0.13 });
    },

    chat() {
      tone({ freq: 880, duration: 0.06, volume: 0.12 });
      tone({ freq: 1174.66, duration: 0.08, delay: 0.06, volume: 0.1 });
    },

    tick() {
      tone({ freq: 1200, duration: 0.025, volume: 0.07 });
    },

    countdown() {
      tone({ freq: 1500, duration: 0.08, volume: 0.15 });
      tone({ freq: 1000, duration: 0.1, delay: 0.09, volume: 0.12 });
    },

    achievement() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone({ freq: f, duration: 0.2, volume: 0.17, delay: i * 0.12 });
      });
    },

    turn() {
      tone({ freq: 800, duration: 0.07, volume: 0.15 });
      tone({ freq: 1200, duration: 0.1, delay: 0.07, volume: 0.13 });
    },

    pop() {
      tone({ freq: 400, ramp: 800, duration: 0.06, volume: 0.14 });
    },

    swipe() {
      noise({ duration: 0.1, frequency: 1400, type: 'bandpass', volume: 0.12 });
    },

    goodJob() {
      SOUNDS.success();
    },

    cardSelect() {
      tone({ freq: 720, ramp: 920, duration: 0.07, volume: 0.13 });
    },

    cardPlace() {
      noise({ duration: 0.08, frequency: 1500, type: 'lowpass', volume: 0.15 });
    },

    victory() {
      SOUNDS.win();
    },

    defeat() {
      SOUNDS.lose();
    }
  };

  /* ================= AMBIENT MUSIC ================= */

  function playPad(freqs) {
    if (!state.ctx || !state.musicPlaying) return;

    const ctx = state.ctx;
    const now = ctx.currentTime;

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = i % 2 ? 3 : -3;

      filter.type = 'lowpass';
      filter.frequency.value = 850;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(state.music);
      gain.connect(state.reverb);

      osc.start(now);

      state.padNodes.push({ osc, gain });
    });
  }

  function changeChord() {
    if (!state.musicPlaying) return;

    const ctx = state.ctx;
    const now = ctx.currentTime;

    state.padNodes.forEach(node => {
      try {
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setTargetAtTime(0.0001, now, 1.1);
        node.osc.stop(now + 4);
      } catch (_) {}
    });

    state.padNodes = [];

    state.chordIndex = (state.chordIndex + 1) % CHORDS.length;
    playPad(CHORDS[state.chordIndex]);

    const timer = setTimeout(changeChord, 12000);
    state.timers.push(timer);
  }

  function playArpeggio() {
    if (!state.musicPlaying) return;

    const chord = CHORDS[state.chordIndex];
    const freq = chord[Math.floor(Math.random() * chord.length)];

    const ctx = state.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = freq * (Math.random() < 0.2 ? 2 : 1);

    filter.type = 'lowpass';
    filter.frequency.value = 1600;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(state.music);
    gain.connect(state.reverb);

    osc.start(now);
    osc.stop(now + 2.3);

    state.arpTimer = setTimeout(playArpeggio, 3500 + Math.random() * 1800);
  }

  function startMusicInternal() {
    if (!state.ctx || state.musicPlaying || !state.musicEnabled) return;

    state.musicPlaying = true;
    state.chordIndex = 0;

    playPad(CHORDS[0]);
    state.arpTimer = setTimeout(playArpeggio, 1800);

    const timer = setTimeout(changeChord, 12000);
    state.timers.push(timer);
  }

  function stopMusicInternal() {
    state.musicPlaying = false;

    if (state.arpTimer) clearTimeout(state.arpTimer);
    state.timers.forEach(clearTimeout);
    state.timers = [];

    const now = state.ctx?.currentTime || 0;

    state.padNodes.forEach(node => {
      try {
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setTargetAtTime(0.0001, now, 0.35);
        node.osc.stop(now + 2);
      } catch (_) {}
    });

    state.padNodes = [];
  }

  /* ================= PUBLIC API ================= */

  const Audio = {

    init() {
      loadSettings();
      init();
      bindUnlock();
      return Audio;
    },

    play(name) {
      if (!state.initialized && !init()) return;
      if (!state.sfxEnabled) return;

      if (!state.unlocked) unlock();

      const fn = SOUNDS[name];

      if (typeof fn === 'function') {
        playOnce(name, () => {
          try { fn(); }
          catch (e) { console.warn('[Audio]', name, e); }
        });
      } else {
        console.warn('[Audio] Unknown sound:', name);
      }
    },

    playTone(options) {
      tone(options);
    },

    playNoise(options) {
      noise(options);
    },

    startMusic() {
      state.musicEnabled = true;
      saveSettings();

      if (!state.unlocked) {
        unlock();
        return;
      }

      startMusicInternal();
    },

    stopMusic() {
      state.musicEnabled = false;
      saveSettings();
      stopMusicInternal();
    },

    toggleMusic() {
      state.musicEnabled
        ? Audio.stopMusic()
        : Audio.startMusic();

      return state.musicEnabled;
    },

    isMusicPlaying() {
      return state.musicPlaying;
    },

    setSfxEnabled(enabled) {
      state.sfxEnabled = !!enabled;
      saveSettings();

      const btn = document.getElementById('btnSoundToggle');
      if (btn) btn.textContent = state.sfxEnabled ? '🔊' : '🔇';
    },

    isSfxEnabled() {
      return state.sfxEnabled;
    },

    toggleSfx() {
      Audio.setSfxEnabled(!state.sfxEnabled);
      if (state.sfxEnabled) Audio.play('click');
      return state.sfxEnabled;
    },

    setMusicVolume(value) {
      state.musicVolume = Math.max(0, Math.min(1, Number(value) || 0));
      if (state.music) state.music.gain.setTargetAtTime(
        state.musicVolume, state.ctx.currentTime, 0.04
      );
      saveSettings();
    },

    getMusicVolume() {
      return state.musicVolume;
    },

    setSfxVolume(value) {
      state.sfxVolume = Math.max(0, Math.min(1, Number(value) || 0));
      if (state.sfx) state.sfx.gain.setTargetAtTime(
        state.sfxVolume, state.ctx.currentTime, 0.04
      );
      saveSettings();
    },

    getSfxVolume() {
      return state.sfxVolume;
    },

    setMasterVolume(value) {
      const v = Math.max(0, Math.min(1, Number(value) || 0));
      if (state.master) state.master.gain.setTargetAtTime(
        v, state.ctx.currentTime, 0.04
      );
    },

    getState() {
      return {
        initialized: state.initialized,
        unlocked: state.unlocked,
        musicPlaying: state.musicPlaying,
        sfx: state.sfxEnabled,
        music: state.musicEnabled,
        sfxVolume: state.sfxVolume,
        musicVolume: state.musicVolume
      };
    },

    listSounds() {
      return Object.keys(SOUNDS);
    },

    testAll() {
      const names = Audio.listSounds();
      let index = 0;

      function next() {
        if (index >= names.length) return;

        Audio.play(names[index++]);
        setTimeout(next, 900);
      }

      next();
    },

    playVoiceLine(id) {
      const lines = {
        good_job: 'success',
        nice_play: 'coin',
        give_up: 'error',
        wow: 'notification',
        hello: 'chat',
        thanks: 'softClick',
        sorry: 'loseTrick',
        hurry: 'countdown'
      };

      if (lines[id]) Audio.play(lines[id]);
    },

    destroy() {
      stopMusicInternal();

      if (state.ctx) {
        state.ctx.close().catch(() => {});
      }

      state.ctx = null;
      state.initialized = false;
      state.unlocked = false;
    }
  };

  /* ================= DOM INTEGRATION ================= */

  function attachDOM() {
    const soundBtn = document.getElementById('btnSoundToggle');

    if (soundBtn && !soundBtn.dataset.bound) {
      soundBtn.dataset.bound = '1';
      soundBtn.textContent = state.sfxEnabled ? '🔊' : '🔇';
      soundBtn.addEventListener('click', () => Audio.toggleSfx());
    }

    const sfxToggle = document.getElementById('sfxToggle');

    if (sfxToggle && !sfxToggle.dataset.bound) {
      sfxToggle.dataset.bound = '1';
      sfxToggle.checked = state.sfxEnabled;

      sfxToggle.addEventListener('change', e => {
        Audio.setSfxEnabled(e.target.checked);
        if (e.target.checked) Audio.play('click');
      });
    }

    const musicToggle = document.getElementById('musicToggle');

    if (musicToggle && !musicToggle.dataset.bound) {
      musicToggle.dataset.bound = '1';
      musicToggle.checked = state.musicEnabled;

      musicToggle.addEventListener('change', e => {
        if (e.target.checked) Audio.startMusic();
        else Audio.stopMusic();
      });
    }

    const musicVol = document.getElementById('musicVolume');

    if (musicVol && !musicVol.dataset.bound) {
      musicVol.dataset.bound = '1';
      musicVol.value = Math.round(state.musicVolume * 100);

      musicVol.addEventListener('input', e => {
        Audio.setMusicVolume(e.target.value / 100);
      });
    }

    const sfxVol = document.getElementById('sfxVolume');

    if (sfxVol && !sfxVol.dataset.bound) {
      sfxVol.dataset.bound = '1';
      sfxVol.value = Math.round(state.sfxVolume * 100);

      sfxVol.addEventListener('input', e => {
        Audio.setSfxVolume(e.target.value / 100);
      });
    }

    document.addEventListener('click', e => {
      const btn = e.target.closest(
        '.btn, .icon-btn, .tab, .menu-card, .chip'
      );

      if (btn && !btn.dataset.noSound) {
        Audio.play('softClick');
      }
    }, { passive: true });
  }

  function bootstrap() {
    Audio.init();
    attachDOM();

    console.log(
      `%c HOKM PRO AUDIO v7.0 — ${Audio.listSounds().length} sounds ready `,
      'background:#171717;color:#d4af37;padding:8px;font-weight:bold'
    );
  }

  global.HokmAudio = Audio;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
      bootstrap();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
