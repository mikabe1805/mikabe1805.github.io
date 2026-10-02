/* Mika Be portfolio: the Room of Days reward formula, ported from lib/engine.dart (build 1.0.4+49,
   GameState.roll and commit, lines ~1559-1910). Pure: no DOM. Critical hits and loot are left out.
     base        10 x (0.5 + difficulty x 0.25)            difficulty 4 -> 15
     streak      1 + 0.5 d/7 up to day 7, then min(2, 1.5 + 0.5 (d-7)/23), from streakDays before commit
     Mind        1 + (Mind/200) x 0.15, capped at 1.15     (intXpMult)
     idle        1 + min(0.5, 0.05 x days) amplified by Home: 1 + (Home/200) x 0.25   (neglect x disNeglectMult)
     same day    100% / 50% / 25% / 10%                    (sameDayDecay)
     daily caps  x0.5 at 250 XP today, x0.25 at 400
     Glimmers    max(1, floor(xp / 3))
     stat gain   max(1, round(difficulty x 1.5 x decay)), halved past 40 of that stat today
     freezes     cover a gap only if they cover all of it; otherwise a comeback: streak 1 and x1.5
     refill      first completion of a day, when progress + 1 reaches the cadence (2 at Care 40+, else 3)
                 and the reserve is under capacity (7 from level 6, else 5)
     levels      xpNeeded(level) = 60 + (level - 1) x 45
   Start state: the account in the App Store screenshots (level 18, 284 / 870 XP, 12-day streak,
   3 freezes ready, Body 88, Care 72, Mind 116, Craft 94, People 61, Home 103). */
