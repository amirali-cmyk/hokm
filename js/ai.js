/* ═══════════════════════════════════════════════════════════
   🤖 HOKM PRO v6.0 — ai.js
   هوش مصنوعی ۴ سطحی: Easy / Medium / Hard / Master
   ═══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     ثابت‌ها
     ───────────────────────────────────────────── */
  const LEVELS = {
    easy:   { fa: 'آسان',   icon: '🌱', order: 1 },
    medium: { fa: 'متوسط',  icon: '🥈', order: 2 },
    hard:   { fa: 'سخت',    icon: '🥇', order: 3 },
    master: { fa: 'استاد',  icon: '👑', order: 4 }
  };

  const ALL_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

  /* ─────────────────────────────────────────────
     وضعیت داخلی — حافظه Master
     ───────────────────────────────────────────── */
  const memory = {
    playedCards: new Set(),        // کارت‌های بازی‌شده (id)
    playedByPlayer: {},            // { playerIdx: [cards] }
    suitCounts: {},                // { suit: count باقی‌مانده }
    seen: {},                      // { playerIdx: { suit: Set } }
    hokmRevealed: false,
    lastReset: 0
  };

  /* ─────────────────────────────────────────────
     کمکی‌ها
     ───────────────────────────────────────────── */
  function _resetMemory() {
    memory.playedCards = new Set();
    memory.playedByPlayer = {};
    memory.suitCounts = { spades: 13, hearts: 13, diamonds: 13, clubs: 13 };
    memory.seen = {};
    memory.hokmRevealed = false;
    memory.lastReset = Date.now();
  }

  function _recordPlayedCard(playerIdx, card) {
    if (!card) return;
    memory.playedCards.add(card.id);
    if (!memory.playedByPlayer[playerIdx]) memory.playedByPlayer[playerIdx] = [];
    memory.playedByPlayer[playerIdx].push(card);
    if (memory.suitCounts[card.suit] > 0) {
      memory.suitCounts[card.suit]--;
    }
    if (!memory.seen[playerIdx]) memory.seen[playerIdx] = {};
    if (!memory.seen[playerIdx][card.suit]) memory.seen[playerIdx][card.suit] = new Set();
    memory.seen[playerIdx][card.suit].add(card.rank);
  }

  function _randomFrom(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function _byRankAsc(a, b) { return a.rank - b.rank; }
  function _byRankDesc(a, b) { return b.rank - a.rank; }

  /* ─────────────────────────────────────────────
     گروه‌بندی کارت‌ها بر اساس خال
     ───────────────────────────────────────────── */
  function _groupBySuit(cards) {
    const groups = { spades: [], hearts: [], diamonds: [], clubs: [] };
    cards.forEach(c => groups[c.suit].push(c));
    Object.values(groups).forEach(arr => arr.sort(_byRankAsc));
    return groups;
  }

  /* ─────────────────────────────────────────────
     قدرت خال
     ───────────────────────────────────────────── */
  function _suitStrength(cards, suit) {
    const sameSuit = cards.filter(c => c.suit === suit);
    if (sameSuit.length === 0) return 0;

    let strength = sameSuit.length * 3;
    sameSuit.forEach(c => {
      if (c.rank === 14) strength += 8;
      else if (c.rank === 13) strength += 5;
      else if (c.rank === 12) strength += 3;
      else if (c.rank === 11) strength += 2;
    });
    return strength;
  }

  /* ─────────────────────────────────────────────
     تحلیل دست
     ───────────────────────────────────────────── */
  function _analyzeHand(cards) {
    const groups = _groupBySuit(cards);
    const analysis = {
      total: cards.length,
      bySuit: {},
      aces: cards.filter(c => c.rank === 14).length,
      kings: cards.filter(c => c.rank === 13).length,
      highCards: cards.filter(c => c.rank >= 12).length,
      strongestSuit: null,
      strongestStrength: -1
    };

    ALL_SUITS.forEach(suit => {
      const s = _suitStrength(cards, suit);
      analysis.bySuit[suit] = {
        count: groups[suit].length,
        strength: s,
        cards: groups[suit]
      };
      if (s > analysis.strongestStrength) {
        analysis.strongestStrength = s;
        analysis.strongestSuit = suit;
      }
    });

    return analysis;
  }

  /* ─────────────────────────────────────────────
     کارت‌های "برنده" در trick فعلی
     ───────────────────────────────────────────── */
  function _canWin(card, trick, hokm) {
    // آیا این کارت می‌تواند trick فعلی را ببرد؟
    if (trick.length === 0) return true;

    const leadSuit = trick[0].card.suit;
    const isHokm = card.suit === hokm;
    const isLead = card.suit === leadSuit;

    // بهترین کارت فعلی
    let best = trick[0].card;
    for (let i = 1; i < trick.length; i++) {
      const c = trick[i].card;
      const cIsHokm = c.suit === hokm;
      const bIsHokm = best.suit === hokm;
      if (cIsHokm && !bIsHokm) best = c;
      else if (cIsHokm === bIsHokm && c.suit === best.suit && c.rank > best.rank) best = c;
    }

    const bestIsHokm = best.suit === hokm;
    const bestIsLead = best.suit === leadSuit;

    // اگر کارت ما حکمه
    if (isHokm && !bestIsHokm) return true;
    if (isHokm && bestIsHokm) return card.rank > best.rank;

    // اگر کارت ما همون خال برنده فعلی
    if (card.suit === best.suit) return card.rank > best.rank;

    // اگر کارت ما همون خال جاریه ولی بهترین فعلی خال دیگه
    if (isLead && !bestIsLead && !bestIsHokm) return true;

    return false;
  }

  /* ─────────────────────────────────────────────
     تشخیص هم‌تیمی
     ───────────────────────────────────────────── */
  function _isTeammate(idx1, idx2, gameState) {
    if (!gameState || !gameState.players) return false;
    const p1 = gameState.players[idx1];
    const p2 = gameState.players[idx2];
    if (!p1 || !p2) return false;
    return p1.team === p2.team;
  }

  function _isTeammateWinning(trick, myIdx, gameState) {
    if (trick.length === 0) return false;
    const currentBest = _getCurrentBest(trick, gameState.hokm);
    if (!currentBest) return false;
    return _isTeammate(myIdx, currentBest.playerIdx, gameState);
  }

  function _getCurrentBest(trick, hokm) {
    if (trick.length === 0) return null;
    let best = trick[0];
    for (let i = 1; i < trick.length; i++) {
      const c = trick[i];
      const bc = best.card;
      const cc = c.card;
      const cHokm = cc.suit === hokm;
      const bHokm = bc.suit === hokm;

      if (cHokm && !bHokm) best = c;
      else if (cHokm === bHokm) {
        if (cc.suit === bc.suit && cc.rank > bc.rank) best = c;
        else if (cc.suit === trick[0].card.suit && bc.suit !== trick[0].card.suit && !bHokm) best = c;
      }
    }
    return best;
  }

  /* ─────────────────────────────────────────────
     🟢 سطح ۱: EASY
     ───────────────────────────────────────────── */
  function _easySelectHokm(hand) {
    const analysis = _analyzeHand(hand);
    // فقط اگر خال قوی داره (بیشتر از ۴ کارت هم‌خال)
    const sorted = ALL_SUITS.map(s => ({
      suit: s,
      count: analysis.bySuit[s].count,
      strength: analysis.bySuit[s].strength
    })).sort((a, b) => b.count - a.count);

    if (sorted[0].count >= 4) {
      return sorted[0].suit;
    }
    return _randomFrom(ALL_SUITS);
  }

  function _easySelectCard(player, gameState, valid) {
    return _randomFrom(valid);
  }

  /* ─────────────────────────────────────────────
     🥈 سطح ۲: MEDIUM
     ───────────────────────────────────────────── */
  function _mediumSelectHokm(hand) {
    const analysis = _analyzeHand(hand);
    const best = analysis.strongestSuit;
    // اگر قدرت خال بیش از ۴۰ باشه
    if (analysis.strongestStrength > 40) {
      return best;
    }
    return best || _randomFrom(ALL_SUITS);
  }

  function _mediumSelectCard(player, gameState, valid) {
    const trick = gameState.trick;
    const hokm = gameState.hokm;
    const myIdx = player.seat;

    // اگر اولین نفر هستی
    if (trick.length === 0) {
      // کارت متوسط (نه کمترین، نه بیشترین)
      const sorted = valid.slice().sort(_byRankAsc);
      const midIdx = Math.floor(sorted.length / 2);
      // A با ۵۰٪ احتمال
      const aces = valid.filter(c => c.rank === 14);
      if (aces.length > 0 && Math.random() < 0.5) {
        return aces[0];
      }
      return sorted[midIdx];
    }

    // آیا می‌تونیم ببریم؟
    const winning = valid.filter(c => _canWin(c, trick, hokm));

    // اگر هم‌تیمی برنده است
    if (_isTeammateWinning(trick, myIdx, gameState)) {
      // کمترین کارت غیرحکم
      const nonHokm = valid.filter(c => c.suit !== hokm);
      if (nonHokm.length > 0) return nonHokm.sort(_byRankAsc)[0];
      return valid.sort(_byRankAsc)[0];
    }

    // اگر می‌تونیم ببریم، با کمترین ببر
    if (winning.length > 0) {
      return winning.sort(_byRankAsc)[0];
    }

    // نتونستیم، کمترین بازی کن
    return valid.sort(_byRankAsc)[0];
  }

  /* ─────────────────────────────────────────────
     🥇 سطح ۳: HARD
     ───────────────────────────────────────────── */
  function _hardSelectHokm(hand) {
    const analysis = _analyzeHand(hand);

    // اگر ۲ آس یا بیشتر داری و قدرت > ۳۵
    if (analysis.aces >= 2) {
      // بهترین خال با آس
      const aceSuits = ALL_SUITS.map(s => ({
        suit: s,
        aceCount: analysis.bySuit[s].cards.filter(c => c.rank === 14).length,
        strength: analysis.bySuit[s].strength
      })).filter(s => s.aceCount > 0)
        .sort((a, b) => b.strength - a.strength);

      if (aceSuits.length > 0) return aceSuits[0].suit;
    }

    if (analysis.strongestStrength > 35) {
      return analysis.strongestSuit;
    }

    return analysis.strongestSuit;
  }

  function _hardSelectCard(player, gameState, valid) {
    const trick = gameState.trick;
    const hokm = gameState.hokm;
    const myIdx = player.seat;

    // ─── شروع دور ───
    if (trick.length === 0) {
      const aces = valid.filter(c => c.rank === 14);
      const kings = valid.filter(c => c.rank === 13);

      // A با ۷۰٪ احتمال
      if (aces.length > 0 && Math.random() < 0.7) {
        return aces[0];
      }
      // K اگر A نداری
      if (aces.length === 0 && kings.length > 0) {
        return kings[0];
      }

      // از ضعیف‌ترین خال شروع کن
      const groups = _groupBySuit(valid);
      const sortedByCount = ALL_SUITS.map(s => ({
        suit: s,
        count: groups[s].length,
        cards: groups[s]
      })).filter(g => g.count > 0).sort((a, b) => a.count - b.count);

      if (sortedByCount.length > 0) {
        const weakest = sortedByCount[0];
        // از قوی‌ترین کارت خال ضعیف
        return weakest.cards.sort(_byRankDesc)[0];
      }

      return valid[0];
    }

    // ─── پیرو ───

    // ۱. تشخیص هم‌تیمی برنده
    if (_isTeammateWinning(trick, myIdx, gameState)) {
      const nonHokm = valid.filter(c => c.suit !== hokm);
      const pool = nonHokm.length > 0 ? nonHokm : valid;
      return pool.sort(_byRankAsc)[0];
    }

    // ۲. تلاش برای بردن با کمترین
    const winning = valid.filter(c => _canWin(c, trick, hokm));
    if (winning.length > 0) {
      const sorted = winning.sort(_byRankAsc);
      const lowest = sorted[0];

      // اگر حکم داری، فقط در صورت لزوم استفاده کن
      const isHokm = lowest.suit === hokm;
      const leadSuit = trick[0].card.suit;

      // اگر با کارت غیرحکم هم می‌بریم، حکم رو نگه‌دار
      if (isHokm) {
        const nonHokmWinners = winning.filter(c => c.suit !== hokm);
        if (nonHokmWinners.length > 0) {
          return nonHokmWinners.sort(_byRankAsc)[0];
        }
      }

      return lowest;
    }

    // ۳. نتونستیم → کمترین
    return valid.sort(_byRankAsc)[0];
  }

  /* ─────────────────────────────────────────────
     👑 سطح ۴: MASTER
     ───────────────────────────────────────────── */
  function _masterSelectHokm(hand) {
    const analysis = _analyzeHand(hand);

    // استراتژی چندلایه
    const candidates = ALL_SUITS.map(suit => {
      const info = analysis.bySuit[suit];
      let score = info.strength;

      // امتیاز اضافه برای آس‌ها
      score += info.cards.filter(c => c.rank === 14).length * 15;
      // پادشاه‌ها
      score += info.cards.filter(c => c.rank === 13).length * 8;
      // طول خال
      score += info.count * 5;
      // جریمه برای خالی بودن
      if (info.count === 0) score = -100;

      return { suit, score, info };
    }).sort((a, b) => b.score - a.score);

    // اگر ۱ آس یا بیشتر داری
    if (analysis.aces >= 1 && candidates[0].score > 30) {
      return candidates[0].suit;
    }

    if (analysis.strongestStrength > 32) {
      return analysis.strongestSuit;
    }

    return candidates[0].suit;
  }

  function _masterSelectCard(player, gameState, valid) {
    const trick = gameState.trick;
    const hokm = gameState.hokm;
    const myIdx = player.seat;
    const hand = player.hand;

    // ─── شروع دور ───
    if (trick.length === 0) {
      return _masterLeadCard(player, gameState, valid);
    }

    // ─── پیرو ───

    // ۱. اگر هم‌تیمی برنده است
    if (_isTeammateWinning(trick, myIdx, gameState)) {
      // Bluffing: گاهی کارت متوسط بازی کن تا ضعیف به نظر بیای
      if (Math.random() < 0.15) {
        const sorted = valid.slice().sort(_byRankAsc);
        return sorted[Math.floor(sorted.length / 2)];
      }
      // کمترین کارت غیرحکم
      const nonHokm = valid.filter(c => c.suit !== hokm);
      const pool = nonHokm.length > 0 ? nonHokm : valid;
      return pool.sort(_byRankAsc)[0];
    }

    // ۲. اگر می‌تونیم ببریم
    const winning = valid.filter(c => _canWin(c, trick, hokm));

    if (winning.length > 0) {
      // تلاش برای بردن با کمترین (economic win)
      const sorted = winning.sort(_byRankAsc);
      const cheapest = sorted[0];

      // اگر حکم است ولی با غیرحکم هم می‌بریم، حکم رو ذخیره کن
      if (cheapest.suit === hokm) {
        const nonHokmWinners = winning.filter(c => c.suit !== hokm);
        if (nonHokmWinners.length > 0) {
          return nonHokmWinners.sort(_byRankAsc)[0];
        }
      }

      // Bluffing: ۱۰٪ کارت متوسط بازی کن
      if (Math.random() < 0.10 && sorted.length > 1) {
        return sorted[1];
      }

      return cheapest;
    }

    // ۳. نمی‌تونیم ببریم
    return _masterDiscard(player, gameState, valid);
  }

  /**
   * Master: انتخاب کارت شروع
   */
  function _masterLeadCard(player, gameState, valid) {
    const hand = player.hand;
    const hokm = gameState.hokm;
    const opponentAces = _countRemainingAces(valid);

    // ۱. آس‌های غیرحکم
    const acesNonHokm = valid.filter(c => c.rank === 14 && c.suit !== hokm);
    if (acesNonHokm.length > 0 && Math.random() < 0.85) {
      return acesNonHokm[0];
    }

    // ۲. آس‌های حکم (اگر داری)
    const acesHokm = valid.filter(c => c.rank === 14 && c.suit === hokm);
    if (acesHokm.length > 0 && Math.random() < 0.6) {
      return acesHokm[0];
    }

    // ۳. استراتژی: خالی کردن یک خال برای ساختن حکم
    const groups = _groupBySuit(valid);

    // اگر یک خال داریم که فقط ۱ کارت داره، ازش شروع کن
    const shortSuits = ALL_SUITS
      .filter(s => s !== hokm)
      .map(s => ({ suit: s, cards: groups[s] }))
      .filter(g => g.cards.length === 1);

    if (shortSuits.length > 0 && Math.random() < 0.4) {
      return shortSuits[0].cards[0];
    }

    // ۴. از ضعیف‌ترین خال شروع کن
    const sortedByCount = ALL_SUITS
      .filter(s => s !== hokm)
      .map(s => ({
        suit: s,
        count: groups[s].length,
        cards: groups[s]
      }))
      .filter(g => g.count > 0)
      .sort((a, b) => a.count - b.count);

    if (sortedByCount.length > 0) {
      const weakest = sortedByCount[0];
      // از قوی‌ترین کارت خال ضعیف (برای محافظت)
      return weakest.cards.sort(_byRankDesc)[0];
    }

    return valid[0];
  }

  /**
   * Master: دور انداختن (نتونستیم ببریم)
   */
  function _masterDiscard(player, gameState, valid) {
    const hokm = gameState.hokm;
    const trick = gameState.trick;

    // اگر مجبوریم خال جاری بدیم، کمترین رو بذار
    const leadSuit = trick[0]?.card.suit;

    if (leadSuit) {
      // از خال‌هایی که کم داریم دور کن
      const sorted = valid.sort(_byRankAsc);

      // کارت‌های غیرحکم اول
      const nonHokm = sorted.filter(c => c.suit !== hokm);
      if (nonHokm.length > 0) {
        return nonHokm[0];
      }

      return sorted[0];
    }

    return valid.sort(_byRankAsc)[0];
  }

  /**
   * شمارش آس‌های باقی‌مانده
   */
  function _countRemainingAces(myCards) {
    const myAces = myCards.filter(c => c.rank === 14).map(c => c.suit);
    const remaining = {};
    ALL_SUITS.forEach(suit => {
      remaining[suit] = !myAces.includes(suit) && !memory.playedCards.has(`${suit}_14`);
    });
    return remaining;
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const AI = {

    LEVELS,

    /**
     * انتخاب حکم
     */
    selectHokm(player, gameState) {
      const hand = player.hand || [];
      const level = player.aiLevel || 'medium';

      switch (level) {
        case 'easy':   return _easySelectHokm(hand);
        case 'medium': return _mediumSelectHokm(hand);
        case 'hard':   return _hardSelectHokm(hand);
        case 'master': return _masterSelectHokm(hand);
        default:       return _mediumSelectHokm(hand);
      }
    },

    /**
     * انتخاب کارت برای بازی
     */
    selectCard(player, gameState, valid) {
      if (!valid || valid.length === 0) return null;
      if (valid.length === 1) return valid[0];

      const level = player.aiLevel || 'medium';

      let card;
      switch (level) {
        case 'easy':   card = _easySelectCard(player, gameState, valid); break;
        case 'medium': card = _mediumSelectCard(player, gameState, valid); break;
        case 'hard':   card = _hardSelectCard(player, gameState, valid); break;
        case 'master': card = _masterSelectCard(player, gameState, valid); break;
        default:       card = _mediumSelectCard(player, gameState, valid);
      }

      // ثبت در حافظه (Master)
      if (level === 'master') {
        // خودمان یک کارت انتخاب کردیم، اما بعداً ثبت واقعی در game.js انجام می‌شود
      }

      return card || valid[0];
    },

    /**
     * ثبت کارت بازی‌شده (از game.js صدا زده می‌شود)
     */
    recordPlayedCard(playerIdx, card) {
      _recordPlayedCard(playerIdx, card);
    },

    /**
     * ریست حافظه (در شروع بازی جدید)
     */
    resetMemory() {
      _resetMemory();
    },

    /**
     * مقداردهی حافظه از state بازی
     */
    syncMemory(gameState) {
      if (!gameState) return;
      _resetMemory();

      // کارت‌های بازی‌شده تا الان
      if (gameState.rounds) {
        gameState.rounds.forEach(r => {
          if (r.trick) {
            r.trick.forEach(t => _recordPlayedCard(t.playerIdx, t.card));
          }
        });
      }

      // کارت‌های دور فعلی
      if (gameState.trick) {
        gameState.trick.forEach(t => _recordPlayedCard(t.playerIdx, t.card));
      }
    },

    /**
     * دیباگ: نمایش حافظه
     */
    debugMemory() {
      return {
        playedCards: Array.from(memory.playedCards),
        suitCounts: { ...memory.suitCounts },
        playedByPlayer: { ...memory.playedByPlayer }
      };
    },

    /**
     * پیشنهاد حکم (برای نمایش به کاربر)
     */
    suggestHokm(hand) {
      const analysis = _analyzeHand(hand);
      const suggestions = ALL_SUITS.map(suit => ({
        suit,
        strength: analysis.bySuit[suit].strength,
        count: analysis.bySuit[suit].count
      })).sort((a, b) => b.strength - a.strength);

      return {
        best: suggestions[0].suit,
        all: suggestions
      };
    },

    /**
     * پیشنهاد کارت (برای راهنما)
     */
    suggestCard(player, gameState, valid) {
      // با استفاده از Master برای پیشنهاد بهترین
      const tempPlayer = { ...player, aiLevel: 'master' };
      return _masterSelectCard(tempPlayer, gameState, valid);
    },

    /* ─── اطلاعات ─── */

    /**
     * اطلاعات سطح
     */
    getLevelInfo(level) {
      return LEVELS[level] || LEVELS.medium;
    },

    /**
     * لیست همه سطوح
     */
    listLevels() {
      return Object.entries(LEVELS).map(([key, val]) => ({
        key,
        ...val
      }));
    },

    /**
     * توضیحات هر سطح
     */
    getLevelDescription(level) {
      const descriptions = {
        easy:   'بازی تصادفی — مناسب مبتدیان',
        medium: 'کارت متوسط — پیروی ساده از قوانین',
        hard:   'تشخیص هم‌تیمی و حفظ حکم',
        master: 'حافظه کامل + احتمال‌سنجی + Bluffing'
      };
      return descriptions[level] || descriptions.medium;
    }
  };

  /* ─────────────────────────────────────────────
     Export
     ───────────────────────────────────────────── */
  global.HokmAI = AI;

  console.log(
    '%c🤖 AI loaded — 4 levels (easy/medium/hard/master)',
    'color: #9b5de5; font-weight: bold;'
  );

})(typeof window !== 'undefined' ? window : globalThis);