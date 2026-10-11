/* ═══════════════════════════════════════════════════════════
   🎮 HOKM PRO v6.0 — game.js
   قلب بازی: منطق کامل، توزیع، حکم، دورها، امتیازدهی، تایمر
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const SUITS = {
    spades:   { id: 'spades',   symbol: '♠', fa: 'پیک',  color: 'black', order: 0 },
    hearts:   { id: 'hearts',   symbol: '♥', fa: 'دل',   color: 'red',   order: 1 },
    diamonds: { id: 'diamonds', symbol: '♦', fa: 'خشت',  color: 'red',   order: 2 },
    clubs:    { id: 'clubs',    symbol: '♣', fa: 'گشنیز', color: 'black', order: 3 }
  };

  const SUIT_LIST = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const SUIT_NAMES_FA = { spades: 'پیک', hearts: 'دل', diamonds: 'خشت', clubs: 'گشنیز' };

  const RANKS = {
    2:  { id: 2,  symbol: '2' },
    3:  { id: 3,  symbol: '3' },
    4:  { id: 4,  symbol: '4' },
    5:  { id: 5,  symbol: '5' },
    6:  { id: 6,  symbol: '6' },
    7:  { id: 7,  symbol: '7' },
    8:  { id: 8,  symbol: '8' },
    9:  { id: 9,  symbol: '9' },
    10: { id: 10, symbol: '10' },
    11: { id: 11, symbol: 'J' },
    12: { id: 12, symbol: 'Q' },
    13: { id: 13, symbol: 'K' },
    14: { id: 14, symbol: 'A' }
  };

  const PHASES = {
    IDLE: 'idle',
    DEALING: 'dealing',
    HOKM_SELECT: 'hokmSelect',
    PLAYING: 'playing',
    ROUND_END: 'roundEnd',
    GAME_END: 'gameEnd'
  };

  const ROUNDS_TO_WIN = 7;
  const TOTAL_ROUNDS = 13;

  const TIMER_DURATIONS = {
    fast: 15,
    normal: 30,
    slow: 45
  };

  /* ─────────────────────────────────────────────
     وضعیت بازی
     ───────────────────────────────────────────── */
  const state = {
    phase: PHASES.IDLE,
    playerCount: 4,
    players: [],
    deck: [],
    hokm: null,
    hokmCaller: null,
    currentPlayer: 0,
    leader: 0,
    trick: [],
    trickWinner: null,
    trickCount: 0,
    scores: { A: 0, B: 0 },
    rounds: [],
    timer: null,
    timerRemaining: 0,
    timerSpeed: 'normal',
    gameStartTime: 0,
    listeners: [],
    aiThinking: false,
    isPaused: false,
    turnCount: 0
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _storage() { return global.HokmStorage; }
  function _profile() { return global.HokmProfile; }
  function _audio() { return global.HokmAudio; }
  function _ai() { return global.HokmAI; }
  function _ui() { return global.HokmUI; }

  function _emit(event, data) {
    state.listeners.forEach(({ event: e, handler }) => {
      if (e === event || e === '*') {
        try { handler(data); } catch (err) { console.error(err); }
      }
    });
  }

  function _shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ─────────────────────────────────────────────
     ساخت دسته کارت
     ───────────────────────────────────────────── */
  function _createDeck() {
    const deck = [];
    SUIT_LIST.forEach(suit => {
      Object.values(RANKS).forEach(rank => {
        deck.push({
          suit,
          rank: rank.id,
          symbol: rank.symbol,
          id: `${suit}_${rank.id}`
        });
      });
    });
    return deck;
  }

  /* ─────────────────────────────────────────────
     تیم‌بندی — فقط ۲ و ۴ نفره
     ───────────────────────────────────────────── */
  function _assignTeams(count) {
    const teams = [];

    if (count === 4) {
      // ۴ نفره: صندلی ۰، ۲ → تیم A | صندلی ۱، ۳ → تیم B
      for (let i = 0; i < 4; i++) {
        teams.push(i % 2 === 0 ? 'A' : 'B');
      }
    } else {
      // ۲ نفره: صندلی ۰ → A | صندلی ۱ → B
      for (let i = 0; i < count; i++) {
        teams.push(i === 0 ? 'A' : 'B');
      }
    }

    return teams;
  }

  /* ─────────────────────────────────────────────
     ساخت بازیکنان — نام‌های جدید
     ───────────────────────────────────────────── */
  function _createPlayers(count, aiLevel) {
    const players = [];
    const profile = _profile()?.get() || { name: 'تو', avatar: '😎' };
    const teams = _assignTeams(count);

    // 🎯 نام‌های جدید:
    //   صندلی ۰ (پایین) = تو
    //   صندلی ۱ (چپ) = P1 (حریف)
    //   صندلی ۲ (روبرو) = هم‌تیمی
    //   صندلی ۳ (راست) = P2 (حریف)
    const aiConfigs = [
      { name: 'P1', avatar: '🤖' },        // چپ
      { name: 'هم‌تیمی', avatar: '🤝' },    // روبرو
      { name: 'P2', avatar: '🤖' }         // راست
    ];

    for (let i = 0; i < count; i++) {
      if (i === 0) {
        players.push({
          id: 'me',
          name: profile.name || 'تو',
          avatar: profile.avatar || '😎',
          hand: [],
          isAI: false,
          aiLevel: null,
          team: teams[i],
          seat: i
        });
      } else {
        const cfg = aiConfigs[i - 1] || { name: `AI ${i}`, avatar: '🤖' };
        players.push({
          id: 'ai_' + i,
          name: cfg.name,
          avatar: cfg.avatar,
          hand: [],
          isAI: true,
          aiLevel: aiLevel || 'medium',
          team: teams[i],
          seat: i
        });
      }
    }

    return players;
  }

  /* ─────────────────────────────────────────────
     توزیع کارت
     ───────────────────────────────────────────── */
  function _dealCards() {
    const deck = _shuffle(_createDeck());
    const count = state.playerCount;

    // ۴ نفره: ۱۳ کارت هر نفر
    // ۲ نفره: ۲۶ کارت هر نفر
    const handSize = count === 2 ? 26 : 13;

    let idx = 0;
    for (let i = 0; i < count; i++) {
      state.players[i].hand = [];
    }

    // توزیع یکی یکی
    for (let round = 0; round < handSize; round++) {
      for (let p = 0; p < count; p++) {
        state.players[p].hand.push(deck[idx++]);
      }
    }

    _sortHand(state.players[0]);
    state.deck = deck.slice(idx);
    return state.players.map(p => p.hand);
  }

  function _sortHand(player) {
    if (!player || !player.hand) return;
    player.hand.sort((a, b) => {
      const suitDiff = SUITS[a.suit].order - SUITS[b.suit].order;
      if (suitDiff !== 0) return suitDiff;
      return b.rank - a.rank;
    });
  }

  /* ─────────────────────────────────────────────
     حکم‌خوانی
     ───────────────────────────────────────────── */
  function _pickRandomHokmCaller() {
    return Math.floor(Math.random() * state.playerCount);
  }

  function _calculateSuitStrength(hand, suit) {
    let strength = 0;
    hand.forEach(card => {
      if (card.suit === suit) {
        strength += card.rank;
        if (card.rank === 14) strength += 5;  // A
        if (card.rank === 13) strength += 2;  // K
      }
    });
    return strength;
  }

  /**
   * 🎯 AI خودکار حکم انتخاب می‌کنه — کاربر باید از UI انتخاب کنه
   */
  async function _autoSelectHokm(callerIdx) {
    const player = state.players[callerIdx];

    // ═══ اگه کاربر خودت هستی ═══
    if (!player.isAI) {
      console.log(
        '%c👑 نوبت توئه! پنجره انتخاب حکم باز شده',
        'color: #06d6a0; font-weight: bold; font-size: 14px;'
      );
      // ⚠️ هیچ کاری نمی‌کنیم — منتظر انتخاب کاربر از UI می‌مونیم
      return;
    }

    // ═══ اگه AI هستی ═══
    // 🎯 تأخیر ۸۰۰ میلی‌ثانیه (قبلاً ۱۰۰۰ بود)
    await _delay(8000);

    const strengths = SUIT_LIST.map(suit => ({
      suit,
      strength: _calculateSuitStrength(player.hand, suit)
    }));
    strengths.sort((a, b) => b.strength - a.strength);
    const bestSuit = strengths[0].suit;

    console.log(
      `%c👑 ${player.name} حکم ${SUIT_NAMES_FA[bestSuit]} (${SUIT_SYMBOLS[bestSuit]}) رو انتخاب کرد`,
      'color: #ffd60a; font-weight: bold; font-size: 13px;'
    );

    await _setHokm(bestSuit, callerIdx);
  }

  /**
   * 🎯 تنظیم حکم و شروع بازی
   */
  async function _setHokm(suit, callerIdx) {
    if (!SUIT_LIST.includes(suit)) {
      console.warn('❌ خال نامعتبر:', suit);
      return;
    }

    state.hokm = suit;
    state.hokmCaller = callerIdx;

    console.log(
      `%c👑 حکم نهایی: ${SUIT_SYMBOLS[suit]} ${SUIT_NAMES_FA[suit]}`,
      'color: #ffd60a; font-weight: bold; font-size: 14px;'
    );

    _emit('hokm:set', {
      suit,
      callerIdx,
      player: state.players[callerIdx]
    });

    if (_audio()) _audio().play('claimHokm');
    if (_ui() && _ui().updateHokmDisplay) {
      _ui().updateHokmDisplay(suit);
    }

    await _delay(1200);
    _startPlaying();
  }

  /* ─────────────────────────────────────────────
     شروع فاز بازی
     ───────────────────────────────────────────── */
  function _startPlaying() {
    state.phase = PHASES.PLAYING;
    state.trickCount = 0;
    state.scores = { A: 0, B: 0 };
    state.rounds = [];

    // شروع‌کننده: نفر بعد از حکم‌خوان
    state.leader = (state.hokmCaller + 1) % state.playerCount;
    state.currentPlayer = state.leader;
    state.trick = [];

    _emit('phase:changed', { phase: PHASES.PLAYING });
    _emit('game:started', { hokm: state.hokm, leader: state.leader });

    console.log(
      `%c🎮 شروع بازی — شروع‌کننده: ${state.players[state.leader].name}`,
      'color: #06d6a0; font-weight: bold;'
    );

    _startTurn();
  }

  /* ═══════════════════════════════════════════════════════════
     🎯 قانون طلایی: پیروی از خال
     ═══════════════════════════════════════════════════════════ */

  /**
   * 🎯 کارت‌های مجاز برای بازی
   *
   * قانون:
   *   ۱. اولین نفر دور → همه کارت‌ها
   *   ۲. پیرو:
   *      الف) هم‌خال داره → فقط هم‌خال‌ها
   *      ب) هم‌خال نداره → همه کارت‌ها
   */
  function _getValidCards(playerIdx) {
    const player = state.players[playerIdx];
    if (!player || !player.hand || player.hand.length === 0) return [];

    // حالت ۱: اولین نفر دور
    if (state.trick.length === 0) {
      return player.hand.slice();
    }

    // حالت ۲: پیرو
    const leadSuit = state.trick[0].card.suit;
    const sameSuit = player.hand.filter(c => c.suit === leadSuit);

    if (sameSuit.length > 0) {
      // 🔴 قانون سخت: فقط هم‌خال
      return sameSuit;
    }

    // خال جاری نداره → همه مجاز
    return player.hand.slice();
  }

  /**
   * 🎯 بررسی اعتبار یک کارت خاص
   */
  function _isValidCard(playerIdx, card) {
    if (!card) return false;
    const valid = _getValidCards(playerIdx);
    return valid.some(c => c.id === card.id);
  }

  /* ─────────────────────────────────────────────
     برنده دور
     ───────────────────────────────────────────── */
  function _determineTrickWinner() {
    if (state.trick.length === 0) return null;

    const leadSuit = state.trick[0].card.suit;
    const hokm = state.hokm;

    let winner = state.trick[0];

    for (let i = 1; i < state.trick.length; i++) {
      const current = state.trick[i];
      const wCard = winner.card;
      const cCard = current.card;

      const wIsHokm = wCard.suit === hokm;
      const cIsHokm = cCard.suit === hokm;

      // کارت حکم برنده می‌شه
      if (cIsHokm && !wIsHokm) {
        winner = current;
        continue;
      }

      if (cIsHokm === wIsHokm) {
        // اگه هر دو همون خال → بالاترین رتبه
        if (cCard.suit === wCard.suit) {
          if (cCard.rank > wCard.rank) {
            winner = current;
          }
        }
        // اگه کارت جدید خال جاریه و برنده قبلی نه
        else if (cCard.suit === leadSuit && wCard.suit !== leadSuit) {
          winner = current;
        }
      }
    }

    return winner;
  }

  /* ─────────────────────────────────────────────
     نوبت
     ───────────────────────────────────────────── */
  function _startTurn() {
    if (state.phase !== PHASES.PLAYING) return;

    // بررسی پایان بازی
    if (state.scores.A >= ROUNDS_TO_WIN || state.scores.B >= ROUNDS_TO_WIN) {
      _endGame();
      return;
    }
    if (state.trickCount >= TOTAL_ROUNDS) {
      _endGame();
      return;
    }

    _emit('turn:start', {
      playerIdx: state.currentPlayer,
      player: state.players[state.currentPlayer],
      trickCount: state.trickCount
    });

    _startTimer();

    // اگه AI است، خودکار بازی کن
    const player = state.players[state.currentPlayer];
    if (player.isAI) {
      _aiPlay();
    }
  }

  function _startTimer() {
    _stopTimer();

    const duration = TIMER_DURATIONS[state.timerSpeed] || 30;
    state.timerRemaining = duration;

    _emit('timer:start', { duration });

    state.timer = setInterval(() => {
      if (state.isPaused) return;

      state.timerRemaining--;

      _emit('timer:tick', {
        remaining: state.timerRemaining,
        duration
      });

      if (state.timerRemaining === 10 && _audio()) {
        _audio().play('countdown');
      }

      if (state.timerRemaining <= 0) {
        _stopTimer();
        _onTimeout();
      }
    }, 1000);
  }

  function _stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    _emit('timer:stop');
  }

  function _onTimeout() {
    _emit('turn:timeout', { playerIdx: state.currentPlayer });

    if (_audio()) _audio().play('timeout');

    const player = state.players[state.currentPlayer];

    if (!player.isAI) {
      // بازیکن خودت → یک کارت معتبر تصادفی
      const valid = _getValidCards(state.currentPlayer);
      if (valid.length > 0) {
        const card = valid[Math.floor(Math.random() * valid.length)];
        Game.playCard(state.currentPlayer, card);
      }
    } else {
      // AI → از تابع AI استفاده کن
      _aiPlay();
    }
  }

  /* ─────────────────────────────────────────────
     AI نوبت
     ───────────────────────────────────────────── */
  async function _aiPlay() {
    if (state.aiThinking) return;
    state.aiThinking = true;

    try {
      const playerIdx = state.currentPlayer;
      const player = state.players[playerIdx];

      // فکر کن
      await _delay(600 + Math.random() * 8000);

      if (state.phase !== PHASES.PLAYING) {
        state.aiThinking = false;
        return;
      }
      if (state.currentPlayer !== playerIdx) {
        state.aiThinking = false;
        return;
      }

      // کارت‌های مجاز
      const valid = _getValidCards(playerIdx);
      if (valid.length === 0) {
        console.warn('⚠️ AI has no valid cards!');
        state.aiThinking = false;
        return;
      }

      let card;

      if (_ai() && typeof _ai().selectCard === 'function') {
        card = _ai().selectCard(player, state, valid);
      } else {
        card = valid[Math.floor(Math.random() * valid.length)];
      }

      // اطمینان نهایی: کارت باید در valid باشه
      if (!card || !valid.some(c => c.id === card.id)) {
        console.warn('⚠️ AI selected invalid card, using fallback');
        card = valid[0];
      }

      Game.playCard(playerIdx, card);

    } finally {
      state.aiThinking = false;
    }
  }

  /* ─────────────────────────────────────────────
     پایان دور
     ───────────────────────────────────────────── */
  async function _endTrick() {
    state.phase = PHASES.ROUND_END;

    _emit('trick:end', {
      trick: state.trick.slice(),
      winner: state.trickWinner
    });

    if (_audio()) {
      const isMyTeam = state.players[state.trickWinner].team ===
                      state.players[0].team;
      _audio().play(isMyTeam ? 'winTrick' : 'loseTrick');
    }

    const winnerTeam = state.players[state.trickWinner].team;
    state.scores[winnerTeam]++;
    state.trickCount++;
    state.rounds.push({
      trick: state.trick.slice(),
      winner: state.trickWinner,
      team: winnerTeam
    });

    _emit('score:changed', {
      scores: state.scores,
      trickCount: state.trickCount
    });

    if (_ui() && _ui().animateTrickWinner) {
      _ui().animateTrickWinner(state.trickWinner, state.trick);
    }

    await _delay(1500);

    // بررسی پایان
    if (state.scores.A >= ROUNDS_TO_WIN || state.scores.B >= ROUNDS_TO_WIN) {
      _endGame();
      return;
    }
    if (state.trickCount >= TOTAL_ROUNDS) {
      _endGame();
      return;
    }

    // دور جدید
    state.leader = state.trickWinner;
    state.currentPlayer = state.trickWinner;
    state.trickWinner = null;
    state.trick = [];  // ⬅️ مهم
    state.phase = PHASES.PLAYING;

    _emit('trick:new', { leader: state.leader });
    _startTurn();
  }

  /* ─────────────────────────────────────────────
     پایان بازی
     ───────────────────────────────────────────── */
  function _endGame() {
    state.phase = PHASES.GAME_END;
    _stopTimer();

    const myTeam = state.players[0].team;
    const myScore = state.scores[myTeam];
    const opponentTeam = myTeam === 'A' ? 'B' : 'A';
    const opponentScore = state.scores[opponentTeam];
    const win = myScore > opponentScore;

    const duration = Date.now() - state.gameStartTime;

    let eloChange = 0;
    if (_profile() && typeof _profile().calculateElo === 'function') {
      const aiLevelElos = { easy: 900, medium: 1100, hard: 1400, master: 1700 };
      const aiElo = aiLevelElos[state.players[1]?.aiLevel] || 1100;
      eloChange = _profile().calculateElo(aiElo, win);
    }

    const result = {
      win,
      scoreA: state.scores.A,
      scoreB: state.scores.B,
      myScore,
      opponentScore,
      rounds: state.rounds.slice(),
      eloChange,
      durationMs: duration,
      mode: 'ai',
      aiLevel: state.players[1]?.aiLevel
    };

    console.log(
      `%c🏁 بازی تمام شد — ${win ? 'برد' : 'باخت'} (${myScore}-${opponentScore})`,
      `color: ${win ? '#06d6a0' : '#ef476f'}; font-weight: bold; font-size: 16px;`
    );

    _emit('game:ended', result);

    if (_audio()) {
      _audio().play(win ? 'win' : 'lose');
    }

    if (_storage() && typeof _storage().recordGame === 'function') {
      _storage().recordGame({
        ...result,
        roundsWon: myScore,
        hokmClaimed: state.hokmCaller === 0 ? 1 : 0,
        hokmWon: state.hokmCaller === 0 && win ? 1 : 0
      });
    }

    if (_storage() && typeof _storage().clearSave === 'function') {
      _storage().clearSave();
    }

    if (_ui() && _ui().showGameEnd) {
      _ui().showGameEnd(result);
    }
  }

  /* ─────────────────────────────────────────────
     ذخیره/بارگذاری
     ───────────────────────────────────────────── */
  function _saveCurrentGame() {
    if (state.phase === PHASES.IDLE || state.phase === PHASES.GAME_END) return;

    const saveData = {
      phase: state.phase,
      playerCount: state.playerCount,
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        hand: p.hand,
        isAI: p.isAI,
        aiLevel: p.aiLevel,
        team: p.team,
        seat: p.seat
      })),
      deck: state.deck,
      hokm: state.hokm,
      hokmCaller: state.hokmCaller,
      currentPlayer: state.currentPlayer,
      leader: state.leader,
      trick: state.trick,
      scores: state.scores,
      rounds: state.rounds,
      trickCount: state.trickCount,
      timerSpeed: state.timerSpeed,
      gameStartTime: state.gameStartTime
    };

    if (_storage() && typeof _storage().setSave === 'function') {
      _storage().setSave(saveData);
    }
  }

  function _loadSavedGame() {
    if (!_storage()) return false;
    const save = _storage().getSave();
    if (!save) return false;

    state.phase = save.phase;
    state.playerCount = save.playerCount;
    state.players = save.players;
    state.deck = save.deck || [];
    state.hokm = save.hokm;
    state.hokmCaller = save.hokmCaller;
    state.currentPlayer = save.currentPlayer;
    state.leader = save.leader;
    state.trick = save.trick || [];
    state.scores = save.scores || { A: 0, B: 0 };
    state.rounds = save.rounds || [];
    state.trickCount = save.trickCount || 0;
    state.timerSpeed = save.timerSpeed || 'normal';
    state.gameStartTime = save.gameStartTime || Date.now();

    return true;
  }

  /* ═══════════════════════════════════════════
     API عمومی
     ═══════════════════════════════════════════ */
  const Game = {

    PHASES,
    SUITS,
    SUIT_LIST,
    SUIT_SYMBOLS,
    SUIT_NAMES_FA,
    RANKS,
    ROUNDS_TO_WIN,
    TOTAL_ROUNDS,

    /* ─── راه‌اندازی ─── */

    async start(options = {}) {
      const settings = _storage()?.getSettings() || {};

      // 🎯 فقط ۲ یا ۴ نفره مجاز
      let playerCount = options.playerCount || settings.playerCount || 4;
      if (playerCount !== 2 && playerCount !== 4) {
        console.warn('[Game] playerCount نامعتبر:', playerCount, '— استفاده از ۴');
        playerCount = 4;
      }

      state.playerCount = playerCount;
      state.timerSpeed = options.timerSpeed || settings.timerSpeed || 'normal';
      const aiLevel = options.aiLevel || settings.aiLevel || 'medium';

      // ریست کامل
      state.phase = PHASES.IDLE;
      state.deck = [];
      state.hokm = null;
      state.hokmCaller = null;
      state.currentPlayer = 0;
      state.leader = 0;
      state.trick = [];
      state.trickWinner = null;
      state.trickCount = 0;
      state.scores = { A: 0, B: 0 };
      state.rounds = [];
      state.gameStartTime = Date.now();
      state.isPaused = false;
      state.turnCount = 0;
      state.aiThinking = false;

      // ساخت بازیکنان
      state.players = _createPlayers(state.playerCount, aiLevel);

      console.log(
        `%c🎬 شروع بازی — ${playerCount} نفره با AI سطح ${aiLevel}`,
        'color: #ffd60a; font-weight: bold; font-size: 14px;'
      );

      if (_audio()) _audio().play('gameStart');

      state.phase = PHASES.DEALING;
      _emit('phase:changed', { phase: PHASES.DEALING });
      _emit('game:start', {
        players: state.players,
        playerCount: state.playerCount
      });

      await _delay(300);

      if (_audio()) _audio().play('shuffle');
      await _delay(600);

      const hands = _dealCards();

      _emit('cards:dealt', {
        hands,
        players: state.players
      });

      for (let i = 0; i < 13; i++) {
        if (_audio()) _audio().play('deal');
        await _delay(60);
      }

      await _delay(500);

      // ═══ حکم‌خوانی ═══
      state.phase = PHASES.HOKM_SELECT;
      const callerIdx = _pickRandomHokmCaller();
      state.hokmCaller = callerIdx;

      _emit('phase:changed', { phase: PHASES.HOKM_SELECT });

      // 🎯 رویداد حکم‌خوانی برای هایلایت + تاج
      _emit('hokm:selecting', {
        callerIdx,
        player: state.players[callerIdx]
      });

      console.log(
        `%c👑 حکم‌خوان انتخاب شد: ${state.players[callerIdx].name}`,
        'color: #ffd60a; font-weight: bold; font-size: 14px;'
      );

      if (callerIdx === 0) {
        // 🎯 نوبت کاربر — منتظر انتخابش بمون
        console.log(
          '%c👑 نوبت توئه! پنجره انتخاب حکم باز شد',
          'color: #06d6a0; font-weight: bold;'
        );
        _emit('hokm:waitingForUser', { player: state.players[0] });
      } else {
        // AI خودش انتخاب می‌کنه (بعد ۸۰۰ms)
        _autoSelectHokm(callerIdx);
      }

      return state;
    },

    pause() {
      state.isPaused = true;
      _emit('game:paused');
    },

    resume() {
      state.isPaused = false;
      _emit('game:resumed');
    },

    quit() {
      _stopTimer();
      state.phase = PHASES.IDLE;
      _saveCurrentGame();
      _emit('game:quit');
    },

    /* ─── کاربر ─── */

    selectHokm(suit) {
      if (state.phase !== PHASES.HOKM_SELECT) {
        console.warn('❌ Not in hokm selection phase');
        return false;
      }
      if (state.hokmCaller !== 0) {
        console.warn('❌ Not your turn to select hokm');
        return false;
      }
      if (!SUIT_LIST.includes(suit)) {
        console.warn('❌ Invalid suit:', suit);
        return false;
      }

      console.log(
        `%c🎴 کاربر حکم ${SUIT_SYMBOLS[suit]} ${SUIT_NAMES_FA[suit]} رو انتخاب کرد`,
        'color: #06d6a0; font-weight: bold; font-size: 14px;'
      );

      _setHokm(suit, 0);
      return true;
    },

    /**
     * 🎯 بازی یک کارت
     */
    playCard(playerIdx, card) {
      if (state.phase !== PHASES.PLAYING) {
        console.warn('❌ Not playing');
        return false;
      }
      if (state.currentPlayer !== playerIdx) {
        console.warn('❌ Not your turn');
        return false;
      }
      if (!card) {
        console.warn('❌ No card');
        return false;
      }

      const player = state.players[playerIdx];
      if (!player) return false;

      // 🔴 بررسی قانون پیروی از خال
      const validCards = _getValidCards(playerIdx);
      const validIds = validCards.map(c => c.id);

      if (!validIds.includes(card.id)) {
        const leadSuit = state.trick[0]?.card.suit;
        const leadName = SUIT_NAMES_FA[leadSuit] || '?';

        console.warn(
          `❌ کارت غیرمجاز! بازیکن ${playerIdx} (${player.name}) ` +
          `می‌خواد ${card.id} بازی کنه ولی باید از ${leadSuit} (${leadName}) بازی کنه`
        );

        _emit('card:invalid', {
          playerIdx,
          card,
          leadSuit,
          validCards: validIds
        });

        if (_audio()) _audio().play('error');

        if (_ui() && playerIdx === 0) {
          _ui().showToast(
            '❌ کارت غیرمجاز',
            `باید از خال ${leadName} بازی کنی!`,
            'error',
            2500
          );
        }

        return false;
      }

      // حذف کارت از دست
      const idx = player.hand.findIndex(c => c.id === card.id);
      if (idx === -1) return false;
      player.hand.splice(idx, 1);

      // اضافه به دور
      state.trick.push({ playerIdx, card });

      _stopTimer();

      _emit('card:played', {
        playerIdx,
        player,
        card,
        trick: state.trick.slice()
      });

      if (_audio()) _audio().play('playCard');

      // آیا همه بازی کردن؟
      if (state.trick.length === state.playerCount) {
        const winner = _determineTrickWinner();
        state.trickWinner = winner.playerIdx;

        _emit('trick:completed', {
          trick: state.trick.slice(),
          winner: winner.playerIdx
        });

        setTimeout(() => _endTrick(), 800);
      } else {
        state.currentPlayer = (state.currentPlayer + 1) % state.playerCount;
        setTimeout(() => _startTurn(), 350);
      }

      _saveCurrentGame();
      return true;
    },

    getValidCards(playerIdx) {
      return _getValidCards(playerIdx);
    },

    /* ─── Getterها ─── */

    getState() {
      return {
        phase: state.phase,
        playerCount: state.playerCount,
        players: state.players,
        hokm: state.hokm,
        hokmCaller: state.hokmCaller,
        currentPlayer: state.currentPlayer,
        leader: state.leader,
        trick: state.trick.slice(),
        scores: { ...state.scores },
        trickCount: state.trickCount,
        timerRemaining: state.timerRemaining,
        isPaused: state.isPaused
      };
    },

    getMyHand() {
      return state.players[0]?.hand?.slice() || [];
    },

    getMyTeam() {
      return state.players[0]?.team || 'A';
    },

    getHokm() {
      return state.hokm;
    },

    getCurrentPlayer() {
      return state.currentPlayer;
    },

    getScores() {
      return { ...state.scores };
    },

    getPhase() {
      return state.phase;
    },

    isMyTurn() {
      return state.currentPlayer === 0 && state.phase === PHASES.PLAYING;
    },

    isWaitingForMyHokm() {
      return state.phase === PHASES.HOKM_SELECT && state.hokmCaller === 0;
    },

    /* ─── ذخیره/بازیابی ─── */

    hasSavedGame() {
      return _storage()?.hasSave() || false;
    },

    loadSaved() {
      const ok = _loadSavedGame();
      if (ok) {
        _emit('game:loaded', Game.getState());
      }
      return ok;
    },

    clearSaved() {
      _storage()?.clearSave();
    },

    /* ─── رویدادها ─── */

    on(event, handler) {
      const entry = { event, handler };
      state.listeners.push(entry);
      return () => Game.off(event, handler);
    },

    off(event, handler) {
      state.listeners = state.listeners.filter(
        l => !(l.event === event && l.handler === handler)
      );
    },

    /**
     * 🆘 دیباگ
     */
    debug() {
      const leadSuit = state.trick[0]?.card?.suit;
      const myValid = _getValidCards(0).map(c => c.id);

      console.log('%c═══ GAME DEBUG ═══', 'color: #ffd60a; font-weight: bold; font-size: 14px;');
      console.log('Phase:', state.phase);
      console.log('Hokm:', state.hokm, '(' + (SUIT_NAMES_FA[state.hokm] || '?') + ')');
      console.log('Current Player:', state.currentPlayer, '(' + (state.players[state.currentPlayer]?.name || '?') + ')');
      console.log('Trick Cards:', state.trick.map(t => ({
        player: t.playerIdx,
        name: state.players[t.playerIdx]?.name,
        card: t.card.id
      })));
      console.log('Lead Suit:', leadSuit, '(' + (SUIT_NAMES_FA[leadSuit] || '?') + ')');
      console.log('Valid Cards for me:', myValid);
      console.log('My Hand:', state.players[0]?.hand.map(c => c.id));
      console.log('Scores:', state.scores);
      console.log('%c═══════════════════', 'color: #ffd60a; font-weight: bold; font-size: 14px;');
    }
  };

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmGame = Game;

  console.log(
    '%c🎮 Game logic loaded (v6.0 — با نام‌های P1/هم‌تیمی/P2)',
    'color: #ef476f; font-weight: bold; font-size: 13px;'
  );

})(typeof window !== 'undefined' ? window : globalThis);