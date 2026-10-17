/* ═══════════════════════════════════════════════════════════
   💾 HOKM PRO v6.1.1 — storage.js
   مدیریت localStorage با ۶ کلید اصلی + Migration + Events
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const PREFIX = 'hokm_';
  const VERSION = '6.1.1';
  const SAVE_EXPIRY_DAYS = 7;

  const KEYS = {
    PROFILE:      PREFIX + 'profile',
    SETTINGS:     PREFIX + 'settings',
    SAVE:         PREFIX + 'save',
    STATS:        PREFIX + 'stats',
    HISTORY:      PREFIX + 'history',
    ACHIEVEMENTS: PREFIX + 'achievements',
    VERSION:      PREFIX + 'version',
    AUTH_TOKEN:   PREFIX + 'auth_token',
    FRIENDS:      PREFIX + 'friends',
    LEADERBOARD:  PREFIX + 'leaderboard'
  };

  /* ─────────────────────────────────────────────
     مقادیر پیش‌فرض
     ───────────────────────────────────────────── */
  const DEFAULTS = {
    profile: {
      name: 'مهمان',
      avatar: '🌱',
      elo: 1000,
      level: 1,
      coins: 500,               // 🎯 سکه اولیه ۵۰۰
      rank: 'مبتدی',
      createdAt: Date.now(),
      lastPlayedAt: null,
      userId: null,
      isGuest: true
    },

    settings: {
      theme: 'auto',
      accent: 'gold',
      cardTheme: 'classic',
      bgTheme: 'gradient',
      aiLevel: 'medium',
      playerCount: 4,
      timerSpeed: 'normal',
      soundEnabled: true,
      musicEnabled: false,
      musicVolume: 15,
      sfxVolume: 60,
      motionReduced: false,
      showHints: true,
      autoSort: true
    },

    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalRounds: 0,
      roundsWon: 0,
      hokmClaimed: 0,
      hokmWon: 0,
      totalTimePlayed: 0,
      eloHistory: [],
      firstGameAt: null,
      lastGameAt: null
    },

    achievements: {
      unlocked: {},
      progress: {},
      lastCheck: Date.now()
    },

    history: {
      games: [],
      maxSize: 50
    }
  };

  /* ─────────────────────────────────────────────
     ابزارهای پایه
     ───────────────────────────────────────────── */
  const hasLS = (function () {
    try {
      const k = '__hokm_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const memoryStore = {};

  function rawGet(key) {
    if (!hasLS) return memoryStore[key] || null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[Storage] Read error:', e);
      return null;
    }
  }

  function rawSet(key, value) {
    if (!hasLS) {
      memoryStore[key] = value;
      return true;
    }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[Storage] Quota exceeded, cleaning history...');
        _handleQuotaExceeded();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (e2) {
          console.error('[Storage] Retry failed:', e2);
          return false;
        }
      }
      console.warn('[Storage] Write error:', e);
      return false;
    }
  }

  function rawRemove(key) {
    if (!hasLS) {
      delete memoryStore[key];
      return true;
    }
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function _handleQuotaExceeded() {
    try {
      const h = _readJSON(KEYS.HISTORY, DEFAULTS.history);
      if (h.games && h.games.length > 10) {
        h.games = h.games.slice(0, 10);
        rawSet(KEYS.HISTORY, JSON.stringify(h));
      }
      rawRemove(KEYS.SAVE);
    } catch (e) {
      Object.values(KEYS).forEach(k => {
        if (k !== KEYS.PROFILE) rawRemove(k);
      });
    }
  }

  function _readJSON(key, fallback) {
    const raw = rawGet(key);
    if (raw === null) return _deepClone(fallback);
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] JSON parse error for ${key}:`, e);
      return _deepClone(fallback);
    }
  }

  function _writeJSON(key, value) {
    try {
      return rawSet(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[Storage] JSON stringify error for ${key}:`, e);
      return false;
    }
  }

  function _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      if (Array.isArray(obj)) return obj.slice();
      return Object.assign({}, obj);
    }
  }

  function _deepMerge(target, source) {
    const out = _deepClone(target);
    if (!source || typeof source !== 'object') return out;

    Object.keys(source).forEach(k => {
      const sv = source[k];
      const tv = out[k];

      if (Array.isArray(sv)) {
        out[k] = sv.slice();
      } else if (sv && typeof sv === 'object' && tv && typeof tv === 'object' && !Array.isArray(tv)) {
        out[k] = _deepMerge(tv, sv);
      } else {
        out[k] = sv;
      }
    });

    return out;
  }

  /* ─────────────────────────────────────────────
     API اصلی
     ───────────────────────────────────────────── */
  const Storage = {

    KEYS,
    VERSION,

    has(key) {
      return rawGet(key) !== null;
    },

    getRaw(key) {
      return rawGet(key);
    },

    setRaw(key, value) {
      return rawSet(key, value);
    },

    remove(key) {
      return rawRemove(key);
    },

    /* ─── پروفایل ─── */
    getProfile() {
      const p = _readJSON(KEYS.PROFILE, DEFAULTS.profile);
      return _deepMerge(DEFAULTS.profile, p);
    },

    setProfile(profile) {
      const merged = _deepMerge(DEFAULTS.profile, profile);
      return _writeJSON(KEYS.PROFILE, merged);
    },

    updateProfile(patch) {
      const current = Storage.getProfile();
      const updated = _deepMerge(current, patch);
      Storage.setProfile(updated);
      _emit('profile:changed', updated);
      return updated;
    },

    /* ─── تنظیمات ─── */
    getSettings() {
      const s = _readJSON(KEYS.SETTINGS, DEFAULTS.settings);
      return _deepMerge(DEFAULTS.settings, s);
    },

    setSettings(settings) {
      const merged = _deepMerge(DEFAULTS.settings, settings);
      return _writeJSON(KEYS.SETTINGS, merged);
    },

    updateSettings(patch) {
      const current = Storage.getSettings();
      const updated = _deepMerge(current, patch);
      Storage.setSettings(updated);
      _emit('settings:changed', updated);
      return updated;
    },

    getSetting(key) {
      return Storage.getSettings()[key];
    },

    setSetting(key, value) {
      const patch = {};
      patch[key] = value;
      return Storage.updateSettings(patch);
    },

    /* ─── بازی جاری ─── */
    getSave() {
      const raw = _readJSON(KEYS.SAVE, null);
      if (!raw) return null;

      const now = Date.now();
      const expiryMs = SAVE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (raw.savedAt && (now - raw.savedAt) > expiryMs) {
        Storage.clearSave();
        return null;
      }

      return raw;
    },

    setSave(save) {
      const wrapped = Object.assign({}, save, {
        savedAt: Date.now(),
        _v: VERSION
      });
      return _writeJSON(KEYS.SAVE, wrapped);
    },

    clearSave() {
      return rawRemove(KEYS.SAVE);
    },

    hasSave() {
      return Storage.getSave() !== null;
    },

    /* ─── آمار ─── */
    getStats() {
      const s = _readJSON(KEYS.STATS, DEFAULTS.stats);
      return _deepMerge(DEFAULTS.stats, s);
    },

    setStats(stats) {
      const merged = _deepMerge(DEFAULTS.stats, stats);
      return _writeJSON(KEYS.STATS, merged);
    },

    recordGame(result) {
      const stats = Storage.getStats();
      const profile = Storage.getProfile();
      const history = Storage.getHistory();

      const isWin = !!result.win;

      stats.gamesPlayed++;
      stats.totalRounds += (result.rounds ? result.rounds.length : 0);
      stats.roundsWon += (result.roundsWon || 0);
      stats.hokmClaimed += (result.hokmClaimed || 0);
      stats.hokmWon += (result.hokmWon || 0);
      stats.totalTimePlayed += (result.durationMs || 0);
      stats.lastGameAt = Date.now();
      if (!stats.firstGameAt) stats.firstGameAt = Date.now();

      if (isWin) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.bestStreak) {
          stats.bestStreak = stats.currentStreak;
        }
      } else {
        stats.losses++;
        stats.currentStreak = 0;
      }

      stats.winRate = stats.gamesPlayed > 0
        ? Math.round((stats.wins / stats.gamesPlayed) * 100)
        : 0;

      if (result.eloChange !== undefined) {
        stats.eloHistory.push({
          elo: profile.elo + result.eloChange,
          change: result.eloChange,
          timestamp: Date.now()
        });
        if (stats.eloHistory.length > 100) {
          stats.eloHistory = stats.eloHistory.slice(-100);
        }
      }

      Storage.setStats(stats);

      if (result.eloChange) {
        profile.elo = Math.max(0, profile.elo + result.eloChange);
        profile.rank = _getRankFromElo(profile.elo);
        profile.level = _getLevelFromElo(profile.elo);
      }
      profile.lastPlayedAt = Date.now();
      Storage.setProfile(profile);

      history.games.unshift({
        id: 'game_' + Date.now(),
        win: isWin,
        scoreA: result.scoreA || 0,
        scoreB: result.scoreB || 0,
        eloChange: result.eloChange || 0,
        eloAfter: profile.elo,
        durationMs: result.durationMs || 0,
        mode: result.mode || 'ai',
        aiLevel: result.aiLevel || 'medium',
        timestamp: Date.now()
      });

      if (history.games.length > history.maxSize) {
        history.games = history.games.slice(0, history.maxSize);
      }
      Storage.setHistory(history);

      _emit('game:recorded', { stats, history, profile });

      return { stats, history, profile };
    },

    /* ─── تاریخچه ─── */
    getHistory() {
      const h = _readJSON(KEYS.HISTORY, DEFAULTS.history);
      return _deepMerge(DEFAULTS.history, h);
    },

    setHistory(history) {
      const merged = _deepMerge(DEFAULTS.history, history);
      return _writeJSON(KEYS.HISTORY, merged);
    },

    clearHistory() {
      return rawRemove(KEYS.HISTORY);
    },

    /* ─── دستاوردها ─── */
    getAchievements() {
      const a = _readJSON(KEYS.ACHIEVEMENTS, DEFAULTS.achievements);
      return _deepMerge(DEFAULTS.achievements, a);
    },

    setAchievements(achievements) {
      const merged = _deepMerge(DEFAULTS.achievements, achievements);
      return _writeJSON(KEYS.ACHIEVEMENTS, merged);
    },

    unlockAchievement(achId, progress) {
      const a = Storage.getAchievements();
      if (a.unlocked[achId]) {
        return { alreadyUnlocked: true };
      }

      a.unlocked[achId] = {
        unlockedAt: Date.now(),
        progress: progress || 0
      };

      delete a.progress[achId];

      Storage.setAchievements(a);
      _emit('achievement:unlocked', { id: achId, unlockedAt: a.unlocked[achId].unlockedAt });

      return { alreadyUnlocked: false, data: a.unlocked[achId] };
    },

    isAchievementUnlocked(achId) {
      const a = Storage.getAchievements();
      return !!a.unlocked[achId];
    },

    updateAchievementProgress(achId, value) {
      const a = Storage.getAchievements();
      if (a.unlocked[achId]) return null;

      a.progress[achId] = value;
      Storage.setAchievements(a);
      return a.progress[achId];
    },

    /* ─── توکن احراز هویت ─── */
    getAuthToken() {
      return rawGet(KEYS.AUTH_TOKEN);
    },

    setAuthToken(token) {
      return rawSet(KEYS.AUTH_TOKEN, token);
    },

    clearAuthToken() {
      return rawRemove(KEYS.AUTH_TOKEN);
    },

    /* ─── دوستان ─── */
    getFriends() {
      return _readJSON(KEYS.FRIENDS, { list: [], requests: [] });
    },

    setFriends(friends) {
      return _writeJSON(KEYS.FRIENDS, friends);
    },

    /* ─── لیدربورد ─── */
    getLeaderboardCache() {
      const cached = _readJSON(KEYS.LEADERBOARD, null);
      if (!cached) return null;
      if (cached.cachedAt && (Date.now() - cached.cachedAt) > 60 * 60 * 1000) {
        return null;
      }
      return cached.data;
    },

    setLeaderboardCache(data) {
      return _writeJSON(KEYS.LEADERBOARD, {
        data,
        cachedAt: Date.now()
      });
    },

    /* ─── مدیریت کل ─── */
    clearAll() {
      Object.values(KEYS).forEach(k => rawRemove(k));
      _emit('all:cleared');
      return true;
    },

    clearStats() {
      rawRemove(KEYS.STATS);
      rawRemove(KEYS.HISTORY);
      rawRemove(KEYS.ACHIEVEMENTS);
      _emit('stats:cleared');
      return true;
    },

    exportAll() {
      const data = { _v: VERSION, exportedAt: Date.now() };
      Object.entries(KEYS).forEach(([name, key]) => {
        const raw = rawGet(key);
        if (raw !== null) {
          try {
            data[name] = JSON.parse(raw);
          } catch (e) {
            data[name] = raw;
          }
        }
      });
      return data;
    },

    importAll(data) {
      if (!data || typeof data !== 'object') return false;
      let count = 0;
      Object.entries(KEYS).forEach(([name, key]) => {
        if (data[name] !== undefined) {
          try {
            rawSet(key, JSON.stringify(data[name]));
            count++;
          } catch (e) {
            console.warn(`[Storage] Import failed for ${name}:`, e);
          }
        }
      });
      _emit('all:imported', { count });
      return count > 0;
    },

    getSize() {
      let total = 0;
      Object.values(KEYS).forEach(k => {
        const raw = rawGet(k);
        if (raw) total += raw.length + k.length;
      });
      return total;
    },

    checkVersion() {
      const storedVersion = rawGet(KEYS.VERSION);
      const current = VERSION;

      if (storedVersion === current) {
        return { migrated: false, version: current };
      }

      const fromVersion = storedVersion || '0.0.0';

      try {
        _migrate(fromVersion, current);
        rawSet(KEYS.VERSION, current);
        _emit('version:migrated', { from: fromVersion, to: current });
        return { migrated: true, from: fromVersion, to: current };
      } catch (e) {
        console.error('[Storage] Migration failed:', e);
        return { migrated: false, error: e };
      }
    },

    on(event, handler) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(handler);
      return () => Storage.off(event, handler);
    },

    off(event, handler) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(h => h !== handler);
    },

    emit(event, data) {
      _emit(event, data);
    }
  };

  /* ─────────────────────────────────────────────
     Migration
     ───────────────────────────────────────────── */
  function _migrate(from, to) {
    console.log(`[Storage] Migrating from ${from} to ${to}`);

    // از نسخه ۶.۰ به ۶.۱.۱
    if (from === '6.0.0' || from.startsWith('6.0') || from === '0.0.0') {
      // 🎯 افزایش سکه به ۵۰۰ برای کاربران فعلی
      const profile = _readJSON(KEYS.PROFILE, DEFAULTS.profile);
      if (!profile.coins || profile.coins < 500) {
        profile.coins = 500;
      }
      _writeJSON(KEYS.PROFILE, profile);

      // افزودن فیلدهای جدید
      const settings = _readJSON(KEYS.SETTINGS, DEFAULTS.settings);
      if (!settings.accent) settings.accent = 'gold';
      if (!settings.cardTheme) settings.cardTheme = 'classic';
      if (!settings.bgTheme) settings.bgTheme = 'gradient';
      if (!settings.aiLevel) settings.aiLevel = 'medium';
      _writeJSON(KEYS.SETTINGS, settings);
    }
  }

  /* ─────────────────────────────────────────────
     Rank / Level از ELO
     ───────────────────────────────────────────── */
  function _getRankFromElo(elo) {
    if (elo >= 2000) return 'افسانه';
    if (elo >= 1800) return 'استاد بزرگ';
    if (elo >= 1600) return 'استاد';
    if (elo >= 1400) return 'حرفه‌ای';
    if (elo >= 1200) return 'متوسط';
    if (elo >= 1000) return 'تازه‌کار';
    return 'مبتدی';
  }

  function _getLevelFromElo(elo) {
    const ranks = [
      { min: 2000, level: 7 },
      { min: 1800, level: 6 },
      { min: 1600, level: 5 },
      { min: 1400, level: 4 },
      { min: 1200, level: 3 },
      { min: 1000, level: 2 }
    ];
    for (const r of ranks) {
      if (elo >= r.min) return r.level;
    }
    return 1;
  }

  /* ─────────────────────────────────────────────
     سیستم رویداد
     ───────────────────────────────────────────── */
  const _listeners = {};

  function _emit(event, data) {
    if (!_listeners[event]) return;
    _listeners[event].forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error(`[Storage] Listener error for "${event}":`, e);
      }
    });
  }

  /* ─────────────────────────────────────────────
     همگام‌سازی بین تب‌ها
     ───────────────────────────────────────────── */
  if (hasLS && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;

      const shortName = e.key.replace(PREFIX, '');
      _emit('cross-tab:' + shortName, {
        key: e.key,
        oldValue: e.oldValue,
        newValue: e.newValue
      });

      _emit('cross-tab', {
        key: e.key,
        shortName,
        newValue: e.newValue
      });
    });
  }

  /* ─────────────────────────────────────────────
     Bootstrap
     ───────────────────────────────────────────── */
  function bootstrap() {
    if (!Storage.has(KEYS.PROFILE)) {
      Storage.setProfile(DEFAULTS.profile);
    }
    if (!Storage.has(KEYS.SETTINGS)) {
      Storage.setSettings(DEFAULTS.settings);
    }
    if (!Storage.has(KEYS.STATS)) {
      Storage.setStats(DEFAULTS.stats);
    }
    if (!Storage.has(KEYS.ACHIEVEMENTS)) {
      Storage.setAchievements(DEFAULTS.achievements);
    }
    if (!Storage.has(KEYS.HISTORY)) {
      Storage.setHistory(DEFAULTS.history);
    }

    Storage.checkVersion();
    Storage.getSave();

    console.log(
      `%c💾 Hokm Storage v${VERSION} ready — ${(Storage.getSize() / 1024).toFixed(1)}KB used`,
      'color: #ffd60a; font-weight: bold;'
    );
  }

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmStorage = Storage;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  } else {
    bootstrap();
  }

})(typeof window !== 'undefined' ? window : globalThis);