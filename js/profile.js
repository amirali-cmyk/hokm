/* ═══════════════════════════════════════════════════════════
   👤 HOKM PRO v6.1.1 — profile.js
   پروفایل کاربر، ELO FIDE، ۷ سطح رتبه، آواتار، سکه، جایزه روزانه
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها — ۷ سطح رتبه
     ───────────────────────────────────────────── */
  const RANKS = [
    { id: 'legend',      name: 'افسانه',       icon: '🔥', min: 2000, color: '#ef476f', gradient: 'linear-gradient(135deg, #ef476f, #b8304e)' },
    { id: 'grandmaster', name: 'استاد بزرگ',   icon: '👑', min: 1800, color: '#ffd60a', gradient: 'linear-gradient(135deg, #ffe97a, #b8860b)' },
    { id: 'master',      name: 'استاد',         icon: '💎', min: 1600, color: '#9b5de5', gradient: 'linear-gradient(135deg, #c195f0, #7a3dbd)' },
    { id: 'pro',         name: 'حرفه‌ای',        icon: '🥇', min: 1400, color: '#ffd60a', gradient: 'linear-gradient(135deg, #ffd60a, #b8860b)' },
    { id: 'intermediate',name: 'متوسط',         icon: '🥈', min: 1200, color: '#e0e0e0', gradient: 'linear-gradient(135deg, #e0e0e0, #909090)' },
    { id: 'rookie',      name: 'تازه‌کار',       icon: '🥉', min: 1000, color: '#d4a373', gradient: 'linear-gradient(135deg, #d4a373, #8b5a2b)' },
    { id: 'beginner',    name: 'مبتدی',         icon: '🌱', min: 0,    color: '#06d6a0', gradient: 'linear-gradient(135deg, #5cf0c2, #059669)' }
  ];

  const AVATAR_PRESETS = [
    '🌱', '🥉', '🥈', '🥇', '💎', '👑', '🔥',
    '😎', '🧑‍🎓', '🤴', '🦁', '🐯', '🦊',
    '🐼', '🐺', '🦉', '🎭', '🎯', '⚡', '🌟'
  ];

  const ELO_K_FACTOR = 32;
  const ELO_MIN_CHANGE = 5;
  const ELO_MAX_LOSS = -5;

  // 🎁 جایزه روزانه
  const DAILY_BONUS_AMOUNT = 50;
  const DAILY_BONUS_INTERVAL = 24 * 60 * 60 * 1000; // ۲۴ ساعت

  /* ─────────────────────────────────────────────
     وضعیت
     ───────────────────────────────────────────── */
  const state = {
    data: null,
    listeners: []
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() { return global.HokmStorage; }
  function _ui() { return global.HokmUI; }
  function _audio() { return global.HokmAudio; }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try { handler(data); } catch (err) { console.error(err); }
      }
    });
  }

  function _toPersianNumber(n) {
    const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, d => fa[+d]);
  }

  /* ─────────────────────────────────────────────
     مدیریت داده
     ───────────────────────────────────────────── */
  function _load() {
    const storage = _storage();
    if (!storage) {
      console.warn('[Profile] HokmStorage not available');
      state.data = _defaultProfile();
      return state.data;
    }
    state.data = storage.getProfile();
    return state.data;
  }

  function _save() {
    const storage = _storage();
    if (!storage) return false;
    storage.setProfile(state.data);
    return true;
  }

  function _defaultProfile() {
    return {
      name: 'مهمان',
      avatar: '🌱',
      elo: 1000,
      level: 1,
      coins: 500,
      rank: 'تازه‌کار',
      rankId: 'rookie',
      createdAt: Date.now(),
      lastPlayedAt: null,
      userId: null,
      isGuest: true,
      email: null
    };
  }

  /* ─────────────────────────────────────────────
     ELO — فرمول FIDE
     ───────────────────────────────────────────── */
  function _calculateExpected(playerElo, opponentElo) {
    return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  }

  function _calculateEloChange(playerElo, opponentElo, actual) {
    const expected = _calculateExpected(playerElo, opponentElo);
    let change = ELO_K_FACTOR * (actual - expected);

    if (actual === 1 && change < ELO_MIN_CHANGE) change = ELO_MIN_CHANGE;
    if (actual === 0 && change > ELO_MAX_LOSS) change = ELO_MAX_LOSS;

    return Math.round(change);
  }

  /* ─────────────────────────────────────────────
     رتبه از ELO
     ───────────────────────────────────────────── */
  function _getRankFromElo(elo) {
    for (const rank of RANKS) {
      if (elo >= rank.min) return rank;
    }
    return RANKS[RANKS.length - 1];
  }

  function _getNextRank(currentRank) {
    const idx = RANKS.findIndex(r => r.id === currentRank.id);
    if (idx <= 0) return null;
    return RANKS[idx - 1];
  }

  function _getRankProgress(elo) {
    const current = _getRankFromElo(elo);
    const next = _getNextRank(current);
    if (!next) return { percent: 100, current, next: null };

    const range = next.min - current.min;
    const progress = elo - current.min;
    const percent = Math.min(100, Math.round((progress / range) * 100));
    return { percent, current, next, eloToNext: next.min - elo };
  }

  /* ─────────────────────────────────────────────
     🎁 جایزه روزانه
     ───────────────────────────────────────────── */
  function _checkDailyBonus() {
    const storage = _storage();
    if (!storage) return;

    const lastBonusRaw = storage.getRaw('hokm_daily_bonus');
    const now = Date.now();

    if (!lastBonusRaw || (now - parseInt(lastBonusRaw, 10)) >= DAILY_BONUS_INTERVAL) {
      // 🎁 اعطای جایزه
      Profile.addCoins(DAILY_BONUS_AMOUNT);
      storage.setRaw('hokm_daily_bonus', String(now));

      console.log(`%c🎁 +${DAILY_BONUS_AMOUNT} سکه روزانه اعطا شد`,
        'color: #ffd60a; font-weight: bold; font-size: 13px;');

      // نمایش اعلان بعد از لود کامل UI
      setTimeout(() => {
        if (_ui() && typeof _ui().showToast === 'function') {
          _ui().showToast(
            '🎁 جایزه روزانه!',
            `+${_toPersianNumber(DAILY_BONUS_AMOUNT)} سکه رایگان دریافت کردی`,
            'success',
            5000
          );
        }
        if (_audio()) _audio().play('coin');
      }, 2000);

      _emit('daily:bonus', { amount: DAILY_BONUS_AMOUNT });
    }
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const Profile = {

    /* ─── راه‌اندازی ─── */
    init() {
      _load();
      _checkDailyBonus();   // 🎁 چک جایزه روزانه
      Profile.updateUI();
      _bindEvents();

      console.log(
        `%c👤 Profile: ${state.data.name} (${state.data.elo} ELO, ${state.data.coins} سکه)`,
        'color: #118ab2; font-weight: bold;'
      );
      return state.data;
    },

    /* ─── Get ─── */

    get() {
      return Object.assign({}, state.data);
    },

    getName() {
      return state.data.name;
    },

    getAvatar() {
      return state.data.avatar;
    },

    getElo() {
      return state.data.elo;
    },

    getCoins() {
      return state.data.coins;
    },

    getRank() {
      return _getRankFromElo(state.data.elo);
    },

    getRankProgress() {
      return _getRankProgress(state.data.elo);
    },

    isGuest() {
      return !!state.data.isGuest;
    },

    /* ─── Set ─── */

    setName(name) {
      if (!name || typeof name !== 'string') return false;
      const trimmed = name.trim().slice(0, 20);
      if (!trimmed) return false;

      state.data.name = trimmed;
      _save();
      Profile.updateUI();
      _emit('profile:name-changed', { name: trimmed });
      return true;
    },

    setAvatar(avatar) {
      if (!avatar) return false;
      state.data.avatar = String(avatar).slice(0, 2048);
      _save();
      Profile.updateUI();
      _emit('profile:avatar-changed', { avatar: state.data.avatar });
      return true;
    },

    setAvatarFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
          reject(new Error('فایل نامعتبر'));
          return;
        }

        if (file.size > 200 * 1024) {
          reject(new Error('حجم فایل بیش از ۲۰۰ کیلوبایت'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 96;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2;
            const sy = (img.height - min) / 2;

            ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            state.data.avatar = dataUrl;
            _save();
            Profile.updateUI();
            _emit('profile:avatar-changed', { avatar: dataUrl });
            resolve(dataUrl);
          };
          img.onerror = () => reject(new Error('خطا در بارگذاری تصویر'));
          img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
        reader.readAsDataURL(file);
      });
    },

    /* ─── ELO ─── */

    calculateElo(opponentElo, expectedWin) {
      const actual = expectedWin ? 1 : 0;
      return _calculateEloChange(state.data.elo, opponentElo, actual);
    },

    applyEloChange(change) {
      const oldElo = state.data.elo;
      const oldRank = _getRankFromElo(oldElo);
      state.data.elo = Math.max(0, oldElo + change);

      const newRank = _getRankFromElo(state.data.elo);
      state.data.rankId = newRank.id;
      state.data.rank = newRank.name;

      _save();

      const rankChanged = oldRank.id !== newRank.id;

      _emit('elo:changed', {
        oldElo,
        newElo: state.data.elo,
        change,
        rankChanged,
        oldRank,
        newRank
      });

      return {
        oldElo,
        newElo: state.data.elo,
        change,
        rankChanged,
        newRank
      };
    },

    /* ─── سکه ─── */

    addCoins(amount) {
      state.data.coins = Math.max(0, state.data.coins + amount);
      _save();
      Profile.updateUI();
      _emit('coins:changed', { coins: state.data.coins, change: amount });
      return state.data.coins;
    },

    spendCoins(amount) {
      if (state.data.coins < amount) return false;
      state.data.coins -= amount;
      _save();
      Profile.updateUI();
      _emit('coins:changed', { coins: state.data.coins, change: -amount });
      return true;
    },

    /* ─── ورود/خروج ─── */

    setFromServer(data) {
      state.data = Object.assign({}, state.data, data, { isGuest: false });
      state.data.rankId = _getRankFromElo(state.data.elo).id;
      state.data.rank = _getRankFromElo(state.data.elo).name;
      _save();
      Profile.updateUI();
      _emit('profile:synced', state.data);
      return state.data;
    },

    logout() {
      const guestProfile = _defaultProfile();
      state.data = guestProfile;
      _save();

      const storage = _storage();
      if (storage) storage.clearAuthToken();

      Profile.updateUI();
      _emit('profile:logout');
      return guestProfile;
    },

    /* ─── آواتار تصادفی ─── */

    randomAvatar() {
      const current = state.data.avatar;
      let next = current;
      while (next === current && AVATAR_PRESETS.length > 1) {
        next = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];
      }
      Profile.setAvatar(next);
      return next;
    },

    getAvatarPresets() {
      return AVATAR_PRESETS.slice();
    },

    /* ─── آمار ─── */

    getStats() {
      const storage = _storage();
      if (!storage) return null;
      return storage.getStats();
    },

    getWinRate() {
      const stats = Profile.getStats();
      if (!stats || stats.gamesPlayed === 0) return 0;
      return Math.round((stats.wins / stats.gamesPlayed) * 100);
    },

    getStreak() {
      const stats = Profile.getStats();
      return stats ? stats.currentStreak : 0;
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Profile.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /* ─── UI Update ─── */

    updateUI() {
      if (!state.data) return;

      const elo = state.data.elo;
      const rank = _getRankFromElo(elo);
      const progress = _getRankProgress(elo);

      // پروفایل سریع
      _setText('quickName', state.data.name);
      _setText('quickElo', _toPersianNumber(elo));
      _setText('quickRank', rank.name);
      _setText('quickCoins', _toPersianNumber(state.data.coins));  // 🆕 سکه
      _setAvatarHTML('quickAvatar', state.data.avatar);

      // پروفایل کامل
      _setText('profileName', state.data.name);
      _setText('profileRank', `${rank.name} — ${_toPersianNumber(elo)}`);
      _setText('statCoins', _toPersianNumber(state.data.coins));   // 🆕 سکه
      _setAvatarHTML('profileAvatarBig', state.data.avatar);

      const eloBar = document.getElementById('profileEloFill');
      if (eloBar) eloBar.style.width = `${progress.percent}%`;

      // دکمه ورود/خروج
      const loginBtn = document.getElementById('btnLogin');
      if (loginBtn) {
        if (state.data.isGuest) {
          loginBtn.textContent = 'ورود / ثبت‌نام';
          loginBtn.classList.remove('logout');
        } else {
          loginBtn.textContent = 'خروج';
          loginBtn.classList.add('logout');
        }
      }

      // آمار
      const stats = Profile.getStats();
      if (stats) {
        _setText('statWins', _toPersianNumber(stats.wins));
        _setText('statLosses', _toPersianNumber(stats.losses));
        _setText('statWinRate', `${_toPersianNumber(stats.winRate)}٪`);
        _setText('statStreak', _toPersianNumber(stats.currentStreak));
        _setText('statBestStreak', _toPersianNumber(stats.bestStreak));
        _setText('statGames', _toPersianNumber(stats.gamesPlayed));
      }

      // تاریخچه
      Profile.renderHistory();
      _renderAchievementsMini();
    },

    renderHistory() {
      const el = document.getElementById('historyList');
      if (!el) return;

      const storage = _storage();
      if (!storage) return;

      const history = storage.getHistory();
      const games = (history.games || []).slice(0, 10);

      if (games.length === 0) {
        el.innerHTML = '<p class="empty-msg">هنوز بازی‌ای انجام نداده‌ای</p>';
        return;
      }

      el.innerHTML = games.map(g => {
        const win = g.win;
        const icon = win ? '🏆' : '💔';
        const cls = win ? 'win' : 'loss';
        const eloChange = g.eloChange || 0;
        const eloSign = eloChange >= 0 ? '+' : '';
        const eloColor = eloChange > 0
          ? 'var(--color-success)'
          : eloChange < 0
            ? 'var(--color-danger)'
            : 'var(--text-muted)';

        const timeAgo = _timeAgo(g.timestamp);

        return `
          <div class="history-item ${cls}">
            <div class="history-result">${icon}</div>
            <div class="history-info">
              <div class="history-title">
                ${win ? 'برد' : 'باخت'} — ${_toPersianNumber(g.scoreA || 0)} به ${_toPersianNumber(g.scoreB || 0)}
              </div>
              <div class="history-meta">
                ${timeAgo} · ${_modeLabel(g.mode, g.aiLevel)}
              </div>
            </div>
            <div class="history-elo" style="color: ${eloColor}">
              ${_toPersianNumber(eloSign + eloChange)}
            </div>
          </div>
        `;
      }).join('');
    }
  };

  /* ─────────────────────────────────────────────
     ابزار UI
     ───────────────────────────────────────────── */
  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function _setAvatarHTML(id, avatar) {
    const el = document.getElementById(id);
    if (!el) return;

    if (typeof avatar === 'string' && avatar.startsWith('data:image')) {
      el.innerHTML = `<img src="${avatar}" alt="آواتار" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      el.textContent = avatar || '🌱';
    }
  }

  function _timeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'همین الان';
    if (seconds < 3600) return `${_toPersianNumber(Math.floor(seconds / 60))} دقیقه پیش`;
    if (seconds < 86400) return `${_toPersianNumber(Math.floor(seconds / 3600))} ساعت پیش`;
    if (seconds < 604800) return `${_toPersianNumber(Math.floor(seconds / 86400))} روز پیش`;
    return `${_toPersianNumber(Math.floor(seconds / 604800))} هفته پیش`;
  }

  function _modeLabel(mode, aiLevel) {
    if (mode === 'online') return 'آنلاین';
    const levels = {
      easy: 'AI آسان',
      medium: 'AI متوسط',
      hard: 'AI سخت',
      master: 'AI استاد'
    };
    return levels[aiLevel] || 'آفلاین';
  }

  function _renderAchievementsMini() {
    const grid = document.getElementById('achievementsMiniGrid');
    if (!grid) return;

    const storage = _storage();
    if (!storage) return;

    const achData = storage.getAchievements();
    const unlocked = achData.unlocked || {};

    const ACH_LIST = [
      { id: 'first_game', icon: '🎬' },
      { id: 'first_win', icon: '⭐' },
      { id: 'wins_5', icon: '🌟' },
      { id: 'wins_10', icon: '✨' },
      { id: 'wins_50', icon: '💫' },
      { id: 'streak_3', icon: '🔥' },
      { id: 'streak_5', icon: '🔥' },
      { id: 'streak_10', icon: '🔥' },
      { id: 'elo_1300', icon: '🥈' },
      { id: 'elo_1500', icon: '🥇' },
      { id: 'elo_1800', icon: '👑' },
      { id: 'elo_2000', icon: '🔥' }
    ];

    const unlockedCount = Object.keys(unlocked).length;

    grid.innerHTML = ACH_LIST.map(a => {
      const isUnlocked = !!unlocked[a.id];
      return `
        <div class="achievement-mini ${isUnlocked ? 'unlocked' : 'locked'}"
             title="${a.id}"
             data-ach="${a.id}">
          ${a.icon}
        </div>
      `;
    }).join('');

    const label = document.getElementById('achCountLabel');
    if (label) {
      label.textContent = `${_toPersianNumber(unlockedCount)} / ${_toPersianNumber(ACH_LIST.length)}`;
    }
  }

  /* ─────────────────────────────────────────────
     Bind رویدادهای DOM
     ───────────────────────────────────────────── */
  function _bindEvents() {
    const bigAvatar = document.getElementById('profileAvatarBig');
    if (bigAvatar && !bigAvatar.dataset.bound) {
      bigAvatar.dataset.bound = '1';
      bigAvatar.addEventListener('click', () => {
        const input = document.getElementById('avatarUpload');
        if (input) input.click();
      });
    }

    const changeBtn = document.getElementById('btnChangeAvatar');
    if (changeBtn && !changeBtn.dataset.bound) {
      changeBtn.dataset.bound = '1';
      changeBtn.addEventListener('click', () => {
        _showAvatarPicker();
      });
    }

    const uploadInput = document.getElementById('avatarUpload');
    if (uploadInput && !uploadInput.dataset.bound) {
      uploadInput.dataset.bound = '1';
      uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          await Profile.setAvatarFromFile(file);
          if (_audio()) _audio().play('success');
          _toast('آواتار با موفقیت تغییر کرد', 'success');
        } catch (err) {
          _toast(err.message || 'خطا در بارگذاری', 'error');
        }
      });
    }

    const loginBtn = document.getElementById('btnLogin');
    if (loginBtn && !loginBtn.dataset.bound) {
      loginBtn.dataset.bound = '1';
      loginBtn.addEventListener('click', () => {
        if (Profile.isGuest()) {
          if (_ui()) _ui().navigate('auth');
        } else {
          if (confirm('از حساب خود خارج می‌شوید؟')) {
            Profile.logout();
            _toast('با موفقیت خارج شدید', 'info');
          }
        }
      });
    }

    const nameEl = document.getElementById('profileName');
    if (nameEl && !nameEl.dataset.bound) {
      nameEl.dataset.bound = '1';
      nameEl.style.cursor = 'pointer';
      nameEl.title = 'کلیک برای تغییر نام';
      nameEl.addEventListener('click', () => {
        _promptName();
      });
    }
  }

  /* ─────────────────────────────────────────────
     Modal: تغییر نام
     ───────────────────────────────────────────── */
  function _promptName() {
    const current = state.data.name;
    const newName = prompt('نام جدید:', current);

    if (newName && newName.trim() && newName.trim() !== current) {
      if (Profile.setName(newName.trim())) {
        if (_audio()) _audio().play('success');
        _toast('نام با موفقیت تغییر کرد', 'success');
      }
    }
  }

  /* ─────────────────────────────────────────────
     Modal: Picker آواتار
     ───────────────────────────────────────────── */
  function _showAvatarPicker() {
    const picker = document.getElementById('modalContent');
    const overlay = document.getElementById('modalOverlay');
    if (!picker || !overlay) return;

    const presets = Profile.getAvatarPresets();

    picker.innerHTML = `
      <h3 class="modal-title">یک آواتار انتخاب کن</h3>
      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
        gap: 10px;
        padding: 12px 0;
      ">
        ${presets.map(a => `
          <button
            class="avatar-picker-btn"
            data-avatar="${a}"
            style="
              aspect-ratio: 1;
              font-size: 28px;
              background: var(--bg-elevated);
              border: 2px solid ${a === state.data.avatar ? 'var(--accent)' : 'var(--border-color)'};
              border-radius: 50%;
              cursor: pointer;
              transition: transform 0.2s;
            "
            onmouseover="this.style.transform='scale(1.1)'"
            onmouseout="this.style.transform='scale(1)'">
            ${a}
          </button>
        `).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="btnRandomAvatar">🎲 تصادفی</button>
        <button class="btn btn-primary" id="btnUploadAvatar">📷 آپلود تصویر</button>
      </div>
    `;

    overlay.classList.remove('hidden');

    picker.querySelectorAll('.avatar-picker-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const avatar = btn.dataset.avatar;
        Profile.setAvatar(avatar);
        if (_audio()) _audio().play('softClick');
        overlay.classList.add('hidden');
        _toast('آواتار تغییر کرد', 'success');
      });
    });

    const randBtn = document.getElementById('btnRandomAvatar');
    if (randBtn) {
      randBtn.addEventListener('click', () => {
        Profile.randomAvatar();
        if (_audio()) _audio().play('click');
        overlay.classList.add('hidden');
      });
    }

    const uploadBtn = document.getElementById('btnUploadAvatar');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        const input = document.getElementById('avatarUpload');
        if (input) input.click();
        overlay.classList.add('hidden');
      });
    }
  }

  /* ─────────────────────────────────────────────
     Toast کمکی
     ───────────────────────────────────────────── */
  function _toast(msg, type) {
    if (_ui() && typeof _ui().showToast === 'function') {
      _ui().showToast('اطلاع', msg, type || 'info');
    } else {
      console.log(`[${type}] ${msg}`);
    }
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    Profile.init();

    // 🎯 اگه مهمان بود، اسمش رو بپرس
    if (state.data.name === 'مهمان' || state.data.isGuest) {
      setTimeout(() => {
        if (state.data.name === 'مهمان') {
          const name = prompt('اسمت چیه؟ (برای اینکه پیشرفتت ذخیره بشه)', '');
          if (name && name.trim()) {
            Profile.setName(name.trim());
          }
        }
      }, 2500);
    }
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  Profile.RANKS = RANKS;
  Profile.AVATAR_PRESETS = AVATAR_PRESETS;
  Profile.DAILY_BONUS_AMOUNT = DAILY_BONUS_AMOUNT;

  global.HokmProfile = Profile;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(bootstrap, 50);
      });
    } else {
      setTimeout(bootstrap, 50);
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);