/* ═══════════════════════════════════════════════════════════
   👤 HOKM PRO v7.0.0 — profile.js
   پروفایل، ELO، ۷ سطح رتبه، آواتار SVG، سکه، جایزه روزانه
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const RANKS = [
    { id: 'legend',      name: 'افسانه',       icon: 'assets/svg/crown-vip.svg',    min: 2000, color: '#ef476f' },
    { id: 'grandmaster', name: 'استاد بزرگ',   icon: 'assets/svg/trophy.svg',       min: 1800, color: '#ffd60a' },
    { id: 'master',      name: 'استاد',         icon: 'assets/svg/medal-icon.svg',   min: 1600, color: '#9b5de5' },
    { id: 'pro',         name: 'حرفه‌ای',        icon: 'assets/svg/medal-icon.svg',   min: 1400, color: '#ffd60a' },
    { id: 'intermediate',name: 'متوسط',         icon: 'assets/svg/medal-icon.svg',   min: 1200, color: '#e0e0e0' },
    { id: 'rookie',      name: 'تازه‌کار',       icon: 'assets/svg/medal-icon.svg',   min: 1000, color: '#d4a373' },
    { id: 'beginner',    name: 'مبتدی',         icon: 'assets/svg/avatar-default.svg', min: 0,  color: '#06d6a0' }
  ];

  const AVATAR_PRESETS = [
    'assets/svg/avatar-default.svg'
  ];

  const ACH_ICONS = {
    first_game: 'assets/svg/medal-icon.svg',
    first_win: 'assets/svg/trophy.svg',
    wins_5: 'assets/svg/medal-icon.svg',
    wins_10: 'assets/svg/trophy.svg',
    wins_50: 'assets/svg/crown-vip.svg',
    streak_3: 'assets/svg/clover-icon.svg',
    streak_5: 'assets/svg/clover-icon.svg',
    streak_10: 'assets/svg/crown-vip.svg',
    elo_1300: 'assets/svg/medal-icon.svg',
    elo_1500: 'assets/svg/trophy.svg',
    elo_1800: 'assets/svg/crown-vip.svg',
    elo_2000: 'assets/svg/crown-vip.svg'
  };

  const ACH_LIST = [
    { id: 'first_game', title: 'شروع سفر', desc: 'اولین بازی خود را انجام بده', target: 1 },
    { id: 'first_win', title: 'اولین برد', desc: 'اولین بازی خود را ببر', target: 1 },
    { id: 'wins_5', title: '۵ برد', desc: 'پنج بازی را ببر', target: 5 },
    { id: 'wins_10', title: '۱۰ برد', desc: 'ده بازی را ببر', target: 10 },
    { id: 'wins_50', title: '۵۰ برد', desc: 'پنجاه بازی را ببر', target: 50 },
    { id: 'streak_3', title: 'آتشین ۳', desc: 'سه بازی پیاپی ببر', target: 3 },
    { id: 'streak_5', title: 'آتشین ۵', desc: 'پنج بازی پیاپی ببر', target: 5 },
    { id: 'streak_10', title: 'آتشین ۱۰', desc: 'ده بازی پیاپی ببر', target: 10 },
    { id: 'elo_1300', title: 'متوسط', desc: 'به ELO ۱۳۰۰ برس', target: 300 },
    { id: 'elo_1500', title: 'حرفه‌ای', desc: 'به ELO ۱۵۰۰ برس', target: 500 },
    { id: 'elo_1800', title: 'استاد بزرگ', desc: 'به ELO ۱۸۰۰ برس', target: 800 },
    { id: 'elo_2000', title: 'افسانه', desc: 'به ELO ۲۰۰۰ برس', target: 1000 }
  ];

  const ELO_K_FACTOR = 32;
  const ELO_MIN_CHANGE = 5;
  const ELO_MAX_LOSS = -5;
  const DAILY_BONUS_AMOUNT = 50;
  const DAILY_BONUS_INTERVAL = 24 * 60 * 60 * 1000;

  const state = { data: null, listeners: [] };

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

  function _load() {
    const storage = _storage();
    if (!storage) { state.data = _defaultProfile(); return state.data; }
    state.data = storage.getProfile();
    const token = localStorage.getItem('hokm_auth_token');
    state.data.isGuest = !token;
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
      avatar: 'assets/svg/avatar-default.svg',
      elo: 1000,
      level: 1,
      coins: 500,
      rank: 'تازه‌کار',
      rankId: 'rookie',
      createdAt: Date.now(),
      lastPlayedAt: null,
      userId: null,
      isGuest: true,
      friendCode: null,
      email: null
    };
  }

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

  function _getRankFromElo(elo) {
    for (const rank of RANKS) { if (elo >= rank.min) return rank; }
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

  function _checkDailyBonus() {
    const storage = _storage();
    if (!storage) return;
    const lastBonusRaw = storage.getRaw('hokm_daily_bonus');
    const now = Date.now();
    if (!lastBonusRaw || (now - parseInt(lastBonusRaw, 10)) >= DAILY_BONUS_INTERVAL) {
      Profile.addCoins(DAILY_BONUS_AMOUNT);
      storage.setRaw('hokm_daily_bonus', String(now));
      console.log(`%c🎁 +${DAILY_BONUS_AMOUNT} سکه روزانه`, 'color: #ffd60a; font-weight: bold;');
      setTimeout(() => {
        if (_ui() && typeof _ui().showToast === 'function') {
          _ui().showToast('🎁 جایزه روزانه!', `+${_toPersianNumber(DAILY_BONUS_AMOUNT)} سکه رایگان`, 'success', 5000);
        }
        if (_audio()) _audio().play('coin');
      }, 2000);
      _emit('daily:bonus', { amount: DAILY_BONUS_AMOUNT });
    }
  }

  const Profile = {

    init() {
      _load();
      _checkDailyBonus();
      Profile.updateUI();
      _bindEvents();
      console.log(`%c👤 Profile: ${state.data.name} (${state.data.elo} ELO)`, 'color: #118ab2; font-weight: bold;');
      return state.data;
    },

    get() { return Object.assign({}, state.data); },
    getName() { return state.data.name; },
    getAvatar() { return state.data.avatar; },
    getElo() { return state.data.elo; },
    getCoins() { return state.data.coins; },
    getRank() { return _getRankFromElo(state.data.elo); },
    getRankProgress() { return _getRankProgress(state.data.elo); },
    isGuest() { return !!state.data.isGuest; },

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
        if (!file || !file.type.startsWith('image/')) { reject(new Error('فایل نامعتبر')); return; }
        if (file.size > 200 * 1024) { reject(new Error('حجم فایل بیش از ۲۰۰ کیلوبایت')); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 96;
            canvas.width = size; canvas.height = size;
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

    calculateElo(opponentElo, expectedWin) {
      return _calculateEloChange(state.data.elo, opponentElo, expectedWin ? 1 : 0);
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
      _emit('elo:changed', { oldElo, newElo: state.data.elo, change, rankChanged, oldRank, newRank });
      return { oldElo, newElo: state.data.elo, change, rankChanged, newRank };
    },

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

    randomAvatar() {
      const current = state.data.avatar;
      let next = current;
      while (next === current && AVATAR_PRESETS.length > 1) {
        next = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];
      }
      Profile.setAvatar(next);
      return next;
    },

    getAvatarPresets() { return AVATAR_PRESETS.slice(); },

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

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Profile.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(l => !(l.event === event && l.handler === handler));
    },

    updateUI() {
      if (!state.data) return;
      const elo = state.data.elo;
      const rank = _getRankFromElo(elo);
      const progress = _getRankProgress(elo);

      _setText('quickName', state.data.name);
      _setText('quickElo', _toPersianNumber(elo));
      _setText('quickRank', rank.name);
      _setText('quickCoins', _toPersianNumber(state.data.coins));
      _setAvatarHTML('quickAvatar', state.data.avatar);

      _setText('profileName', state.data.name);
      _setText('profileRank', `${rank.name} — ${_toPersianNumber(elo)}`);
      _setText('statCoins', _toPersianNumber(state.data.coins));
      _setAvatarHTML('profileAvatarBig', state.data.avatar);

      const friendCodeEl = document.getElementById('profileFriendCode');
      if (friendCodeEl) {
        if (state.data.friendCode) {
          friendCodeEl.innerHTML = `
            <div style="margin-top: 10px; padding: 10px 18px; background: var(--bg-elevated); border: 2px solid var(--gold-mid); border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 0 20px var(--accent-glow);">
              <span style="font-size: 12px; color: var(--text-secondary); font-weight: 700;">کد دوست‌یابی:</span>
              <span style="font-size: 18px; font-weight: 900; color: var(--gold-bright); font-family: var(--font-num); text-shadow: 0 0 12px var(--accent-glow);">${state.data.friendCode}</span>
              <button class="icon-btn" style="width: 30px; height: 30px; font-size: 14px;" onclick="navigator.clipboard.writeText('${state.data.friendCode}'); HokmUI.showToast('کپی شد', 'کد شما کپی شد', 'success');">📋</button>
            </div>
          `;
        } else {
          friendCodeEl.innerHTML = `
            <div style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">
              برای دریافت کد دوست‌یابی، وارد حساب خود شوید.
            </div>
          `;
        }
      }

      const eloBar = document.getElementById('profileEloFill');
      if (eloBar) eloBar.style.width = `${progress.percent}%`;

      const loginBtn = document.getElementById('btnLogin');
      if (loginBtn) {
        if (state.data.isGuest) { loginBtn.textContent = 'ورود / ثبت‌نام'; loginBtn.classList.remove('logout'); }
        else { loginBtn.textContent = 'خروج'; loginBtn.classList.add('logout'); }
      }

      const stats = Profile.getStats();
      if (stats) {
        _setText('statWins', _toPersianNumber(stats.wins));
        _setText('statLosses', _toPersianNumber(stats.losses));
        _setText('statWinRate', `${_toPersianNumber(stats.winRate)}٪`);
        _setText('statStreak', _toPersianNumber(stats.currentStreak));
        _setText('statBestStreak', _toPersianNumber(stats.bestStreak));
        _setText('statGames', _toPersianNumber(stats.gamesPlayed));
      }

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
      if (games.length === 0) { el.innerHTML = '<p class="empty-msg">هنوز بازی‌ای انجام نداده‌ای</p>'; return; }

      el.innerHTML = games.map(g => {
        const win = g.win;
        const icon = win ? '🏆' : '💔';
        const cls = win ? 'win' : 'loss';
        const eloChange = g.eloChange || 0;
        const eloSign = eloChange >= 0 ? '+' : '';
        const eloColor = eloChange > 0 ? 'var(--emerald-bright)' : eloChange < 0 ? 'var(--ruby-bright)' : 'var(--text-muted)';
        const timeAgo = _timeAgo(g.timestamp);
        return `
          <div class="history-item ${cls}">
            <div class="history-result">${icon}</div>
            <div class="history-info">
              <div class="history-title">${win ? 'برد' : 'باخت'} — ${_toPersianNumber(g.scoreA || 0)} به ${_toPersianNumber(g.scoreB || 0)}</div>
              <div class="history-meta">${timeAgo} · ${_modeLabel(g.mode, g.aiLevel)}</div>
            </div>
            <div class="history-elo" style="color: ${eloColor}">${_toPersianNumber(eloSign + eloChange)}</div>
          </div>
        `;
      }).join('');
    }
  };

  function _setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  function _setAvatarHTML(id, avatar) {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof avatar === 'string' && avatar.startsWith('data:image')) {
      el.innerHTML = `<img src="${avatar}" alt="آواتار" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else if (typeof avatar === 'string' && avatar.startsWith('assets/')) {
      el.innerHTML = `<img src="${avatar}" alt="آواتار" style="width:100%;height:100%;object-fit:contain;" />`;
    } else if (typeof avatar === 'string' && avatar.length <= 4) {
      el.textContent = avatar;
    } else {
      el.innerHTML = `<img src="assets/svg/avatar-default.svg" alt="آواتار" style="width:100%;height:100%;object-fit:contain;" />`;
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
    const levels = { easy: 'AI آسان', medium: 'AI متوسط', hard: 'AI سخت', master: 'AI استاد' };
    return levels[aiLevel] || 'آفلاین';
  }

  function _renderAchievementsMini() {
    const grid = document.getElementById('achievementsMiniGrid');
    if (!grid) return;
    const storage = _storage();
    if (!storage) return;
    const achData = storage.getAchievements();
    const unlocked = achData.unlocked || {};

    grid.innerHTML = ACH_LIST.map(a => {
      const isUnlocked = !!unlocked[a.id];
      const iconPath = ACH_ICONS[a.id] || 'assets/svg/medal-icon.svg';
      return `
        <div class="achievement-mini ${isUnlocked ? 'unlocked' : 'locked'}" title="${a.id}" data-ach="${a.id}">
          <img src="${iconPath}" alt="" style="width:32px;height:32px;${isUnlocked ? '' : 'filter:grayscale(1) brightness(0.5);'}" />
        </div>
      `;
    }).join('');

    const label = document.getElementById('achCountLabel');
    if (label) {
      const unlockedCount = Object.keys(unlocked).length;
      label.textContent = `${_toPersianNumber(unlockedCount)} / ${_toPersianNumber(ACH_LIST.length)}`;
    }
  }

  function _bindEvents() {
    const bigAvatar = document.getElementById('profileAvatarBig');
    if (bigAvatar && !bigAvatar.dataset.bound) {
      bigAvatar.dataset.bound = '1';
      bigAvatar.addEventListener('click', () => { document.getElementById('avatarUpload')?.click(); });
    }

    const changeBtn = document.getElementById('btnChangeAvatar');
    if (changeBtn && !changeBtn.dataset.bound) {
      changeBtn.dataset.bound = '1';
      changeBtn.addEventListener('click', () => { _showAvatarPicker(); });
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

    const nameEl = document.getElementById('profileName');
    if (nameEl && !nameEl.dataset.bound) {
      nameEl.dataset.bound = '1';
      nameEl.style.cursor = 'pointer';
      nameEl.title = 'کلیک برای تغییر نام';
      nameEl.addEventListener('click', () => { _promptName(); });
    }
  }

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

  function _showAvatarPicker() {
    const picker = document.getElementById('modalContent');
    const overlay = document.getElementById('modalOverlay');
    if (!picker || !overlay) return;

    picker.innerHTML = `
      <h3 class="modal-title">یک آواتار انتخاب کن</h3>
      <div style="text-align: center; padding: 20px;">
        <img src="assets/svg/avatar-default.svg" alt="" style="width: 120px; height: 120px; filter: drop-shadow(0 0 20px var(--accent-glow));" />
      </div>
      <div class="modal-actions" style="display: flex; flex-direction: column; gap: 10px;">
        <button class="btn btn-primary btn-block" id="btnUploadAvatar">📷 آپلود تصویر</button>
        <button class="btn btn-outline btn-block" id="btnResetAvatar">🔄 بازگشت به پیش‌فرض</button>
      </div>
    `;

    overlay.classList.remove('hidden');

    document.getElementById('btnUploadAvatar')?.addEventListener('click', () => {
      document.getElementById('avatarUpload')?.click();
      overlay.classList.add('hidden');
    });

    document.getElementById('btnResetAvatar')?.addEventListener('click', () => {
      Profile.setAvatar('assets/svg/avatar-default.svg');
      if (_audio()) _audio().play('click');
      overlay.classList.add('hidden');
    });
  }

  function _toast(msg, type) {
    if (_ui() && typeof _ui().showToast === 'function') _ui().showToast('اطلاع', msg, type || 'info');
    else console.log(`[${type}] ${msg}`);
  }

  function bootstrap() { Profile.init(); }

  Profile.RANKS = RANKS;
  Profile.AVATAR_PRESETS = AVATAR_PRESETS;
  Profile.DAILY_BONUS_AMOUNT = DAILY_BONUS_AMOUNT;

  global.HokmProfile = Profile;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bootstrap, 50));
    else setTimeout(bootstrap, 50);
  }

})(typeof window !== 'undefined' ? window : globalThis);