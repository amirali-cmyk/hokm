
/* ═══════════════════════════════════════════════════════════
   HOKM PRO v7.0 — audio.js
   Web Audio API — ۲۷ افکت صوتی + Original Luxury Ambient
   Music: Calm / Elegant / Premium
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     تنظیمات نت‌ها و موسیقی
     ═══════════════════════════════════════════════════════════ */

  const NOTE_FREQS = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
    G3: 196.00, A3: 220.00, B3: 246.94,

    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,

    C5: 523.25, D5: 587.33, E5: 659.25,
    F5: 698.46, G5: 783.99, A5: 880.00,
    B5: 987.77
  };

  const MAJOR_SCALE = [
    NOTE_FREQS.D4,
    NOTE_FREQS.E4,
    NOTE_FREQS.F4 * 1.05946,
    NOTE_FREQS.G4,
    NOTE_FREQS.A4,
    NOTE_FREQS.B4,
    NOTE_FREQS.C5 * 1.05946,
    NOTE_FREQS.D5
  ];

  // آکوردهای اصلی موسیقی اختصاصی
  // Dmaj9 — Bm9 — Gmaj7 — Aadd9
  const LUXURY_CHORDS = [
    [50, 57, 62, 66, 69],
    [47, 54, 57, 62, 66],
    [43, 50, 55, 59, 62],
    [45, 52, 57, 59, 64]
  ];

  // ملودی اصلی؛ نت‌ها بر اساس شماره MIDI
  const LUXURY_MELODY = [
    [74, 76, 81, 78, 76, 74, 69, null],
    [71, 74, 78, 81, 78, 74, 71, null],
    [79, 78, 74, 71, 74, 76, 74, null],
    [76, 78, 81, 83, 81, 78, 76, null]
  ];

  const MUSIC_BPM = 76;
  const MUSIC_BEAT = 60 / MUSIC_BPM;
  const MUSIC_BAR = MUSIC_BEAT * 4;

  /* ═══════════════════════════════════════════════════════════
     وضعیت موتور صدا
     ═══════════════════════════════════════════════════════════ */

  const state = {
    ctx: null,

    masterGain: null,
    sfxGain: null,
    musicGain: null,
    reverbNode: null,

    initialized: false,
    unlocked: false,

    musicPlaying: false,
    musicTimers: [],
    musicNodes: [],

    currentChordIndex: 0,
    musicBarIndex: 0,

    enabled: {
      sfx: true,
      music: false
    },

    volumes: {
      sfx: 0.6,
      music: 0.22,
      master: 1
    }
  };

  let unlockEventsBound = false;
  let domEventsBound = false;

  /* ═══════════════════════════════════════════════════════════
     ابزارهای عمومی داخلی
     ═══════════════════════════════════════════════════════════ */

  function _storage() {
    return global.HokmStorage;
  }

  function _loadFromStorage() {
    try {
      const storage = _storage();
      if (!storage || typeof storage.getSettings !== 'function') return;

      const settings = storage.getSettings() || {};

      state.enabled.sfx = settings.soundEnabled !== false;
      state.enabled.music = settings.musicEnabled === true;

      state.volumes.sfx =
        Math.max(0, Math.min(1, (settings.sfxVolume ?? 60) / 100));

      state.volumes.music =
        Math.max(0, Math.min(1, (settings.musicVolume ?? 22) / 100));

    } catch (error) {
      console.warn('[Audio] Storage read error:', error);
    }
  }

  function _saveToStorage() {
    try {
      const storage = _storage();

      if (!storage || typeof storage.updateSettings !== 'function') return;

      storage.updateSettings({
        soundEnabled: state.enabled.sfx,
        musicEnabled: state.enabled.music,
        sfxVolume: Math.round(state.volumes.sfx * 100),
        musicVolume: Math.round(state.volumes.music * 100)
      });

    } catch (error) {
      console.warn('[Audio] Storage save error:', error);
    }
  }

  function _clamp(value, min = 0, max = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function _midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /* ═══════════════════════════════════════════════════════════
     راه‌اندازی Audio Context
     ═══════════════════════════════════════════════════════════ */

  function _init() {
    if (state.initialized) return true;

    try {
      const AudioContextClass =
        global.AudioContext || global.webkitAudioContext;

      if (!AudioContextClass) {
        console.warn('[Audio] Web Audio API پشتیبانی نمی‌شود');
        return false;
      }

      state.ctx = new AudioContextClass();

      state.masterGain = state.ctx.createGain();
      state.masterGain.gain.value = state.volumes.master;
      state.masterGain.connect(state.ctx.destination);

      state.sfxGain = state.ctx.createGain();
      state.sfxGain.gain.value = state.volumes.sfx;
      state.sfxGain.connect(state.masterGain);

      state.musicGain = state.ctx.createGain();
      state.musicGain.gain.value = state.volumes.music;

      state.reverbNode = _createReverb(3.5, 2.5);
      state.reverbNode.connect(state.musicGain);

      state.musicGain.connect(state.masterGain);

      state.initialized = true;

      console.log(
        '%c🔊 HOKM PRO Audio Engine Ready',
        'color:#06d6a0;font-weight:bold;'
      );

      return true;

    } catch (error) {
      console.warn('[Audio] Init error:', error);
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Reverb
     ═══════════════════════════════════════════════════════════ */

  function _createReverb(duration, decay) {
    const ctx = state.ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);

    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        const fade = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * fade;
      }
    }

    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;

    return convolver;
  }

  /* ═══════════════════════════════════════════════════════════
     باز کردن قفل Audio در مرورگر
     ═══════════════════════════════════════════════════════════ */

  function _unlock() {
    if (!state.ctx && !_init()) return;

    if (!state.ctx) return;

    if (state.ctx.state === 'suspended') {
      state.ctx.resume()
        .then(() => {
          state.unlocked = true;

          console.log(
            '%c🔓 Audio Unlocked',
            'color:#06d6a0;'
          );

          if (state.enabled.music) {
            _startMusic();
          }
        })
        .catch(error => {
          console.warn('[Audio] Unlock error:', error);
        });

    } else {
      state.unlocked = true;

      if (state.enabled.music) {
        _startMusic();
      }
    }
  }

  function _bindUnlockEvents() {
    if (
      unlockEventsBound ||
      typeof document === 'undefined'
    ) return;

    unlockEventsBound = true;

    const events = [
      'pointerdown',
      'touchstart',
      'keydown',
      'click'
    ];

    const handler = () => {
      _unlock();

      events.forEach(eventName => {
        document.removeEventListener(
          eventName,
          handler,
          true
        );
      });

      unlockEventsBound = false;
    };

    events.forEach(eventName => {
      document.addEventListener(
        eventName,
        handler,
        {
          capture: true,
          passive: true
        }
      );
    });
  }

  /* ═══════════════════════════════════════════════════════════
     پخش تن ساده — افکت‌های بازی
     ═══════════════════════════════════════════════════════════ */

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
  } = {}) {
    if (!state.ctx || !state.enabled.sfx) return null;

    try {
      const ctx = state.ctx;
      const now = ctx.currentTime + Math.max(0, delay);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;

      const safeAttack = Math.max(0.001, attack);
      const safeDuration = Math.max(0.01, duration);
      const safeRelease = Math.max(0.01, release);

      gain.gain.setValueAtTime(0.0001, now);

      gain.gain.linearRampToValueAtTime(
        Math.max(0.0001, volume),
        now + safeAttack
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + safeAttack + safeDuration + safeRelease
      );

      if (frequencyRamp && frequencyRamp.to) {
        osc.frequency.setValueAtTime(freq, now);

        osc.frequency.exponentialRampToValueAtTime(
          frequencyRamp.to,
          now + Math.max(
            0.01,
            frequencyRamp.duration || safeDuration
          )
        );
      }

      osc.connect(gain);
      gain.connect(destination || state.sfxGain);

      osc.start(now);
      osc.stop(now + safeAttack + safeDuration + safeRelease + 0.03);

      return { osc, gain };

    } catch (error) {
      console.warn('[Audio] Tone error:', error);
      return null;
    }
  }

  function _playNoise({
    duration = 0.15,
    volume = 0.3,
    filterFreq = 1000,
    filterType = 'bandpass',
    delay = 0,
    destination = null
  } = {}) {
    if (!state.ctx || !state.enabled.sfx) return null;

    try {
      const ctx = state.ctx;
      const now = ctx.currentTime + Math.max(0, delay);

      const safeDuration = Math.max(0.01, duration);
      const bufferSize = Math.floor(ctx.sampleRate * safeDuration);

      const buffer = ctx.createBuffer(
        1,
        bufferSize,
        ctx.sampleRate
      );

      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] =
          (Math.random() * 2 - 1) *
          (1 - i / bufferSize);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      filter.Q.value = 1;

      const gain = ctx.createGain();

      gain.gain.setValueAtTime(volume, now);

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + safeDuration
      );

      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination || state.sfxGain);

      source.start(now);
      source.stop(now + safeDuration + 0.03);

      return { source, gain };

    } catch (error) {
      console.warn('[Audio] Noise error:', error);
      return null;
    }
  }

  function _playChord(freqs, options = {}) {
    freqs.forEach((frequency, index) => {
      _playTone({
        ...options,
        freq: frequency,
        delay: (options.delay || 0) + index * 0.02
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     افکت‌های صوتی بازی
     ═══════════════════════════════════════════════════════════ */

  const SOUNDS = {

    click() {
      _playTone({
        freq: 800,
        duration: 0.06,
        volume: 0.3,
        frequencyRamp: { to: 1200, duration: 0.04 }
      });
    },

    softClick() {
      _playTone({
        freq: 600,
        duration: 0.05,
        type: 'triangle',
        volume: 0.2
      });
    },

    modalOpen() {
      _playTone({
        freq: 440,
        duration: 0.1,
        volume: 0.25,
        frequencyRamp: { to: 660, duration: 0.08 }
      });

      _playTone({
        freq: 660,
        duration: 0.12,
        volume: 0.15,
        delay: 0.06
      });
    },

    modalClose() {
      _playTone({
        freq: 660,
        duration: 0.1,
        volume: 0.2,
        frequencyRamp: { to: 440, duration: 0.08 }
      });
    },

    notification() {
      _playTone({
        freq: 880,
        duration: 0.08,
        volume: 0.28
      });

      _playTone({
        freq: 1320,
        duration: 0.14,
        volume: 0.22,
        delay: 0.08
      });
    },

    playCard() {
      _playNoise({
        duration: 0.08,
        volume: 0.35,
        filterFreq: 2500,
        filterType: 'highpass'
      });

      _playTone({
        freq: 220,
        duration: 0.08,
        type: 'triangle',
        volume: 0.25
      });
    },

    deal() {
      _playNoise({
        duration: 0.05,
        volume: 0.25,
        filterFreq: 3000,
        filterType: 'highpass'
      });

      _playTone({
        freq: 350,
        duration: 0.05,
        type: 'triangle',
        volume: 0.15
      });
    },

    winTrick() {
      [523.25, 659.25, 783.99].forEach((freq, index) => {
        _playTone({
          freq,
          duration: index === 2 ? 0.2 : 0.12,
          volume: 0.32,
          delay: index * 0.1
        });
      });
    },

    loseTrick() {
      _playTone({
        freq: 400,
        duration: 0.15,
        volume: 0.25,
        frequencyRamp: { to: 280, duration: 0.15 }
      });
    },

    claimHokm() {
      _playChord(
        [
          NOTE_FREQS.C4,
          NOTE_FREQS.E4,
          NOTE_FREQS.G4
        ],
        {
          duration: 0.25,
          volume: 0.3
        }
      );

      _playTone({
        freq: 1046.5,
        duration: 0.4,
        volume: 0.35,
        delay: 0.15
      });
    },

    pass() {
      _playTone({
        freq: 500,
        duration: 0.1,
        type: 'triangle',
        volume: 0.2,
        frequencyRamp: { to: 400, duration: 0.08 }
      });
    },

    win() {
      const notes = [
        { f: NOTE_FREQS.C4, d: 0.15 },
        { f: NOTE_FREQS.E4, d: 0.15 },
        { f: NOTE_FREQS.G4, d: 0.15 },
        { f: NOTE_FREQS.C5, d: 0.35 }
      ];

      let time = 0;

      notes.forEach(note => {
        _playTone({
          freq: note.f,
          duration: note.d,
          type: 'triangle',
          volume: 0.35,
          delay: time
        });

        time += note.d * 0.85;
      });

      setTimeout(() => {
        _playChord(
          [
            NOTE_FREQS.C4,
            NOTE_FREQS.E4,
            NOTE_FREQS.G4,
            NOTE_FREQS.C5
          ],
          {
            duration: 0.6,
            volume: 0.25
          }
        );
      }, 700);
    },

    lose() {
      const notes = [
        { f: NOTE_FREQS.G4, d: 0.2 },
        { f: NOTE_FREQS.E4, d: 0.2 },
        { f: NOTE_FREQS.C4, d: 0.4 }
      ];

      let time = 0;

      notes.forEach(note => {
        _playTone({
          freq: note.f,
          duration: note.d,
          volume: 0.28,
          delay: time
        });

        time += note.d * 0.9;
      });
    },

    gameStart() {
      [440, 660, 880].forEach((freq, index) => {
        _playTone({
          freq,
          duration: index === 2 ? 0.25 : 0.1,
          volume: 0.3,
          delay: index * 0.1
        });
      });
    },

    timeout() {
      _playTone({
        freq: 800,
        duration: 0.15,
        type: 'square',
        volume: 0.25,
        frequencyRamp: { to: 300, duration: 0.15 }
      });

      _playTone({
        freq: 600,
        duration: 0.15,
        type: 'square',
        volume: 0.2,
        delay: 0.15,
        frequencyRamp: { to: 200, duration: 0.15 }
      });
    },

    error() {
      _playTone({
        freq: 300,
        duration: 0.12,
        type: 'sawtooth',
        volume: 0.22
      });

      _playTone({
        freq: 200,
        duration: 0.18,
        type: 'sawtooth',
        volume: 0.2,
        delay: 0.1
      });
    },

    success() {
      _playTone({
        freq: 587.33,
        duration: 0.1,
        volume: 0.3
      });

      _playTone({
        freq: 880,
        duration: 0.2,
        volume: 0.32,
        delay: 0.1
      });
    },

    coin() {
      _playTone({
        freq: 988,
        duration: 0.08,
        type: 'square',
        volume: 0.25
      });

      _playTone({
        freq: 1318.51,
        duration: 0.15,
        type: 'square',
        volume: 0.22,
        delay: 0.06
      });
    },

    chat() {
      _playTone({
        freq: 880,
        duration: 0.06,
        volume: 0.2
      });

      _playTone({
        freq: 1174.66,
        duration: 0.08,
        volume: 0.18,
        delay: 0.05
      });
    },

    tick() {
      _playTone({
        freq: 1200,
        duration: 0.03,
        volume: 0.12
      });
    },

    countdown() {
      _playTone({
        freq: 1500,
        duration: 0.08,
        volume: 0.25
      });

      _playTone({
        freq: 1000,
        duration: 0.1,
        volume: 0.2,
        delay: 0.08
      });
    },

    achievement() {
      const notes = [
        { f: 523.25, d: 0.12 },
        { f: 659.25, d: 0.12 },
        { f: 783.99, d: 0.12 },
        { f: 1046.5, d: 0.3 }
      ];

      let time = 0;

      notes.forEach(note => {
        _playTone({
          freq: note.f,
          duration: note.d,
          type: 'triangle',
          volume: 0.3,
          delay: time
        });

        time += note.d * 0.9;
      });

      setTimeout(() => {
        _playChord(
          [1046.5, 1318.51, 1567.98],
          {
            duration: 0.5,
            volume: 0.2
          }
        );
      }, 600);
    },

    shuffle() {
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
      _playTone({
        freq: 800,
        duration: 0.08,
        volume: 0.28
      });

      _playTone({
        freq: 1200,
        duration: 0.12,
        volume: 0.25,
        delay: 0.06
      });
    },

    pop() {
      _playTone({
        freq: 400,
        duration: 0.05,
        volume: 0.25,
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

  /* ═══════════════════════════════════════════════════════════
     🎵 موسیقی اختصاصی آرام و لوکس
     ═══════════════════════════════════════════════════════════ */

  function _trackMusicNode(osc, gain) {
    const node = { osc, gain };
    state.musicNodes.push(node);

    osc.onended = () => {
      const index = state.musicNodes.indexOf(node);

      if (index !== -1) {
        state.musicNodes.splice(index, 1);
      }

      try {
        osc.disconnect();
        gain.disconnect();
      } catch (error) {}
    };

    return node;
  }

  function _musicTone(
    note,
    start,
    duration,
    options = {}
  ) {
    if (!state.ctx || !state.musicPlaying) return null;

    try {
      const ctx = state.ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = options.type || 'sine';
      osc.frequency.value = _midiToFrequency(note);

      filter.type = 'lowpass';
      filter.frequency.value = options.filter || 1800;
      filter.Q.value = 0.6;

      const peak = options.volume ?? 0.04;
      const attack = options.attack ?? 0.15;
      const release = options.release ?? 0.3;

      gain.gain.setValueAtTime(0.0001, start);

      gain.gain.linearRampToValueAtTime(
        peak,
        start + attack
      );

      gain.gain.setValueAtTime(
        peak,
        start + duration
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + duration + release
      );

      osc.connect(filter);
      filter.connect(gain);

      // صدای مستقیم و صدای دارای Reverb
      gain.connect(state.musicGain);
      gain.connect(state.reverbNode);

      _trackMusicNode(osc, gain);

      osc.start(start);
      osc.stop(start + duration + release + 0.05);

      return { osc, gain };

    } catch (error) {
      console.warn('[Audio] Music tone error:', error);
      return null;
    }
  }

  function _playLuxuryPad(chord, start) {
    if (!state.ctx || !state.musicPlaying) return;

    chord.forEach((note, index) => {
      _musicTone(note, start, MUSIC_BAR * 0.96, {
        type: index === 0 ? 'sine' : 'triangle',
        volume: index === 0 ? 0.025 : 0.014,
        attack: 1.2,
        release: 1.0,
        filter: 1100
      });
    });
  }

  function _playLuxuryPluck(note, start, volume = 0.045) {
    _musicTone(note, start, 0.85, {
      type: 'sine',
      volume,
      attack: 0.025,
      release: 1.0,
      filter: 2600
    });

    // هارمونیک بالایی بسیار ملایم
    _musicTone(note + 12, start, 0.35, {
      type: 'sine',
      volume: volume * 0.14,
      attack: 0.02,
      release: 0.6,
      filter: 3200
    });
  }

  function _playMusicBar(barIndex, start) {
    if (!state.musicPlaying) return;

    const chordIndex = barIndex % LUXURY_CHORDS.length;

    const chord = LUXURY_CHORDS[chordIndex];
    const melody = LUXURY_MELODY[chordIndex];

    state.currentChordIndex = chordIndex;

    // پد اصلی آکورد
    _playLuxuryPad(chord, start);

    // آرپژ نرم و منظم
    const arpeggioPattern = [0, 2, 3, 2];

    arpeggioPattern.forEach((noteIndex, index) => {
      const note = chord[noteIndex] + 12;

      _playLuxuryPluck(
        note,
        start + index * MUSIC_BEAT,
        0.025
      );
    });

    // ملودی اختصاصی
    melody.forEach((note, index) => {
      if (note === null) return;

      _playLuxuryPluck(
        note,
        start + index * MUSIC_BEAT * 0.5,
        0.04
      );
    });
  }

  function _scheduleMusicBar() {
    if (!state.musicPlaying || !state.ctx) return;

    const start = state.ctx.currentTime + 0.08;

    _playMusicBar(state.musicBarIndex, start);

    state.musicBarIndex++;

    const timer = setTimeout(() => {
      if (state.musicPlaying) {
        _scheduleMusicBar();
      }
    }, MUSIC_BAR * 1000);

    state.musicTimers.push(timer);
  }

  function _startMusic() {
    if (!state.ctx || state.musicPlaying) return;
    if (!state.enabled.music) return;

    if (state.ctx.state === 'suspended') {
      state.ctx.resume().then(() => {
        if (state.enabled.music && !state.musicPlaying) {
          _startMusic();
        }
      }).catch(() => {});

      return;
    }

    state.musicPlaying = true;
    state.musicBarIndex = 0;
    state.currentChordIndex = 0;

    state.musicGain.gain.cancelScheduledValues(
      state.ctx.currentTime
    );

    state.musicGain.gain.setTargetAtTime(
      state.volumes.music,
      state.ctx.currentTime,
      0.4
    );

    _scheduleMusicBar();

    console.log(
      '%c🎵 Luxury Ambient Music Started',
      'color:#c9a96e;font-weight:bold;'
    );
  }

  function _stopMusic() {
    if (!state.musicPlaying && state.musicNodes.length === 0) {
      return;
    }

    state.musicPlaying = false;

    // لغو تمام تایمرهای موسیقی
    state.musicTimers.forEach(timer => {
      clearTimeout(timer);
    });

    state.musicTimers = [];

    if (!state.ctx) return;

    const now = state.ctx.currentTime;

    // Fade out تمام نت‌های در حال پخش
    state.musicNodes.forEach(node => {
      try {
        node.gain.gain.cancelScheduledValues(now);

        node.gain.gain.setTargetAtTime(
          0.0001,
          now,
          0.25
        );

        node.osc.stop(now + 1.2);

      } catch (error) {}
    });

    console.log(
      '%c🎵 Luxury Ambient Music Stopped',
      'color:#6b7280;'
    );
  }

  /* ═══════════════════════════════════════════════════════════
     API عمومی HokmAudio
     سازگار با نسخه قبلی
     ═══════════════════════════════════════════════════════════ */

  const Audio = {

    init() {
      _loadFromStorage();
      _init();
      _bindUnlockEvents();

      return Audio;
    },

    play(name) {
      if (!state.initialized && !_init()) return;
      if (!state.enabled.sfx) return;

      if (!state.unlocked) {
        _unlock();
      }

      const sound = SOUNDS[name];

      if (typeof sound === 'function') {
        try {
          sound();
        } catch (error) {
          console.warn(
            `[Audio] Error playing "${name}":`,
            error
          );
        }
      } else {
        console.warn(`[Audio] Unknown sound: "${name}"`);
      }
    },

    playTone(options) {
      if (!state.initialized && !_init()) return null;
      return _playTone(options);
    },

    playNoise(options) {
      if (!state.initialized && !_init()) return null;
      return _playNoise(options);
    },

    startMusic() {
      state.enabled.music = true;
      _saveToStorage();

      if (!state.initialized && !_init()) return;

      if (!state.unlocked) {
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

    setSfxEnabled(enabled) {
      state.enabled.sfx = !!enabled;
      _saveToStorage();

      const button =
        typeof document !== 'undefined'
          ? document.getElementById('btnSoundToggle')
          : null;

      if (button) {
        button.textContent = state.enabled.sfx ? '🔊' : '🔇';
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

    setMusicVolume(volume) {
      state.volumes.music = _clamp(volume);

      if (state.musicGain && state.ctx) {
        state.musicGain.gain.setTargetAtTime(
          state.volumes.music,
          state.ctx.currentTime,
          0.08
        );
      }

      _saveToStorage();
    },

    getMusicVolume() {
      return state.volumes.music;
    },

    setSfxVolume(volume) {
      state.volumes.sfx = _clamp(volume);

      if (state.sfxGain && state.ctx) {
        state.sfxGain.gain.setTargetAtTime(
          state.volumes.sfx,
          state.ctx.currentTime,
          0.05
        );
      }

      _saveToStorage();
    },

    getSfxVolume() {
      return state.volumes.sfx;
    },

    setMasterVolume(volume) {
      state.volumes.master = _clamp(volume);

      if (state.masterGain && state.ctx) {
        state.masterGain.gain.setTargetAtTime(
          state.volumes.master,
          state.ctx.currentTime,
          0.05
        );
      }
    },

    getMasterVolume() {
      return state.volumes.master;
    },

    getState() {
      return {
        initialized: state.initialized,
        unlocked: state.unlocked,
        musicPlaying: state.musicPlaying,
        sfx: state.enabled.sfx,
        music: state.enabled.music,
        sfxVolume: state.volumes.sfx,
        musicVolume: state.volumes.music,
        masterVolume: state.volumes.master
      };
    },

    listSounds() {
      return Object.keys(SOUNDS);
    },

    testAll() {
      const names = Audio.listSounds();
      let index = 0;

      const next = () => {
        if (index >= names.length) return;

        console.log(`🔊 ${names[index]}`);

        Audio.play(names[index]);

        index++;

        setTimeout(next, 500);
      };

      next();
    },

    playVoiceLine(id) {
      const lines = {
        good_job: () => Audio.play('success'),
        nice_play: () => Audio.play('coin'),
        give_up: () => Audio.play('error'),
        wow: () => Audio.play('notification'),
        hello: () => Audio.play('chat'),
        thanks: () => Audio.play('softClick'),
        sorry: () => Audio.play('loseTrick'),
        hurry: () => Audio.play('countdown')
      };

      const line = lines[id];

      if (line) {
        line();
      }
    },

    destroy() {
      _stopMusic();

      if (state.ctx) {
        try {
          state.ctx.close();
        } catch (error) {}
      }

      state.ctx = null;
      state.masterGain = null;
      state.sfxGain = null;
      state.musicGain = null;
      state.reverbNode = null;

      state.initialized = false;
      state.unlocked = false;
      state.musicPlaying = false;

      state.musicNodes = [];
      state.musicTimers = [];
    }
  };

  /* ═══════════════════════════════════════════════════════════
     اتصال به رابط کاربری
     ═══════════════════════════════════════════════════════════ */

  function _attachToDOM() {
    if (typeof document === 'undefined') return;

    const soundButton =
      document.getElementById('btnSoundToggle');

    if (soundButton && !soundButton.dataset.bound) {
      soundButton.dataset.bound = '1';

      if (!soundButton.querySelector('img')) {
        soundButton.textContent =
          state.enabled.sfx ? '🔊' : '🔇';
      }

      soundButton.addEventListener('click', () => {
        Audio.toggleSfx();
      });
    }

    const sfxToggle =
      document.getElementById('sfxToggle');

    if (sfxToggle && !sfxToggle.dataset.bound) {
      sfxToggle.dataset.bound = '1';
      sfxToggle.checked = state.enabled.sfx;

      sfxToggle.addEventListener('change', event => {
        Audio.setSfxEnabled(event.target.checked);

        if (event.target.checked) {
          Audio.play('click');
        }
      });
    }

    const musicToggle =
      document.getElementById('musicToggle');

    if (musicToggle && !musicToggle.dataset.bound) {
      musicToggle.dataset.bound = '1';
      musicToggle.checked = state.enabled.music;

      musicToggle.addEventListener('change', event => {
        if (event.target.checked) {
          Audio.startMusic();
        } else {
          Audio.stopMusic();
        }
      });
    }

    const musicVolume =
      document.getElementById('musicVolume');

    if (musicVolume && !musicVolume.dataset.bound) {
      musicVolume.dataset.bound = '1';

      musicVolume.value =
        Math.round(state.volumes.music * 100);

      musicVolume.addEventListener('input', event => {
        Audio.setMusicVolume(
          Number(event.target.value) / 100
        );
      });
    }

    const sfxVolume =
      document.getElementById('sfxVolume');

    if (sfxVolume && !sfxVolume.dataset.bound) {
      sfxVolume.dataset.bound = '1';

      sfxVolume.value =
        Math.round(state.volumes.sfx * 100);

      sfxVolume.addEventListener('input', event => {
        Audio.setSfxVolume(
          Number(event.target.value) / 100
        );
      });

      sfxVolume.addEventListener('change', () => {
        Audio.play('click');
      });
    }

    // صدای کلیک کنترل‌های رابط کاربری
    if (!domEventsBound) {
      domEventsBound = true;

      document.addEventListener('click', event => {
        const target = event.target;

        if (!target || typeof target.closest !== 'function') {
          return;
        }

        const button = target.closest(
          '.btn, .icon-btn, .tab, .menu-card, .chip'
        );

        if (
          button &&
          !button.dataset.noSound &&
          !button.closest('#btnSoundToggle')
        ) {
          Audio.play('softClick');
        }

      }, { passive: true });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     راه‌اندازی خودکار
     ═══════════════════════════════════════════════════════════ */

  function bootstrap() {
    Audio.init();
    _attachToDOM();

    console.log(
      `%c🔊 HOKM PRO v7.0 Ready — ${Audio.listSounds().length} sounds + Luxury Music`,
      'color:#c9a96e;font-weight:bold;'
    );
  }

  // API عمومی
  global.HokmAudio = Audio;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        bootstrap,
        { once: true }
      );
    } else {
      bootstrap();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
