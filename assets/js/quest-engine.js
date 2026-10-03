/* Mika Be portfolio: the Room of Days reward engine, ported from lib/engine.dart (build 1.0.4+49:
   GameState.roll, commit, applyLevelUps and xpPreview) and lib/content/messages.dart. Pure: no DOM.
   Critical hits and loot drops are left out, so every number is deterministic.

   One completion, as the app computes it:
     base        10 x (0.5 + difficulty x 0.25)
     streak      1 + 0.5 d/7 up to day 7, then min(2, 1.5 + 0.5 (d - 7) / 23); a return after a gap
                 the freezes cannot hold pays at the day-1 multiplier
     dread       x1.35, and +3 to the stat gain
     comeback    x1.5 (WELCOME BACK)
     idle        1 + min(0.5, 0.05 x days since this quest was last done), amplified by Home
     Mind        1 + (Mind / 200) x 0.15, capped at 1.15
     daily caps  x0.5 past 250 XP today, x0.25 past 400 (never shown; three quests stay far below)
     Glimmers    max(1, floor(xp / 3))
     stat gain   max(1, round(difficulty x 1.5)) (+3 when dreaded), halved past 40 of that stat today
     freezes     hold a gap only if they cover all of it; refill on the day's first completion every
                 2 active days at Care 40+ (else 3), up to 7 from level 6
     levels      xpNeeded(level) = 60 + (level - 1) x 45; overflow carries
   A quest stays done for its day (quests.dart: `if (q.doneFor(Clock.now())) return;`), so the app's
   same-day repeat rule can never run here, and it is not ported.

   Start state: the account in the App Store screenshots (test/screenshots_test.dart, "store screenshot
   story"): level 18 at 284 / 870 XP, a 12-day streak with today already active ("Walk after lunch", a
   side quest, is done), 3 freezes ready, Body 88, Care 72, Mind 116, Craft 94, People 61, Home 103, and
   the goal "Make the apartment feel calm" at 11 / 25. Today's three are the three quests below. */
