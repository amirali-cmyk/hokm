/* ═══════════════════════════════════════════════════════════
   ⚙️ HOKM PRO v6.1.1 — settings.js
   مدیریت کامل تنظیمات: تم، AI، تایمر، صدا، راهنما، بکاپ
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

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

  const Settings = {

    init() {
      _bindAccentPicker();
      _bindCardTheme();
      _bindBgTheme();
      _bindAILevel();
      _bindPlayerCount();
      _bindTimerSpeed();
      _bindSoundToggles();
      _bindVolumeSliders();
      _bindHelpButton();   // 🎯 دکمه راهنما
      _bindDangerZone();
      _loadCurrentValues();

      _log('✅ Settings initialized (v6.1.1)');
      return Settings;
    },

    _loadCurrentValues: null,

    get(key) {
      const storage = _storage();
      if (!storage) return null;
      return storage.getSettings()[key];
    },

    getAll() {
      const storage = _storage();
      return storage ? storage.getSettings() : {};
    },

    set(key, value) {
      const storage = _storage();
      if (!storage) return false;

      const patch = {};
      patch[key] = value;
      storage.updateSettings(patch);

      _log(`set ${key} = ${value}`);
      return true;
    },

    reset() {
      const storage = _storage();
      if (!storage) return false;

      if (!confirm('⚠️ همه تنظیمات به حالت پیش‌فرض بازگردانده شود؟')) {
        return false;
      }

      storage.remove(storage.KEYS.SETTINGS);
      storage.updateSettings({});
      Settings._loadCurrentValues();

      if (_themes()) _themes().reset();

      if (_ui()) {
        _ui().showToast('✅ بازنشانی شد', 'تنظیمات به حالت پیش‌فرض برگشت', 'success');
      }

      return true;
    },

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
     🎨 انتخاب Accent
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

      if (_themes()) {
        _themes().setAccent(accent);
      } else {
        document.body.dataset.accent = accent;
        Settings.set('accent', accent);
      }

      picker.querySelectorAll('.accent-dot').forEach(d => {
        d.classList.toggle('active', d === dot);
      });

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
     🃏 طرح کارت
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
     🖼️ پس‌زمینه
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
     🎯 سطح AI
     ───────────────────────────────────────────── */
  function _bindAILevel() {
    const container = _$('aiLevelSegmented');
    if (!container || container.dataset.bound) return;

    container.dataset.bound = '1';

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-level]');
      if (!btn) return;

      const level = btn.dataset.level;

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
     👥 تعداد بازیکنان
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
     ⏱️ سرعت تایمر
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
     🔊 صدا — Toggle ها
     ───────────────────────────────────────────── */
  function _bindSoundToggles() {
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
     🎚️ صدا — Slider ها
     ───────────────────────────────────────────── */
  function _bindVolumeSliders() {
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

      let audioTimeout = null;
      sfxSlider.addEventListener('change', () => {
        if (audioTimeout) clearTimeout(audioTimeout);
        audioTimeout = setTimeout(() => {
          if (_audio()) _audio().play('click');
        }, 100);
      });

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
     📖 دکمه راهنما
     ───────────────────────────────────────────── */
  function _bindHelpButton() {
    const helpBtn = _$('btnOpenHelp');
    if (!helpBtn || helpBtn.dataset.bound) return;

    helpBtn.dataset.bound = '1';

    helpBtn.addEventListener('click', () => {
      console.log('%c📖 باز کردن راهنما', 'color: #ffd60a; font-weight: bold;');

      if (_ui() && typeof _ui().openHelpModal === 'function') {
        _ui().openHelpModal();
      } else if (_ui()) {
        // fallback
        _ui().openModal(`
          <h2 class="modal-title" style="margin-bottom: 20px;">📖 راهنمای بازی حکم</h2>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <h3 style="color: var(--accent); font-size: 16px; margin-bottom: 8px;">🎯 هدف بازی</h3>
              <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.7;">
                ۴ بازیکن در ۲ تیم روبه‌روی هم. باید ۷ دست از ۱۳ دست رو ببرید.
              </p>
            </div>
            <div>
              <h3 style="color: var(--accent); font-size: 16px; margin-bottom: 8px;">🃏 ترتیب کارت‌ها</h3>
              <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.7;">
                A (14) > K (13) > Q (12) > J (11) > 10 > ... > 2
              </p>
            </div>
            <div>
              <h3 style="color: var(--accent); font-size: 16px; margin-bottom: 8px;">👑 حکم‌خوانی</h3>
              <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.7;">
                یک نفر حکم تعیین می‌کند. خال حکم بر همه چیز برتری دارد.
              </p>
            </div>
            <div>
              <h3 style="color: var(--accent); font-size: 16px; margin-bottom: 8px;">⚖️ قوانین طلایی</h3>
              <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.7;">
                پیروی از خال الزامی است. اگر کارت هم‌خال داری، باید همون رو بازی کنی.
              </p>
            </div>
          </div>
          <div class="modal-actions" style="margin-top: 20px;">
            <button class="btn btn-primary btn-block" onclick="HokmUI.closeModal()">
              فهمیدم ✅
            </button>
          </div>
        `);
      }
    });

    _log('Help button bound');
  }

  /* ─────────────────────────────────────────────
     ⚠️ Danger Zone
     ───────────────────────────────────────────── */
  function _bindDangerZone() {
    const resetStats = _$('btnResetStats');
    if (resetStats && !resetStats.dataset.bound) {
      resetStats.dataset.bound = '1';
      resetStats.addEventListener('click', () => {
        Settings.clearStats();
      });
    }

    const resetAll = _$('btnResetAll');
    if (resetAll && !resetAll.dataset.bound) {
      resetAll.dataset.bound = '1';
      resetAll.addEventListener('click', () => {
        Settings.clearAll();
      });
    }

    _log('Danger zone bound');
  }

  /* ─────────────────────────────────────────────
     📥 بارگذاری مقادیر فعلی
     ───────────────────────────────────────────── */
  Settings._loadCurrentValues = function () {
    const settings = Settings.getAll();

    // Accent
    const accent = settings.accent || 'gold';
    document.querySelectorAll('.accent-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.accent === accent);
    });

    const cardSelect = _$('cardThemeSelect');
    if (cardSelect) cardSelect.value = settings.cardTheme || 'classic';

    const bgSelect = _$('bgThemeSelect');
    if (bgSelect) bgSelect.value = settings.bgTheme || 'gradient';

    const aiLevel = settings.aiLevel || 'medium';
    const aiContainer = _$('aiLevelSegmented');
    if (aiContainer) {
      aiContainer.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.level === aiLevel);
      });
    }

    // Player count — فقط ۲ یا ۴
    let playerCount = settings.playerCount || 4;
    if (playerCount !== 2 && playerCount !== 4) {
      playerCount = 4;
      Settings.set('playerCount', 4);
    }

    const pcContainer = _$('playerCountSegmented');
    if (pcContainer) {
      pcContainer.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.count, 10) === playerCount);
      });
    }

    const timerSpeed = settings.timerSpeed || 'normal';
    const tsContainer = _$('timerSpeedSegmented');
    if (tsContainer) {
      tsContainer.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.speed === timerSpeed);
      });
    }

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

  global.HokmSettings = Settings;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 300));
    } else {
      setTimeout(bootstrap, 300);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);