(function (root) {
  "use strict";
  var STATS = ["Body", "Care", "Mind", "Craft", "People", "Home"];
  var START = {
    day: 0, level: 18, xp: 284, glimmers: 0,
    stats: { Body: 88, Care: 72, Mind: 116, Craft: 94, People: 61, Home: 103 },
    streak: 12, lastActive: -1, freezes: 3, freezeProgress: 0,
    todayCount: 0, todayXp: 0, todayStat: 0, lastDone: null, ledger: []
  };
  var QUEST = { title: "Read ten pages", difficulty: 4, stat: "Mind" };
  var DECAY = [1, 0.5, 0.25, 0.1];
  var ORD = ["first", "second", "third", "fourth"];

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function base(d) { return 10 * (0.5 + d * 0.25); }
  function streakMult(d) { if (d <= 0) return 1; if (d <= 7) return 1 + 0.5 * d / 7; return Math.min(2, 1.5 + 0.5 * (d - 7) / 23); }
  function mindMult(m) { return clamp(1 + (m / 200) * 0.15, 1, 1.15); }
  function homeMult(h) { return clamp(1 + (h / 200) * 0.25, 1, 1.25); }
  function neglectMult(days, home) { if (days <= 0) return 1; return 1 + Math.min(0.5, days * 0.05) * homeMult(home); }
  function dailyCap(todayXp) { return todayXp >= 400 ? 0.25 : todayXp >= 250 ? 0.5 : 1; }
  function xpNeeded(level) { return 60 + (level - 1) * 45; }
  function capacity(level) { return level >= 6 ? 7 : 5; }
  function cadence(care) { return care >= 40 ? 2 : 3; }
  function ordinal(n) { return n <= 4 ? ORD[n - 1] : n + "th"; }

  function situation(s) {
    if (s.lastActive === s.day) return { gap: false, days: 0, covered: false };
    var missed = s.day - s.lastActive - 1;
    if (missed <= 0) return { gap: false, days: 0, covered: false };
    return { gap: true, days: missed, covered: s.freezes >= missed };
  }

  /* what the next completion pays, without changing state */
  function preview(s, q) {
    q = q || QUEST;
    var sit = situation(s);
    var comeback = sit.gap && !sit.covered;
    var streakDays = comeback ? 1 : s.streak;
    var sm = streakMult(streakDays);
    var idle = (s.lastDone === null || s.lastDone === s.day) ? 0 : clamp(s.day - s.lastDone, 0, 30);
    var neglect = neglectMult(idle, s.stats.Home);
    var decay = DECAY[Math.min(3, s.todayCount)];
    var mm = mindMult(s.stats.Mind);
    var cap = dailyCap(s.todayXp);
    var b = base(q.difficulty);
    var earned = b * sm * (comeback ? 1.5 : 1) * neglect * decay * mm * cap;
    var xp = Math.round(earned);
    var gain = q.difficulty * 1.5 * decay;
    if (s.todayStat >= 40) gain *= 0.5;
    var p = {
      xp: xp, glimmers: Math.max(1, Math.floor(xp / 3)), statGain: Math.max(1, Math.round(gain)), stat: q.stat,
      base: b, streakDays: streakDays, streakMult: sm, mindMult: mm, mind: s.stats.Mind, idleDays: idle, neglect: neglect,
      comeback: comeback, decay: decay, pass: s.todayCount + 1, cap: cap, situation: sit
    };
    p.chips = chips(p);
    return p;
  }

  /* the formula as chips, for the receipt: "15 base x 1.61 streak, 12 days x 1.09 Mind x 100% first today = 26 XP" */
  function chips(p) {
    var c = [{ value: String(p.base), label: "base" },
      { value: p.streakMult.toFixed(2), label: "streak, " + p.streakDays + (p.streakDays === 1 ? " day" : " days") }];
    if (p.comeback) c.push({ value: "1.50", label: "comeback", hot: true });
    c.push({ value: p.mindMult.toFixed(2), label: "Mind" });
    if (p.neglect !== 1) c.push({ value: p.neglect.toFixed(2), label: "idle, " + p.idleDays + (p.idleDays === 1 ? " day" : " days"), hot: true });
    c.push({ value: Math.round(p.decay * 100) + "%", label: ordinal(p.pass) + " today", hot: p.decay < 1 });
    if (p.cap < 1) c.push({ value: p.cap.toFixed(2), label: "daily cap", hot: true });
    return c;
  }
  function chipsText(p) {
    return p.chips.map(function (c) { return c.value + " " + c.label; }).join(" × ") + " = " + p.xp + " XP";
  }

  function commit(s, q) {
    q = q || QUEST;
    var p = preview(s, q), ev = { freezesUsed: 0, freezeEarned: false, comeback: false, leveledTo: null };
    var statBefore = s.stats[q.stat];
    if (s.lastActive !== s.day) {
      var sit = p.situation;
      if (!sit.gap) s.streak += 1;
      else if (sit.covered) { s.freezes -= sit.days; ev.freezesUsed = sit.days; s.streak += 1; }
      else { s.streak = 1; ev.comeback = true; }
      var cad = cadence(s.stats.Care), capy = capacity(s.level);
      if (s.freezes < capy && s.freezeProgress + 1 >= cad) {
        s.freezes = Math.min(capy, s.freezes + 1); s.freezeProgress = 0; ev.freezeEarned = true;
      } else s.freezeProgress = Math.min(cad - 1, s.freezeProgress + 1);
      s.lastActive = s.day;
    }
    s.xp += p.xp; s.todayXp += p.xp; s.todayCount += 1; s.todayStat += p.statGain;
    s.stats[q.stat] += p.statGain; s.glimmers += p.glimmers; s.lastDone = s.day;
    while (s.xp >= xpNeeded(s.level + 1)) { s.xp -= xpNeeded(s.level + 1); s.level += 1; ev.leveledTo = s.level; }
    s.ledger.unshift({ day: s.day, pass: p.pass, xp: p.xp, glimmers: p.glimmers, stat: p.statGain, pct: p.decay });
    if (s.ledger.length > 8) s.ledger.length = 8;
    p.statBefore = statBefore; p.statAfter = s.stats[q.stat]; p.events = ev; p.streakAfter = s.streak;
    return p;
  }

  function newDay(s, days) {
    s.day += days; s.todayCount = 0; s.todayXp = 0; s.todayStat = 0;
  }

  /* An engine instance with an undo stack of full snapshots. */
  function create(start) {
    var initial = clone(start || START);
    var state = clone(initial), stack = [], lastEvent = null;
    var api = {
      get state() { return state; },
      get canUndo() { return stack.length > 0; },
      get last() { return lastEvent; },
      quest: QUEST,
      preview: function () { return preview(state); },
      complete: function () { stack.push({ s: clone(state), e: lastEvent }); var r = commit(state); lastEvent = { type: "complete", receipt: r }; return r; },
      /* one calendar day passes with nothing done; if today already has a completion, that day is tomorrow */
      skipDay: function () {
        stack.push({ s: clone(state), e: lastEvent });
        newDay(state, state.lastActive === state.day ? 2 : 1);
        lastEvent = { type: "skip", situation: situation(state) };
        return lastEvent;
      },
      nextDay: function () { stack.push({ s: clone(state), e: lastEvent }); newDay(state, 1); lastEvent = { type: "next" }; return lastEvent; },
      undo: function () { if (!stack.length) return false; var top = stack.pop(); state = top.s; lastEvent = top.e; return true; },
      reset: function () { state = clone(initial); stack = []; lastEvent = null; }
    };
    return api;
  }

  var QuestEngine = {
    START: START, QUEST: QUEST, STATS: STATS, create: create, preview: preview, commit: commit, chipsText: chipsText,
    situation: situation, streakMult: streakMult, mindMult: mindMult, neglectMult: neglectMult, xpNeeded: xpNeeded,
    capacity: capacity, cadence: cadence, base: base
  };
  if (typeof module !== "undefined" && module.exports) module.exports = QuestEngine;
  if (root) { root.MB = root.MB || {}; root.MB.QuestEngine = QuestEngine; }
})(typeof window !== "undefined" ? window : null);
