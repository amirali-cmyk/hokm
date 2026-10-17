/* ═══════════════════════════════════════════════════════════
   🤖 HOKM PRO v6.0 — ai.js (نسخه نهایی با ارتقای Master)
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
    if (trick.length === 0) return true;

    const leadSuit = trick[0].card.suit;
    const isHokm = card.suit === hokm;
    const isLead = card.suit === leadSuit;

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

    if (isHokm && !bestIsHokm) return true;
    if (isHokm && bestIsHokm) return card.rank > best.rank;
    if (card.suit === best.suit) return card.rank > best.rank;
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
    if (analysis.strongestStrength > 40) {
      return best;
    }
    return best || _randomFrom(ALL_SUITS);
  }

  function _mediumSelectCard(player, gameState, valid) {
    const trick = gameState.trick;
    const hokm = gameState.hokm;
    const myIdx = player.seat;

    if (trick.length === 0) {
      const sorted = valid.slice().sort(_byRankAsc);
      const midIdx = Math.floor(sorted.length / 2);
      const aces = valid.filter(c => c.rank === 14);
      if (aces.length > 0 && Math.random() < 0.5) {
        return aces[0];
      }
      return sorted[midIdx];
    }

    const winning = valid.filter(c => _canWin(c, trick, hokm));

    if (_isTeammateWinning(trick, myIdx, gameState)) {
      const nonHokm = valid.filter(c => c.suit !== hokm);
      if (nonHokm.length > 0) return nonHokm.sort(_byRankAsc)[0];
      return valid.sort(_byRankAsc)[0];
    }

    if (winning.length > 0) {
      return winning.sort(_byRankAsc)[0];
    }

    return valid.sort(_byRankAsc)[0];
  }

  /* ─────────────────────────────────────────────
     🥇 سطح ۳: HARD (هم‌تیمی + حفظ حکم)
     ───────────────────────────────────────────── */
  function _hardSelectHokm(hand) {
    const analysis = _analyzeHand(hand);

    if (analysis.aces >= 2) {
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

      if (aces.length > 0 && Math.random() < 0.7) return aces[0];
      if (aces.length === 0 && kings.length > 0) return kings[0];

      const groups = _groupBySuit(valid);
      const sortedByCount = ALL_SUITS.map(s => ({
        suit: s,
        count: groups[s].length,
        cards: groups[s]
      })).filter(g => g.count > 0).sort((a, b) => a.count - b.count);

      if (sortedByCount.length > 0) {
        const weakest = sortedByCount[0];
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

      if (lowest.suit === hokm) {
        const nonHokmWinners = winning.filter(c => c.suit !== hokm);
        if (nonHokmWinners.length > 0) {
          return nonHokmWinners.sort(_byRankAsc)[0];
        }
      }
      return lowest;
    }

    return valid.sort(_byRankAsc)[0];
  }

  /* ─────────────────────────────────────────────
     👑 سطح ۴: MASTER (حافظه + بلوف + استراتژی)
     ───────────────────────────────────────────── */
  function _masterSelectHokm(hand) {
    const analysis = _analyzeHand(hand);

    const candidates = ALL_SUITS.map(suit => {
      const info = analysis.bySuit[suit];
      let score = info.strength;
      score += info.cards.filter(c => c.rank === 14).length * 15;
      score += info.cards.filter(c => c.rank === 13).length * 8;
      score += info.count * 5;
      if (info.count === 0) score = -100;
      return { suit, score, info };
    }).sort((a, b) => b.score - a.score);

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

    // ─── شروع دور ───
    if (trick.length === 0) {
      return _masterLeadCard(player, gameState, valid);
    }

    // ─── پیرو ───
    // ۱. اگر هم‌تیمی برنده است
    if (_isTeammateWinning(trick, myIdx, gameState)) {
      // 🎭 Bluffing: ۱۵٪ احتمال کارت متوسط برای گول زدن حریف
      if (Math.random() < 0.15) {
        const sorted = valid.slice().sort(_byRankAsc);
        return sorted[Math.floor(sorted.length / 2)];
      }
      const nonHokm = valid.filter(c => c.suit !== hokm);
      const pool = nonHokm.length > 0 ? nonHokm : valid;
      return pool.sort(_byRankAsc)[0];
    }

    // ۲. اگر می‌تونیم ببریم
    const winning = valid.filter(c => _canWin(c, trick, hokm));

    if (winning.length > 0) {
      const sorted = winning.sort(_byRankAsc);
      const cheapest = sorted[0];

      // حفظ حکم
      if (cheapest.suit === hokm) {
        const nonHokmWinners = winning.filter(c => c.suit !== hokm);
        if (nonHokmWinners.length > 0) {
          return nonHokmWinners.sort(_byRankAsc)[0];
        }
      }

      // 🎭 Bluffing: ۱۰٪ احتمال کارت متوسط برای گول زدن حریف
      if (Math.random() < 0.10 && sorted.length > 1) {
        return sorted[1];
      }

      return cheapest;
    }

    // ۳. نمی‌تونیم ببریم
    return _masterDiscard(player, gameState, valid);
  }

  function _masterLeadCard(player, gameState, valid) {
    const hokm = gameState.hokm;

    // ۱. آس‌های غیرحکم
    const acesNonHokm = valid.filter(c => c.rank === 14 && c.suit !== hokm);
    if (acesNonHokm.length > 0 && Math.random() < 0.85) {
      return acesNonHokm[0];
    }

    // ۲. آس‌های حکم
    const acesHokm = valid.filter(c => c.rank === 14 && c.suit === hokm);
    if (acesHokm.length > 0 && Math.random() < 0.6) {
      return acesHokm[0];
    }

    // ۳. خالی کردن خال‌های کوتاه
    const groups = _groupBySuit(valid);
    const shortSuits = ALL_SUITS
      .filter(s => s !== hokm)
      .map(s => ({ suit: s, cards: groups[s] }))
      .filter(g => g.cards.length === 1);

    if (shortSuits.length > 0 && Math.random() < 0.4) {
      return shortSuits[0].cards[0];
    }

    // ۴. شروع از ضعیف‌ترین خال
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
      return weakest.cards.sort(_byRankDesc)[0];
    }

    return valid[0];
  }

  function _masterDiscard(player, gameState, valid) {
    const hokm = gameState.hokm;
    const trick = gameState.trick;
    const leadSuit = trick[0]?.card.suit;

    if (leadSuit) {
      const sorted = valid.sort(_byRankAsc);
      const nonHokm = sorted.filter(c => c.suit !== hokm);
      if (nonHokm.length > 0) return nonHokm[0];
      return sorted[0];
    }

    return valid.sort(_byRankAsc)[0];
  }

  /* ─────────────────────────────────────────────
     API عمومی
     ───────────────────────────────────────────── */
  const AI = {

    LEVELS,

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

      return card || valid[0];
    },

    recordPlayedCard(playerIdx, card) {
      _recordPlayedCard(playerIdx, card);
    },

    resetMemory() {
      _resetMemory();
    },

    syncMemory(gameState) {
      if (!gameState) return;
      _resetMemory();

      if (gameState.rounds) {
        gameState.rounds.forEach(r => {
          if (r.trick) {
            r.trick.forEach(t => _recordPlayedCard(t.playerIdx, t.card));
          }
        });
      }

      if (gameState.trick) {
        gameState.trick.forEach(t => _recordPlayedCard(t.playerIdx, t.card));
      }
    },

    debugMemory() {
      return {
        playedCards: Array.from(memory.playedCards),
        suitCounts: { ...memory.suitCounts },
        playedByPlayer: { ...memory.playedByPlayer }
      };
    },

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

    suggestCard(player, gameState, valid) {
      const tempPlayer = { ...player, aiLevel: 'master' };
      return _masterSelectCard(tempPlayer, gameState, valid);
    },

    getLevelInfo(level) {
      return LEVELS[level] || LEVELS.medium;
    },

    listLevels() {
      return Object.entries(LEVELS).map(([key, val]) => ({
        key,
        ...val
      }));
    },

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