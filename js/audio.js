/* ═══════════════════════════════════════════════════════════
   🔊 HOKM PRO v6.0 — audio.js
   موتور صدای Web Audio API — ۲۴ صدا + موسیقی Ambient
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const NOTE_FREQS = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25,
    D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00
  };

  // گام دو ماژور برای موسیقی پس‌زمینه
  const MAJOR_SCALE = [
    NOTE_FREQS.C4, NOTE_FREQS.D4, NOTE_FREQS.E4,
    NOTE_FREQS.F4, NOTE_FREQS.G4, NOTE_FREQS.A4,
    NOTE_FREQS.B4, NOTE_FREQS.C5
  ];

  // آکوردهای محیطی برای Ambient
  const AMBIENT_CHORDS = [
    [NOTE_FREQS.C4, NOTE_FREQS.E4, NOTE_FREQS.G4],
    [NOTE_FREQS.A4, NOTE_FREQS.C5, NOTE_FREQS.E5],
    [NOTE_FREQS.F4, NOTE_FREQS.A4, NOTE_FREQS.C5],
    [NOTE_FREQS.G4, NOTE_FREQS.B4, NOTE_FREQS.D5]
  ];

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    ctx: null,
    masterGain: null,
    sfxGain: null,
    musicGain: null,
    initialized: false,
    unlocked: false,
    musicPlaying: false,
    musicTimer: null,
    musicNotesTimer: null,
    ambientPadNodes: [],
    enabled: {
      sfx: true,
      music: false
    },
    volumes: {
      sfx: 0.6,
      music: 0.15
    },
    activeSounds: new Set()
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _getStorage() {
    return global.HokmStorage || null;
  }

  function _loadFromStorage() {
    const storage = _getStorage();
    if (!storage) return;

    const s = storage.getSettings();
    state.enabled.sfx = s.soundEnabled !== false;
    state.enabled.music = s.musicEnabled === true;
    state.volumes.sfx = (s.sfxVolume ?? 60) / 100;
    state.volumes.music = (s.musicVolume ?? 15) / 100;
  }

  function _saveToStorage() {
    const storage = _getStorage();
    if (!storage) return;

    storage.updateSettings({
      soundEnabled: state.enabled.sfx,
      musicEnabled: state.enabled.music,
      sfxVolume: Math.round(state.volumes.sfx * 100),
      musicVolume: Math.round(state.volumes.music * 100)
    });
  }

  /* ─────────────────────────────────────────────
     راه‌اندازی Audio Context
     ───────────────────────────────────────────── */
  function _init() {
    if (state.initialized) return true;

    try {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) {
        console.warn('[Audio] Web Audio API پشتیبانی نمی‌شود');
        return false;
      }

      state.ctx = new Ctx();

      // Master Gain
      state.masterGain = state.ctx.createGain();
      state.masterGain.gain.value = 1;
      state.masterGain.connect(state.ctx.destination);

      // SFX Gain
      state.sfxGain = state.ctx.createGain();
      state.sfxGain.gain.value = state.volumes.sfx;
      state.sfxGain.connect(state.masterGain);

      // Music Gain
      state.musicGain = state.ctx.createGain();
      state.musicGain.gain.value = state.volumes.music;
      state.musicGain.connect(state.masterGain);

      state.initialized = true;
      console.log('%c🔊 Audio Context ready', 'color: #06d6a0;');
      return true;
    } catch (e) {
      console.warn('[Audio] Init error:', e);
      return false;
    }
  }

  /**
   * Unlock در اولین تعامل کاربر (سیاست مرورگرها)
   */
  function _unlock() {
    if (state.unlocked) return;

    if (!state.ctx) {
      _init();
    }

    if (state.ctx && state.ctx.state === 'suspended') {
      state.ctx.resume().then(() => {
        state.unlocked = true;
        console.log('%c🔓 Audio unlocked', 'color: #06d6a0;');
        if (state.enabled.music) {
          _startMusic();
        }
      }).catch(() => {});
    } else if (state.ctx) {
      state.unlocked = true;
    }
  }

  function _bindUnlockEvents() {
    const events = ['click', 'touchstart', 'keydown', 'pointerdown'];
    const handler = () => {
      _unlock();
      events.forEach(ev => document.removeEventListener(ev, handler, true));
    };
    events.forEach(ev => document.addEventListener(ev, handler, { capture: true, once: false }));
  }

  /* ─────────────────────────────────────────────
     ساخت صداهای پایه
     ───────────────────────────────────────────── */

  /**
   * پخش یک تن ساده
   */
  function _playTone({
    freq = 440,
    duration = 0.15,
    type = 'sine',
    volume = 0.4,
    attack = 0.005,
    release = 0.08,
    delay = 0,
    destination = null,
    detune = 0,
    frequencyRamp = null
  }) {
    if (!state.ctx || !state.enabled.sfx) return null;

    const ctx = state.ctx;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;

    // Attack/Release
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration + release);

    // Ramp فرکانس (اختیاری)
    if (frequencyRamp) {
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(
        frequencyRamp.to,
        now + (frequencyRamp.duration || duration)
      );
    }

    osc.connect(gain);
    gain.connect(destination || state.sfxGain);

    osc.start(now);
    osc.stop(now + duration + release + 0.02);

    return { osc, gain };
  }

  /**
   * پخش نویز (برای صداهای خش‌دار)
   */
  function _playNoise({
    duration = 0.15,
    volume = 0.3,
    filterFreq = 1000,
    filterType = 'bandpass',
    delay = 0,
    destination = null
  }) {
    if (!state.ctx || !state.enabled.sfx) return null;

    const ctx = state.ctx;
    const now = ctx.currentTime + delay;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination || state.sfxGain);

    source.start(now);
    source.stop(now + duration + 0.02);

    return { source, gain };
  }

  /**
   * پخش آکورد (چند تن همزمان)
   */
  function _playChord(freqs, options) {
    freqs.forEach((f, i) => {
      _playTone({ ...options, freq: f, delay: (options.delay || 0) + i * 0.02 });
    });
  }

  /* ═══════════════════════════════════════════
     ۲۴ صدا — تعریف کامل
     ═══════════════════════════════════════════ */

  const SOUNDS = {

    /* ─── UI (۵ صدا) ─── */
    click() {
      _playTone({
        freq: 800, duration: 0.06, type: 'sine', volume: 0.3,
        frequencyRamp: { to: 1200, duration: 0.04 }
      });
    },

    softClick() {
      _playTone({
        freq: 600, duration: 0.05, type: 'triangle', volume: 0.2
      });
    },

    modalOpen() {
      _playTone({
        freq: 440, duration: 0.1, type: 'sine', volume: 0.25,
        frequencyRamp: { to: 660, duration: 0.08 }
      });
      _playTone({ freq: 660, duration: 0.12, type: 'sine', volume: 0.15, delay: 0.06 });
    },

    modalClose() {
      _playTone({
        freq: 660, duration: 0.1, type: 'sine', volume: 0.2,
        frequencyRamp: { to: 440, duration: 0.08 }
      });
    },

    notification() {
      _playTone({ freq: 880, duration: 0.08, type: 'sine', volume: 0.28 });
      _playTone({ freq: 1320, duration: 0.14, type: 'sine', volume: 0.22, delay: 0.08 });
    },

    /* ─── بازی (۶ صدا) ─── */
    playCard() {
      // صدای پرتاب کارت
      _playNoise({
        duration: 0.08,
        volume: 0.35,
        filterFreq: 2500,
        filterType: 'highpass'
      });
      _playTone({
        freq: 220, duration: 0.08, type: 'triangle', volume: 0.25
      });
    },

    deal() {
      // صدای توزیع کارت
      _playNoise({
        duration: 0.05,
        volume: 0.25,
        filterFreq: 3000,
        filterType: 'highpass'
      });
      _playTone({
        freq: 350, duration: 0.05, type: 'triangle', volume: 0.15
      });
    },

    winTrick() {
      // بالا رفتن جشن‌وار
      _playTone({ freq: 523.25, duration: 0.12, type: 'sine', volume: 0.35 });
      _playTone({ freq: 659.25, duration: 0.12, type: 'sine', volume: 0.3, delay: 0.1 });
      _playTone({ freq: 783.99, duration: 0.2, type: 'sine', volume: 0.35, delay: 0.2 });
    },

    loseTrick() {
      _playTone({
        freq: 400, duration: 0.15, type: 'sine', volume: 0.25,
        frequencyRamp: { to: 280, duration: 0.15 }
      });
    },

    claimHokm() {
      // صدای حکم‌خوانی — اعلا و باشکوه
      _playChord([NOTE_FREQS.C4, NOTE_FREQS.E4, NOTE_FREQS.G4], {
        duration: 0.25, type: 'sine', volume: 0.3
      });
      _playTone({
        freq: 1046.50, duration: 0.4, type: 'sine', volume: 0.35, delay: 0.15
      });
    },

    pass() {
      _playTone({
        freq: 500, duration: 0.1, type: 'triangle', volume: 0.2,
        frequencyRamp: { to: 400, duration: 0.08 }
      });
    },

    /* ─── پایان (۴ صدا) ─── */
    win() {
      // موسیقی پیروزی
      const notes = [
        { f: NOTE_FREQS.C4, d: 0.15 },
        { f: NOTE_FREQS.E4, d: 0.15 },
        { f: NOTE_FREQS.G4, d: 0.15 },
        { f: NOTE_FREQS.C5, d: 0.35 }
      ];
      let t = 0;
      notes.forEach(n => {
        _playTone({
          freq: n.f, duration: n.d, type: 'triangle', volume: 0.35, delay: t
        });
        t += n.d * 0.85;
      });
      // آکورد پایانی
      setTimeout(() => {
        _playChord([NOTE_FREQS.C4, NOTE_FREQS.E4, NOTE_FREQS.G4, NOTE_FREQS.C5], {
          duration: 0.6, type: 'sine', volume: 0.25
        });
      }, 700);
    },

    lose() {
      // پایین رفتن
      const notes = [
        { f: NOTE_FREQS.G4, d: 0.2 },
        { f: NOTE_FREQS.E4, d: 0.2 },
        { f: NOTE_FREQS.C4, d: 0.4 }
      ];
      let t = 0;
      notes.forEach(n => {
        _playTone({
          freq: n.f, duration: n.d, type: 'sine', volume: 0.28, delay: t
        });
        t += n.d * 0.9;
      });
    },

    gameStart() {
      // صدای شروع بازی
      _playTone({ freq: 440, duration: 0.1, type: 'sine', volume: 0.3 });
      _playTone({ freq: 660, duration: 0.1, type: 'sine', volume: 0.3, delay: 0.1 });
      _playTone({ freq: 880, duration: 0.25, type: 'sine', volume: 0.35, delay: 0.2 });
    },

    timeout() {
      // صدای اتمام وقت
      _playTone({
        freq: 800, duration: 0.15, type: 'square', volume: 0.25,
        frequencyRamp: { to: 300, duration: 0.15 }
      });
      _playTone({
        freq: 600, duration: 0.15, type: 'square', volume: 0.2, delay: 0.15,
        frequencyRamp: { to: 200, duration: 0.15 }
      });
    },

    /* ─── سیستم (۳ صدا) ─── */
    error() {
      _playTone({
        freq: 300, duration: 0.12, type: 'sawtooth', volume: 0.22
      });
      _playTone({
        freq: 200, duration: 0.18, type: 'sawtooth', volume: 0.2, delay: 0.1
      });
    },

    success() {
      _playTone({ freq: 587.33, duration: 0.1, type: 'sine', volume: 0.3 });
      _playTone({ freq: 880, duration: 0.2, type: 'sine', volume: 0.32, delay: 0.1 });
    },

    coin() {
      // صدای سکه
      _playTone({
        freq: 988, duration: 0.08, type: 'square', volume: 0.25
      });
      _playTone({
        freq: 1318.51, duration: 0.15, type: 'square', volume: 0.22, delay: 0.06
      });
    },

    /* ─── چت (۱ صدا) ─── */
    chat() {
      _playTone({ freq: 880, duration: 0.06, type: 'sine', volume: 0.2 });
      _playTone({ freq: 1174.66, duration: 0.08, type: 'sine', volume: 0.18, delay: 0.05 });
    },

    /* ─── تایمر (۲ صدا) ─── */
    tick() {
      _playTone({
        freq: 1200, duration: 0.03, type: 'sine', volume: 0.12
      });
    },

    countdown() {
      _playTone({
        freq: 1500, duration: 0.08, type: 'sine', volume: 0.25
      });
      _playTone({
        freq: 1000, duration: 0.1, type: 'sine', volume: 0.2, delay: 0.08
      });
    },

    /* ─── ویژه (۳ صدا اضافی) ─── */
    achievement() {
      // صدای باز شدن دستاورد — باشکوه
      const melody = [
        { f: 523.25, d: 0.12 },
        { f: 659.25, d: 0.12 },
        { f: 783.99, d: 0.12 },
        { f: 1046.50, d: 0.3 }
      ];
      let t = 0;
      melody.forEach(n => {
        _playTone({
          freq: n.f, duration: n.d, type: 'triangle', volume: 0.3, delay: t
        });
        t += n.d * 0.9;
      });
      // درخشش پایانی
      setTimeout(() => {
        _playChord([1046.50, 1318.51, 1567.98], {
          duration: 0.5, type: 'sine', volume: 0.2
        });
      }, 600);
    },

    shuffle() {
      // صدای بُر زدن کارت‌ها
      for (let i = 0; i < 5; i++) {
        _playNoise({
          duration: 0.05,
          volume: 0.2,
          filterFreq: 3000 + i * 500,
          delay: i * 0.04
        });
      }
    },

    turn() {
      // نوبت تو شد
      _playTone({ freq: 800, duration: 0.08, type: 'sine', volume: 0.28 });
      _playTone({ freq: 1200, duration: 0.12, type: 'sine', volume: 0.25, delay: 0.06 });
    },

    /* ─── چیپس/اعلان کوچک ─── */
    pop() {
      _playTone({
        freq: 400, duration: 0.05, type: 'sine', volume: 0.25,
        frequencyRamp: { to: 800, duration: 0.04 }
      });
    },

    swipe() {
      _playNoise({
        duration: 0.1,
        volume: 0.2,
        filterFreq: 1500,
        filterType: 'bandpass'
      });
    }
  };

  /* ─────────────────────────────────────────────
     موسیقی پس‌زمینه Ambient
     ───────────────────────────────────────────── */
  function _startMusic() {
    if (!state.ctx || state.musicPlaying) return;
    if (!state.enabled.music) return;

    state.musicPlaying = true;

    // Pad ثابت
    _startAmbientPad();

    // نت‌های تصادفی
    _scheduleAmbientNotes();

    console.log('%c🎵 Ambient music started', 'color: #9b5de5;');
  }

  function _stopMusic() {
    if (!state.musicPlaying) return;
    state.musicPlaying = false;

    // قطع Pad
    state.ambientPadNodes.forEach(node => {
      try {
        node.gain.gain.exponentialRampToValueAtTime(
          0.001,
          state.ctx.currentTime + 0.5
        );
        setTimeout(() => {
          try { node.osc.stop(); } catch (e) {}
        }, 600);
      } catch (e) {}
    });
    state.ambientPadNodes = [];

    // قطع تایمر نت‌ها
    if (state.musicNotesTimer) {
      clearTimeout(state.musicNotesTimer);
      state.musicNotesTimer = null;
    }

    console.log('%c🎵 Ambient music stopped', 'color: #6b7280;');
  }

  function _startAmbientPad() {
    if (!state.ctx) return;

    const ctx = state.ctx;
    const chord = AMBIENT_CHORDS[Math.floor(Math.random() * AMBIENT_CHORDS.length)];

    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = freq;

      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(state.musicGain);

      osc.start();

      state.ambientPadNodes.push({ osc, gain, filter });
    });
  }

  function _scheduleAmbientNotes() {
    if (!state.musicPlaying) return;

    // زمان تصادفی بین ۲ تا ۳.۵ ثانیه
    const delay = 2000 + Math.random() * 1500;

    state.musicNotesTimer = setTimeout(() => {
      if (!state.musicPlaying) return;
      _playAmbientNote();
      _scheduleAmbientNotes();
    }, delay);
  }

  function _playAmbientNote() {
    if (!state.ctx || !state.musicPlaying) return;

    const ctx = state.ctx;
    const now = ctx.currentTime;

    // نت تصادفی از گام
    const freq = MAJOR_SCALE[Math.floor(Math.random() * MAJOR_SCALE.length)];
    // در یکی از ۲ اکتاو مختلف
    const octave = Math.random() < 0.5 ? 1 : 2;
    const finalFreq = freq * octave;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = Math.random() < 0.5 ? 'sine' : 'triangle';
    osc.frequency.value = finalFreq;

    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    const duration = 1.5 + Math.random() * 1.5;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(state.musicGain);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Audio = {

    /**
     * راه‌اندازی
     */
    init() {
      _init();
      _bindUnlockEvents();
      _loadFromStorage();
      return Audio;
    },

    /**
     * پخش یک صدا بر اساس نام
     */
    play(name) {
      if (!state.initialized) {
        if (!_init()) return;
      }

      if (!state.enabled.sfx) return;

      // اگر هنوز unlock نشده، تلاش کن
      if (!state.unlocked) {
        _unlock();
      }

      const fn = SOUNDS[name];
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (e) {
          console.warn(`[Audio] Error playing "${name}":`, e);
        }
      } else {
        console.warn(`[Audio] Unknown sound: "${name}"`);
      }
    },

    /**
     * پخش مستقیم با تنظیمات سفارشی
     */
    playTone(options) {
      _playTone(options);
    },

    playNoise(options) {
      _playNoise(options);
    },

    /* ─── موسیقی ─── */

    startMusic() {
      state.enabled.music = true;
      _saveToStorage();

      if (!state.unlocked) {
        // تلاش برای unlock
        _unlock();
        return;
      }

      _startMusic();
    },

    stopMusic() {
      state.enabled.music = false;
      _saveToStorage();
      _stopMusic();
    },

    toggleMusic() {
      if (state.enabled.music) {
        Audio.stopMusic();
      } else {
        Audio.startMusic();
      }
      return state.enabled.music;
    },

    isMusicPlaying() {
      return state.musicPlaying;
    },

    /* ─── تنظیمات ─── */

    setSfxEnabled(enabled) {
      state.enabled.sfx = !!enabled;
      _saveToStorage();

      const btn = document.getElementById('btnSoundToggle');
      if (btn) {
        btn.textContent = state.enabled.sfx ? '🔊' : '🔇';
      }
    },

    isSfxEnabled() {
      return state.enabled.sfx;
    },

    toggleSfx() {
      Audio.setSfxEnabled(!state.enabled.sfx);
      if (state.enabled.sfx) {
        Audio.play('click');
      }
      return state.enabled.sfx;
    },

    setMusicVolume(vol) {
      state.volumes.music = Math.max(0, Math.min(1, vol));
      if (state.musicGain) {
        state.musicGain.gain.value = state.volumes.music;
      }
      _saveToStorage();
    },

    getMusicVolume() {
      return state.volumes.music;
    },

    setSfxVolume(vol) {
      state.volumes.sfx = Math.max(0, Math.min(1, vol));
      if (state.sfxGain) {
        state.sfxGain.gain.value = state.volumes.sfx;
      }
      _saveToStorage();
    },

    getSfxVolume() {
      return state.volumes.sfx;
    },

    setMasterVolume(vol) {
      const v = Math.max(0, Math.min(1, vol));
      if (state.masterGain) {
        state.masterGain.gain.value = v;
      }
    },

    /* ─── وضعیت ─── */

    getState() {
      return {
        initialized: state.initialized,
        unlocked: state.unlocked,
        musicPlaying: state.musicPlaying,
        sfx: state.enabled.sfx,
        music: state.enabled.music,
        sfxVolume: state.volumes.sfx,
        musicVolume: state.volumes.music
      };
    },

    /**
     * لیست صداهای موجود
     */
    listSounds() {
      return Object.keys(SOUNDS);
    },

    /**
     * تست پخش همه صداها (فقط برای دیباگ)
     */
    testAll() {
      const names = Audio.listSounds();
      let i = 0;
      const next = () => {
        if (i >= names.length) return;
        console.log(`🔊 ${names[i]}`);
        Audio.play(names[i]);
        i++;
        setTimeout(next, 500);
      };
      next();
    },

    /**
     * صداهای از پیش ضبط شده برای چت
     */
    playVoiceLine(id) {
      const voiceLines = {
        'good_job':   () => Audio.play('success'),
        'nice_play':  () => Audio.play('coin'),
        'give_up':    () => Audio.play('error'),
        'wow':        () => Audio.play('notification'),
        'hello':      () => Audio.play('chat'),
        'thanks':     () => Audio.play('softClick'),
        'sorry':      () => Audio.play('loseTrick'),
        'hurry':      () => Audio.play('countdown')
      };

      const fn = voiceLines[id];
      if (fn) fn();
    },

    /**
     * حذف صدا و کلین‌آپ
     */
    destroy() {
      _stopMusic();
      if (state.ctx) {
        try {
          state.ctx.close();
        } catch (e) {}
      }
      state.ctx = null;
      state.initialized = false;
      state.unlocked = false;
    }
  };

  /* ─────────────────────────────────────────────
     اتصال به DOM
     ───────────────────────────────────────────── */
  function _attachToDOM() {
    // دکمه صدای Top Bar
    const soundBtn = document.getElementById('btnSoundToggle');
    if (soundBtn && !soundBtn.dataset.bound) {
      soundBtn.dataset.bound = '1';
      soundBtn.textContent = state.enabled.sfx ? '🔊' : '🔇';
      soundBtn.addEventListener('click', () => {
        Audio.toggleSfx();
      });
    }

    // Toggle صدا در تنظیمات
    const sfxToggle = document.getElementById('sfxToggle');
    if (sfxToggle && !sfxToggle.dataset.bound) {
      sfxToggle.dataset.bound = '1';
      sfxToggle.checked = state.enabled.sfx;
      sfxToggle.addEventListener('change', (e) => {
        Audio.setSfxEnabled(e.target.checked);
        if (e.target.checked) Audio.play('click');
      });
    }

    // Toggle موسیقی
    const musicToggle = document.getElementById('musicToggle');
    if (musicToggle && !musicToggle.dataset.bound) {
      musicToggle.dataset.bound = '1';
      musicToggle.checked = state.enabled.music;
      musicToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          Audio.startMusic();
        } else {
          Audio.stopMusic();
        }
      });
    }

    // Slider صدای موسیقی
    const musicVol = document.getElementById('musicVolume');
    if (musicVol && !musicVol.dataset.bound) {
      musicVol.dataset.bound = '1';
      musicVol.value = Math.round(state.volumes.music * 100);
      musicVol.addEventListener('input', (e) => {
        Audio.setMusicVolume(e.target.value / 100);
      });
    }

    // Slider صدای افکت‌ها
    const sfxVol = document.getElementById('sfxVolume');
    if (sfxVol && !sfxVol.dataset.bound) {
      sfxVol.dataset.bound = '1';
      sfxVol.value = Math.round(state.volumes.sfx * 100);
      sfxVol.addEventListener('input', (e) => {
        Audio.setSfxVolume(e.target.value / 100);
      });
      sfxVol.addEventListener('change', () => {
        Audio.play('click');
      });
    }

    // Global click صدا
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn, .icon-btn, .tab, .menu-card, .chip');
      if (btn && !btn.dataset.noSound) {
        Audio.play('softClick');
      }
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    Audio.init();
    _attachToDOM();

    console.log(
      `%c🔊 Audio v6.0 ready — ${Audio.listSounds().length} sounds`,
      'color: #ffd60a; font-weight: bold;'
    );
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmAudio = Audio;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);