(function (root) {
  "use strict";
  var STATS = ["Body", "Care", "Mind", "Craft", "People", "Home"];
  var ABBR = { Body: "BODY", Care: "CARE", Mind: "MIND", Craft: "CRAFT", People: "PEOPLE", Home: "HOME" };
  var RANK_AT = [0, 10, 25, 50, 100, 200];
  var QUESTS = [
    { id: "read", title: "Read ten pages", stat: "Mind", difficulty: 4 },
    { id: "counter", title: "Clear the kitchen counter", stat: "Home", difficulty: 5, dread: true, goal: "Make the apartment feel calm" },
    { id: "message", title: "Message someone I miss", stat: "People", difficulty: 4 }
  ];
  var START = {
    day: 0, level: 18, xp: 284, glimmers: 0,
    stats: { Body: 88, Care: 72, Mind: 116, Craft: 94, People: 61, Home: 103 },
    streak: 12, best: 12, lastActive: 0, freezes: 3, freezeProgress: 0, freezeBonus: true,
    todayXp: 0, todayStats: {}, history: {}, done: {}, lastDone: {}, seen: {},
    goals: { "Make the apartment feel calm": { progress: 11, target: 25 } },
    completions: 0, nightDone: null, rng: 20260808,
    /* the account's all-time count before today (totalCompletions 138) and the count at its last level-up
       (completionsAtLastLevel, unset on the App Store account, so 0): the level-up's evidence line */
    totalBefore: 138, atLastLevel: 0
  };
  for (var d = -11; d <= 0; d++) START.history[d] = 1; /* a 12-day run; today's 1 is "Walk after lunch" */

  /* lib/content/messages.dart */
  var BY_STAT = {
    Body: ["That’s how strength gets built — one rep at a time.", "Most people skipped their workout today. Not you.", "Your muscles got the memo: we’re leveling up.", "Future-you, mid-hike, says thanks.", "Strong isn’t a look. It’s a stack of days like this.", "The body keeps the receipts. This one’s a deposit."],
    Care: ["Your future self is already breathing easier :)", "That’s a deposit in the long-game health bank.", "Small healthy choices compound — this one counts.", "Boring, repeatable, powerful. That’s the good stuff.", "Energy tomorrow is built quietly today. Nice.", "The unglamorous wins are the ones that last."],
    Mind: ["That keeps you sharp :)", "Pages add up. Readers are dangerous people.", "Your brain just got a little harder to argue with.", "A little smarter than yesterday. That’s the whole trick.", "Curiosity, fed. It’ll pay you back at odd hours.", "Knowledge compounds quieter than money, and longer."],
    Craft: ["Real focus is rare. You just did it.", "That session puts you ahead of everyone still scrolling.", "Deep work logged — that’s where the good stuff happens.", "You out-sat the urge to check your phone. Respect.", "Attention is the rarest currency. You just spent it well.", "That’s the muscle the modern world tries to steal. Trained."],
    People: ["You just made someone’s day a little warmer :)", "Connection logged. Hearts level up too.", "People remember this stuff. Nicely done.", "Reaching out is brave more often than it looks.", "Someone out there is glad you exist today.", "Relationships are a stat too — and you just trained it."],
    Home: ["Your space just got a little more yours.", "A tended home is a quieter mind. You earned some quiet.", "Nobody sees this one but you — which is exactly why it counts.", "Home doesn’t keep itself. Today, you kept it.", "Small upkeep now, no avalanche later. Smart.", "Order, one small act at a time. The room thanks you."]
  };
  var DREAD_LINES = ["The dreaded one. Done. That’s the whole game, right there.", "You did the thing you were avoiding. Everything’s easier now."];
  var COMEBACK_LINES = ["Back at it after a gap — no guilt, just go. This is the move that counts.", "You returned. That’s rarer and braver than never stopping."];
  var NIGHT_LINES = ["Whatever today was — you showed up. That’s the part that compounds.", "Rest is part of the build. Tanks need repairs; so do heroes.", "Tomorrow’s you is already grateful for what you did today.", "The day is logged. Nothing left to carry to bed.", "You don’t have to have won today. You only had to not quit.", "Set it down. The fire will be here in the morning.", "Progress isn’t loud. It’s a hundred quiet nights like this.", "Be proud of the small ones. They were the hard ones."];
  /* the lines the App Store account shows on its first day (store frame 02 and the reference renders) */
  var FIRST_DAY = { read: "Pages add up. Readers are dangerous people.", counter: "You did the thing you were avoiding. Everything’s easier now.", message: "Connection logged. Hearts level up too." };
  /* lib/content/quest_companion_copy.dart: the featured quest's line, one step per day */
  var MAIN_LINES = ["Keep this one within reach.", "A good place to begin.", "Let this be the clear thing."];
  /* lib/content/evidence.dart: the first card for each stat, behind "· WHY" until read */
  var EVIDENCE = {
    Mind: { title: "Start absurdly small", text: "Behaviors stick when they’re too small to refuse — read one page, do two push-ups. The emotion you feel on finishing is what wires the habit, not the size of the session.", source: "BJ Fogg, Stanford Behavior Design Lab" },
    Home: { title: "Anchor habits to moments, not clocks", text: "Behaviors repeated in a stable context — after coffee, before the shower — form habits faster than ones tied to arbitrary times.", source: "Habit formation research, PMC6302524" },
    People: { title: "Connection is a health behavior", text: "One message counts. Reaching out to people you care about protects your mood and your long-term health — social ties rank right alongside exercise in the longevity studies.", source: "Holt-Lunstad meta-analyses" }
  };
  var UNLOCKS = { 2: "STAT DETAILS", 3: "CHARACTER SHEET", 4: "EVIDENCE ARCHIVE", 5: "THEMES", 6: "WEEK-LONG FREEZE RESERVE", 8: "TODAY’S BONUS", 12: "WINDOW VIEWS", 14: "ROOM STYLES+", 15: "GILDED SKIN" };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* Dart's double.round(): half away from zero */
  function dround(v) { return v < 0 ? -Math.round(-v) : Math.round(v); }
  function base(d) { return 10 * (0.5 + d * 0.25); }
  function streakMult(d) { if (d <= 0) return 1; if (d <= 7) return 1 + 0.5 * d / 7; return Math.min(2, 1.5 + 0.5 * (d - 7) / 23); }
  function mindMult(m) { return clamp(1 + (m / 200) * 0.15, 1, 1.15); }
  function homeMult(h) { return clamp(1 + (h / 200) * 0.25, 1, 1.25); }
  function neglectMult(days, home) { if (days <= 0) return 1; return 1 + Math.min(0.5, days * 0.05) * homeMult(home); }
  function dailyCap(todayXp) { return todayXp >= 400 ? 0.25 : todayXp >= 250 ? 0.5 : 1; }
  function xpNeeded(level) { return 60 + (level - 1) * 45; }
  function capacity(level) { return level >= 6 ? 7 : 5; }
  function cadence(care) { return care >= 40 ? 2 : 3; }
  function tierOf(v) { var t = 0; for (var i = 0; i < RANK_AT.length; i++) if (v >= RANK_AT[i]) t = i; return t; }
  function questById(id) { for (var i = 0; i < QUESTS.length; i++) if (QUESTS[i].id === id) return QUESTS[i]; return null; }
  /* a small deterministic generator, so a visit replays the same lines; the state carries its seed */
  function rand(s) { s.rng = (s.rng * 16807) % 2147483647; return (s.rng - 1) / 2147483646; }

  function situation(s) {
    if (s.lastActive === null || s.lastActive === s.day) return { gap: false, days: 0, covered: false };
    var missed = s.day - s.lastActive - 1;
    if (missed <= 0) return { gap: false, days: 0, covered: false };
    return { gap: true, days: missed, covered: s.freezes >= missed };
  }
  function idleDays(s, q) { var last = s.lastDone[q.id]; if (last == null || last === s.day) return 0; return clamp(s.day - last, 0, 30); }
  function isDone(s, id) { return s.done[id] === s.day; }
  function remaining(s) { return QUESTS.filter(function (q) { return !isDone(s, q.id); }).length; }
  function countToday(s) { return s.history[s.day] || 0; }

  /* xpPreview: what the card advertises */
  function preview(s, q) {
    var sit = situation(s), comeback = sit.gap && !sit.covered;
    var earned = base(q.difficulty) * (comeback ? streakMult(1) : streakMult(s.streak));
    if (q.dread) earned *= 1.35;
    earned *= neglectMult(idleDays(s, q), s.stats.Home);
    earned *= mindMult(s.stats.Mind);
    earned *= dailyCap(s.todayXp);
    return dround(earned);
  }

  function pickMessage(s, q, comeback) {
    var n = countToday(s) + 1;
    if (s.day === 0) {
      /* the reference renders: the level-up run (B01) closes Message with its People line; the plain day (A03) reaches
         Message as the 4th completion, counting Walk after lunch, and the app's countToday line answers it */
      if (s.lines && s.lines[q.id]) return s.lines[q.id];
      if (q.id === "message" && n >= 4) return "That makes " + n + " today. You’re on a tear.";
      if (FIRST_DAY[q.id]) return FIRST_DAY[q.id];
    }
    var specials = [];
    if (q.dread) specials = specials.concat(DREAD_LINES);
    if (comeback) specials = specials.concat(COMEBACK_LINES);
    if (n >= 4) specials.push("That makes " + n + " today. You’re on a tear.");
    if (specials.length && rand(s) < 0.6) return specials[Math.floor(rand(s) * specials.length)];
    var list = BY_STAT[q.stat];
    return list[Math.floor(rand(s) * list.length)];
  }

  /* roll: computes the reward and marks the quest done for its day; nothing else changes until commit */
  function roll(s, q) {
    var sit = situation(s), held = sit.gap && sit.covered, comeback = sit.gap && !sit.covered;
    var firstOfDay = s.lastActive !== s.day;
    var freezesUsed = held ? sit.days : 0, reserve = s.freezes - freezesUsed;
    var effStreak = comeback ? streakMult(1) : streakMult(s.streak);
    var earned = base(q.difficulty) * effStreak;
    if (q.dread) earned *= 1.35;
    if (comeback) earned *= 1.5;
    earned *= neglectMult(idleDays(s, q), s.stats.Home);
    earned *= mindMult(s.stats.Mind);
    earned *= dailyCap(s.todayXp);
    var gain = q.difficulty * 1.5;
    if ((s.todayStats[q.stat] || 0) >= 40) gain *= 0.5;
    var statGain = Math.max(1, dround(gain) + (q.dread ? 3 : 0));
    var careAfter = s.stats.Care + (q.stat === "Care" ? statGain : 0), cad = cadence(careAfter);
    var earn = firstOfDay && reserve < capacity(s.level) && s.freezeProgress + 1 >= cad;
    var xp = dround(earned);
    var message = pickMessage(s, q, comeback);
    s.done[q.id] = s.day;
    var goal = q.goal && s.goals[q.goal];
    var b = {
      quest: q.id, title: q.title, stat: q.stat, abbr: ABBR[q.stat], xp: xp, glimmers: Math.max(1, Math.floor(xp / 3)),
      statGain: statGain, dread: !!q.dread, difficulty: q.difficulty, message: message, firstOfDay: firstOfDay,
      streakMult: comeback ? effStreak : (s.streak > 0 ? effStreak : null), comebackMult: comeback ? 1.5 : null,
      shieldHeld: held, freezesUsed: freezesUsed, freezeEarned: earn,
      freezeBalanceAfter: Math.min(capacity(s.level), reserve + (earn ? 1 : 0)),
      freezeProgressAfter: earn ? 0 : Math.min(cad - 1, s.freezeProgress + 1), freezeCadence: cad,
      hasEvidence: !!EVIDENCE[q.stat] && !s.seen[q.stat],
      goalTitle: q.goal || null, goalAfter: goal ? { progress: goal.progress + 1, target: goal.target } : null,
      day: s.day
    };
    /* the level-progress chip reads the state before commit, as the receipt does */
    var next = xpNeeded(s.level + 1), projected = s.xp + xp;
    b.levelProgress = projected >= next ? "LEVEL " + (s.level + 1) + " READY" : (next - projected) + " XP · LEVEL " + (s.level + 1);
    b.magnitude = clamp(0.25 + clamp(xp / 200, 0, 0.35) + (firstOfDay ? 0.15 : 0), 0, 1);
    return b;
  }

  function commit(s, b) {
    var beforeTier = tierOf(s.stats[b.stat]);
    s.xp += b.xp; s.glimmers += b.glimmers;
    s.stats[b.stat] += b.statGain;
    b.rankedUp = tierOf(s.stats[b.stat]) > beforeTier;
    if (s.lastActive !== s.day) {
      var sit = situation(s);
      if (!sit.gap) s.streak += 1;
      else if (sit.covered) { s.freezes -= sit.days; s.streak += 1; }
      else s.streak = 1;
      s.best = Math.max(s.best || 0, s.streak);
      s.lastActive = s.day;
      s.freezes = b.freezeBalanceAfter;
      s.freezeProgress = Math.min(b.freezeCadence - 1, b.freezeProgressAfter);
    }
    s.completions += 1;
    s.history[s.day] = (s.history[s.day] || 0) + 1;
    s.todayXp += b.xp;
    s.todayStats[b.stat] = (s.todayStats[b.stat] || 0) + b.statGain;
    s.lastDone[b.quest] = s.day;
    if (b.goalTitle && s.goals[b.goalTitle]) s.goals[b.goalTitle].progress += 1;
  }

  function applyLevelUps(s) {
    var from = s.level, reached = null;
    while (s.xp >= xpNeeded(s.level + 1)) { s.xp -= xpNeeded(s.level + 1); s.level += 1; reached = s.level; }
    if (s.level >= 6 && !s.freezeBonus) { s.freezeBonus = true; s.freezes = Math.min(capacity(s.level), s.freezes + 2); }
    if (reached === null) return null;
    var next = null;
    Object.keys(UNLOCKS).map(Number).forEach(function (l) { if (l > s.level && (next === null || l < next)) next = l; });
    /* engine.dart applyLevelUps: questsSince = totalCompletions - completionsAtLastLevel, then the mark moves */
    var total = (s.totalBefore || 0) + s.completions, since = total - (s.atLastLevel || 0);
    s.atLastLevel = total;
    return { level: reached, previous: from, previousLevel: from, questsSince: since > 0 ? since : null, unlock: UNLOCKS[reached] || null, nextUnlock: next === null ? null : "Lv " + next + " · " + UNLOCKS[next] };
  }

  function newDay(s, days) { s.day += days; s.todayXp = 0; s.todayStats = {}; }

  /* An engine with the app's one-step undo: the full state from before the last completion, kept until
     the next completion or until a line is kept in the Journal. */
  function create(start) {
    var initial = clone(start || START), state = clone(initial), snap = null, history = [];
    var api = {
      quests: QUESTS,
      get state() { return state; },
      get canUndo() { return !!snap; },
      isDone: function (id) { return isDone(state, id); },
      remaining: function () { return remaining(state); },
      preview: function (id) { return preview(state, questById(id)); },
      companion: function () { return MAIN_LINES[((state.day % 3) + 3 + 2) % 3]; },
      evidence: function (stat) { return EVIDENCE[stat] || null; },
      markSeen: function (stat) { state.seen[stat] = true; },
      night: function () { return NIGHT_LINES[Math.floor(rand(state) * NIGHT_LINES.length)]; },
      /* roll and commit in one call, for tests and for any caller that does not stage the reveal */
      complete: function (id) { var b = api.roll(id); if (b) api.commit(b); return b; },
      roll: function (id) {
        var q = questById(id);
        if (!q || isDone(state, id)) return null;
        snap = clone(state);
        return roll(state, q);
      },
      commit: function (b) { commit(state, b); return state; },
      levelUp: function () { return applyLevelUps(state); },
      undo: function () { if (!snap) return false; state = snap; snap = null; return true; },
      settle: function () { snap = null; },
      closeDay: function () { state.nightDone = state.day; snap = null; },
      /* the next morning: today's three open again */
      nextDay: function () { history.push(clone(state)); snap = null; newDay(state, 1); },
      /* a day passes with nothing done; if today already had a completion, that quiet day is tomorrow */
      skipDay: function () { history.push(clone(state)); snap = null; newDay(state, state.lastActive === state.day ? 2 : 1); },
      situation: function () { return situation(state); },
      reset: function (to) { state = clone(to || initial); snap = null; history = []; },
      snapshot: function () { return clone(state); }
    };
    return api;
  }

  /* the reference renders' level-up run: 850 / 870 XP, two of today's three already kept */
  function nearLevel() {
    var s = clone(START);
    s.xp = 850; s.done = { read: 0, counter: 0 }; s.lastDone = { read: 0, counter: 0 };
    s.stats.Mind = 122; s.stats.Home = 114; s.history[0] = 3; s.completions = 2; s.goals["Make the apartment feel calm"].progress = 12;
    s.seen = { Mind: true, Home: true };
    s.lines = { message: "Connection logged. Hearts level up too." };
    return s;
  }

  var QuestEngine = {
    START: START, QUESTS: QUESTS, STATS: STATS, ABBR: ABBR, RANK_AT: RANK_AT, EVIDENCE: EVIDENCE, UNLOCKS: UNLOCKS,
    create: create, nearLevel: nearLevel, preview: preview, roll: roll, commit: commit, applyLevelUps: applyLevelUps,
    situation: situation, streakMult: streakMult, mindMult: mindMult, homeMult: homeMult, neglectMult: neglectMult,
    xpNeeded: xpNeeded, capacity: capacity, cadence: cadence, base: base, tierOf: tierOf
  };
  if (typeof module !== "undefined" && module.exports) module.exports = QuestEngine;
  if (root) { root.MB = root.MB || {}; root.MB.QuestEngine = QuestEngine; }
})(typeof window !== "undefined" ? window : null);
