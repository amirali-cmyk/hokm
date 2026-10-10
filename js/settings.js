/* ═══════════════════════════════════════════════════════════
   ⚙️ HOKM PRO v6.0 — settings.js
   مدیریت کامل تنظیمات: تم، AI، تایمر، صدا، بکاپ
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() { return global.HokmStorage; }
  function _themes() { return global.HokmThemes; }
  function _audio() { return global.HokmAudio; }
  function _ui() { return global.HokmUI; }
  function _profile() { return global.HokmProfile; }

  function _$(id) { return document.getElementById(id); }

  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  function _log(msg) {
    console.log('%c[Settings] ' + msg, 'color: #9b5de5; font-weight: 600;');
  }

  /* ─────────────────────────────────────────────
     API تنظیمات
     ───────────────────────────────────────────── */
  const Settings = {

    /**
     * راه‌اندازی
     */
    init() {
      _bindAccentPicker();
      _bindCardTheme();
      _bindBgTheme();
      _bindAILevel();
      _bindPlayerCount();
      _bindTimerSpeed();
      _bindSoundToggles();
      _bindVolumeSliders();
      _bindDangerZone();
      _loadCurrentValues();

      _log('✅ Settings initialized');
      return Settings;
    },

    /**
     * بارگذاری مقادیر فعلی از Storage
     */
    _loadCurrentValues: null, // در پایین تعریف می‌شه

    /* ─── Getters ─── */

    get(key) {
      const storage = _storage();
      if (!storage) return null;
      const settings = storage.getSettings();
      return settings[key];
    },

    getAll() {
      const storage = _storage();
      return storage ? storage.getSettings() : {};
    },

    /* ─── Setters ─── */

    set(key, value) {
      const storage = _storage();
      if (!storage) return false;

      const patch = {};
      patch[key] = value;
      storage.updateSettings(patch);

      _log(`set ${key} = ${value}`);
      return true;
    },

    /**
     * بازنشانی تنظیمات به پیش‌فرض
     */
    reset() {
      const storage = _storage();
      if (!storage) return false;

      if (!confirm('⚠️ همه تنظیمات به حالت پیش‌فرض بازگردانده شود؟')) {
        return false;
      }

      // حذف کلید تنظیمات
      storage.remove(storage.KEYS.SETTINGS);

      // بازسازی
      storage.updateSettings({});

      // اعمال مجدد
      Settings._loadCurrentValues();

      if (_themes()) {
        _themes().reset();
      }

      if (_ui()) {
        _ui().showToast('✅ بازنشانی شد', 'تنظیمات به حالت پیش‌فرض برگشت', 'success');
      }

      return true;
    },

    /**
     * پاک کردن آمار فقط
     */
    clearStats() {
      if (!confirm('🗑️ آمار و تاریخچه بازی‌ها پاک شود؟')) {
        return false;
      }

      const storage = _storage();
      if (storage && typeof storage.clearStats === 'function') {
        storage.clearStats();
      }

      if (_profile() && typeof _profile().updateUI === 'function') {
        _profile().updateUI();
      }

      if (_ui()) {
        _ui().showToast('🗑️ پاک شد', 'آمار پاک شد', 'info');
      }

      return true;
    },

    /**
     * بازنشانی کامل (factory reset)
     */
    clearAll() {
      if (!confirm('⚠️⚠️ همه چیز پاک شود؟ این کار برگشت‌پذیر نیست!')) {
        return false;
      }

      if (!confirm('واقعاً مطمئن هستی؟ همه پروفایل، آمار، دستاوردها و بازی‌ها پاک می‌شود.')) {
        return false;
      }

      const storage = _storage();
      if (storage && typeof storage.clearAll === 'function') {
        storage.clearAll();
      }

      if (_ui()) {
        _ui().showToast('🗑️ بازنشانی کامل', 'در حال بارگذاری مجدد...', 'warning');
      }

      setTimeout(() => {
        window.location.reload();
      }, 1000);

      return true;
    }
  };

  /* ─────────────────────────────────────────────
     ۱. انتخاب Accent (۵ تم رنگی)
     ───────────────────────────────────────────── */
  function _bindAccentPicker() {
    const picker = _$('accentPicker');
    if (!picker || picker.dataset.bound) return;

    picker.dataset.bound = '1';

    picker.addEventListener('click', (e) => {
      const dot = e.target.closest('.accent-dot');
      if (!dot) return;

      const accent = dot.dataset.accent;
      if (!accent) return;

      // اعمال از طریق Themes
      if (_themes()) {
        _themes().setAccent(accent);
      } else {
        document.body.dataset.accent = accent;
        Settings.set('accent', accent);
      }

      // Update active dot
      picker.querySelectorAll('.accent-dot').forEach(d => {
        d.classList.toggle('active', d === dot);
      });

      // صدا
      if (_audio()) _audio().play('softClick');

      if (_ui()) {
        const names = {
          gold: '🥇 طلایی',
          emerald: '💚 سبز زمرد',
          ocean: '💙 آبی اقیانوس',
          royal: '💜 بنفش سلطنتی',
          ruby: '❤️ قرمز یاقوت'
        };
        _ui().showToast('🎨 تم تغییر کرد', names[accent] || accent, 'success', 2000);
      }
    });

    _log('Accent picker bound');
  }

  /* ─────────────────────────────────────────────
     ۲. تم کارت (۵ طرح)
     ───────────────────────────────────────────── */
  function _bindCardTheme() {
    const select = _$('cardThemeSelect');
    if (!select || select.dataset.bound) return;

    select.dataset.bound = '1';

    select.addEventListener('change', () => {
      const theme = select.value;

      if (_themes()) {
        _themes().setCardTheme(theme);
      } else {
        document.body.dataset.cardTheme = theme;
        Settings.set('cardTheme', theme);
      }

      if (_audio()) _audio().play('softClick');

      if (_ui()) {
        const names = {
          classic: '🃏 کلاسیک',
          dark: '🌑 تاریک',
          wooden: '🪵 چوبی',
          cartoon: '🎨 کارتونی',
          neon: '💡 نئون'
        };
        _ui().showToast('🎴 طرح کارت', names[theme] || theme, 'success', 2000);
      }
    });

    _log('Card theme bound');
  }

  /* ─────────────────────────────────────────────
     ۳. تم پس‌زمینه (۵ طرح)
     ───────────────────────────────────────────── */
  function _bindBgTheme() {
    const select = _$('bgThemeSelect');
    if (!select || select.dataset.bound) return;

    select.dataset.bound = '1';

    select.addEventListener('change', () => {
      const theme = select.value;

      if (_themes()) {
        _themes().setBgTheme(theme);
      } else {
        document.body.dataset.bg = theme;
        Settings.set('bgTheme', theme);
      }

      if (_audio()) _audio().play('softClick');

      if (_ui()) {
        const names = {
          gradient: '🌈 گرادیانت',
          wooden: '🪵 چوبی',
          checker: '♟️ شطرنجی',
          night: '🌌 شبانه',
          crystal: '💎 کریستالی'
        };
        _ui().showToast('🖼️ پس‌زمینه', names[theme] || theme, 'success', 2000);
      }
    });

    _log('BG theme bound');
  }

  /* ─────────────────────────────────────────────
     ۴. سطح AI (۴ سطح)
     ───────────────────────────────────────────── */
  function _bindAILevel() {
    const container = _$('aiLevelSegmented');
    if (!container || container.dataset.bound) return;

    container.dataset.bound = '1';

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-level]');
      if (!btn) return;

      const level = btn.dataset.level;

      // Update active
      container.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b === btn);
      });

      Settings.set('aiLevel', level);

      if (_audio()) _audio().play('softClick');

      if (_ui()) {
        const names = {
          easy: '🌱 آسان',
          medium: '🥈 متوسط',
          hard: '🥇 سخت',
          master: '👑 استاد'
        };
        _ui().showToast('🎯 سطح AI', names[level] || level, 'success', 1800);
      }
    });

    _log('AI level bound');
  }

  /* ─────────────────────────────────────────────
     ۵. تعداد بازیکنان (۲/۳/۴)
     ───────────────────────────────────────────── */
  function _bindPlayerCount() {
    const container = _$('playerCountSegmented');
    if (!container || container.dataset.bound) return;

    container.dataset.bound = '1';

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-count]');
      if (!btn) return;

      const count = parseInt(btn.dataset.count, 10);

      container.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b === btn);
      });

      Settings.set('playerCount', count);

      if (_audio()) _audio().play('softClick');

      if (_ui()) {
        _ui().showToast('👥 تعداد بازیکنان', _toPersianNumber(count) + ' نفره', 'success', 1800);
      }
    });

    _log('Player count bound');
  }

  /* ─────────────────────────────────────────────
     ۶. سرعت تایمر (سریع/معمولی/آهسته)
     ───────────────────────────────────────────── */
  function _bindTimerSpeed() {
    const container = _$('timerSpeedSegmented');
    if (!container || container.dataset.bound) return;

    container.dataset.bound = '1';

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-speed]');
      if (!btn) return;

      const speed = btn.dataset.speed;

      container.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b === btn);
      });

      Settings.set('timerSpeed', speed);

      if (_audio()) _audio().play('softClick');

      if (_ui()) {
        const names = {
          fast: '⚡ سریع (۱۵ ثانیه)',
          normal: '⏱️ معمولی (۳۰ ثانیه)',
          slow: '🐢 آهسته (۴۵ ثانیه)'
        };
        _ui().showToast('⏱️ سرعت تایمر', names[speed] || speed, 'success', 1800);
      }
    });

    _log('Timer speed bound');
  }

  /* ─────────────────────────────────────────────
     ۷. صدا — Toggle ها
     ───────────────────────────────────────────── */
  function _bindSoundToggles() {
    // صداهای بازی
    const sfxToggle = _$('sfxToggle');
    if (sfxToggle && !sfxToggle.dataset.bound) {
      sfxToggle.dataset.bound = '1';

      sfxToggle.addEventListener('change', () => {
        const enabled = sfxToggle.checked;

        if (_audio()) {
          _audio().setSfxEnabled(enabled);
          if (enabled) _audio().play('click');
        } else {
          Settings.set('soundEnabled', enabled);
        }

        if (_ui()) {
          _ui().showToast(
            enabled ? '🔊 صدا روشن' : '🔇 صدا خاموش',
            '',
            enabled ? 'success' : 'info',
            1500
          );
        }
      });
    }

    // موسیقی
    const musicToggle = _$('musicToggle');
    if (musicToggle && !musicToggle.dataset.bound) {
      musicToggle.dataset.bound = '1';

      musicToggle.addEventListener('change', () => {
        const enabled = musicToggle.checked;

        if (_audio()) {
          if (enabled) {
            _audio().startMusic();
          } else {
            _audio().stopMusic();
          }
        } else {
          Settings.set('musicEnabled', enabled);
        }

        if (_ui()) {
          _ui().showToast(
            enabled ? '🎵 موسیقی روشن' : '🎵 موسیقی خاموش',
            '',
            enabled ? 'success' : 'info',
            1500
          );
        }
      });
    }

    _log('Sound toggles bound');
  }

  /* ─────────────────────────────────────────────
     ۸. صدا — Slider ها
     ───────────────────────────────────────────── */
  function _bindVolumeSliders() {
    // صدای موسیقی
    const musicSlider = _$('musicVolume');
    if (musicSlider && !musicSlider.dataset.bound) {
      musicSlider.dataset.bound = '1';

      musicSlider.addEventListener('input', () => {
        const vol = parseInt(musicSlider.value, 10) / 100;

        if (_audio()) {
          _audio().setMusicVolume(vol);
        } else {
          Settings.set('musicVolume', Math.round(vol * 100));
        }
      });

      // نمایش درصد
      let musicLabel = musicSlider.parentElement.querySelector('.volume-value');
      if (!musicLabel) {
        musicLabel = document.createElement('div');
        musicLabel.className = 'volume-value';
        musicLabel.style.cssText = 'text-align:center; font-size:12px; color:var(--text-muted); margin-top:6px; font-family:var(--font-num);';
        musicSlider.parentElement.appendChild(musicLabel);
      }

      const updateMusicLabel = () => {
        musicLabel.textContent = _toPersianNumber(musicSlider.value) + '٪';
      };

      musicSlider.addEventListener('input', updateMusicLabel);
      updateMusicLabel();
    }

    // صدای افکت‌ها
    const sfxSlider = _$('sfxVolume');
    if (sfxSlider && !sfxSlider.dataset.bound) {
      sfxSlider.dataset.bound = '1';

      sfxSlider.addEventListener('input', () => {
        const vol = parseInt(sfxSlider.value, 10) / 100;

        if (_audio()) {
          _audio().setSfxVolume(vol);
        } else {
          Settings.set('sfxVolume', Math.round(vol * 100));
        }
      });

      // پخش صدا موقع تغییر (با تأخیر)
      let audioTimeout = null;
      sfxSlider.addEventListener('change', () => {
        if (audioTimeout) clearTimeout(audioTimeout);
        audioTimeout = setTimeout(() => {
          if (_audio()) _audio().play('click');
        }, 100);
      });

      // نمایش درصد
      let sfxLabel = sfxSlider.parentElement.querySelector('.volume-value');
      if (!sfxLabel) {
        sfxLabel = document.createElement('div');
        sfxLabel.className = 'volume-value';
        sfxLabel.style.cssText = 'text-align:center; font-size:12px; color:var(--text-muted); margin-top:6px; font-family:var(--font-num);';
        sfxSlider.parentElement.appendChild(sfxLabel);
      }

      const updateSfxLabel = () => {
        sfxLabel.textContent = _toPersianNumber(sfxSlider.value) + '٪';
      };

      sfxSlider.addEventListener('input', updateSfxLabel);
      updateSfxLabel();
    }

    _log('Volume sliders bound');
  }

  /* ─────────────────────────────────────────────
     ۹. Danger Zone
     ───────────────────────────────────────────── */
  function _bindDangerZone() {
    // پاک کردن آمار
    const resetStats = _$('btnResetStats');
    if (resetStats && !resetStats.dataset.bound) {
      resetStats.dataset.bound = '1';

      resetStats.addEventListener('click', () => {
        Settings.clearStats();
      });
    }

    // بازنشانی کامل
    const resetAll = _$('btnResetAll');
    if (resetAll && !resetAll.dataset.bound) {
      resetAll.dataset.bound = '1';

      resetAll.addEventListener('click', () => {
        Settings.clearAll();
      });
    }

    // بازنشانی تنظیمات (اگر بود)
    const resetSettings = _$('btnResetSettings');
    if (resetSettings && !resetSettings.dataset.bound) {
      resetSettings.dataset.bound = '1';

      resetSettings.addEventListener('click', () => {
        Settings.reset();
      });
    }

    _log('Danger zone bound');
  }

  /* ─────────────────────────────────────────────
     ۱۰. بارگذاری مقادیر فعلی
     ───────────────────────────────────────────── */
  Settings._loadCurrentValues = function () {
    const settings = Settings.getAll();

    // Accent
    const accent = settings.accent || 'gold';
    document.querySelectorAll('.accent-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.accent === accent);
    });

    // Card theme
    const cardSelect = _$('cardThemeSelect');
    if (cardSelect) cardSelect.value = settings.cardTheme || 'classic';

    // BG theme
    const bgSelect = _$('bgThemeSelect');
    if (bgSelect) bgSelect.value = settings.bgTheme || 'gradient';

    // AI level
    const aiLevel = settings.aiLevel || 'medium';
    const aiContainer = _$('aiLevelSegmented');
    if (aiContainer) {
      aiContainer.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.level === aiLevel);
      });
    }

    // Player count
    const playerCount = settings.playerCount || 4;
    const pcContainer = _$('playerCountSegmented');
    if (pcContainer) {
      pcContainer.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.count, 10) === playerCount);
      });
    }

    // Timer speed
    const timerSpeed = settings.timerSpeed || 'normal';
    const tsContainer = _$('timerSpeedSegmented');
    if (tsContainer) {
      tsContainer.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.speed === timerSpeed);
      });
    }

    // Sound
    const sfxToggle = _$('sfxToggle');
    if (sfxToggle) sfxToggle.checked = settings.soundEnabled !== false;

    const musicToggle = _$('musicToggle');
    if (musicToggle) musicToggle.checked = settings.musicEnabled === true;

    const musicVol = _$('musicVolume');
    if (musicVol) musicVol.value = settings.musicVolume || 15;

    const sfxVol = _$('sfxVolume');
    if (sfxVol) sfxVol.value = settings.sfxVolume || 60;

    _log('Current values loaded');
  };

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    Settings.init();
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmSettings = Settings;

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 300));
    } else {
      setTimeout(bootstrap, 300);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);