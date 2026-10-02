/* Mika Be portfolio: Quest UI over MB.QuestEngine. Act, then reveal: the ring checks, the receipt
   lands, the hearth flares. Every slot is optional, so the homepage card and the case page's full
   engine module share this file. Slots and options: build/SYSTEM.md.
   After every action the [data-quest] element dispatches "mb:quest" with detail { type, phase, receipt }:
   type is complete | skip | next | undo | reset; a completion fires phase "act" at once and phase "reveal"
   when its receipt lands (280 ms later, at once under reduced motion). MB.Quest.note(receipt) is the
   receipt's note text and MB.Quest.SKIP_NOTE the note for a skipped day. */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB || !MB.QuestEngine) return;
  var NOTES = [
    "The first completion today pays in full.",
    "The second time today pays half, and repeats keep paying less.",
    "The third time today pays a quarter.",
    "From the fourth time on, it pays a tenth."
  ];
  var SKIP_NOTE = "A day passed with nothing done. Your stats stayed where they were.";

  /* the receipt's note: what a freeze or a comeback did, else how much this pass paid */
  function receiptNote(p) {
    var notes = [], ev = p.events || {};
    if (ev.freezesUsed === 1) notes.push("A streak freeze covered the missed day, so the streak continues.");
    else if (ev.freezesUsed > 1) notes.push(ev.freezesUsed + " streak freezes covered the missed days, so the streak continues.");
    else if (ev.comeback) notes.push("The gap was longer than the freezes could cover, so the streak starts again at 1 and this return pays a ×1.5 comeback bonus.");
    if (ev.freezeEarned) notes.push("Showing up again earned a freeze.");
    if (!notes.length) notes.push(NOTES[Math.min(3, p.pass - 1)]);
    if (ev.leveledTo) notes.push("Level " + ev.leveledTo + ".");
    return notes.join(" ");
  }

  function Quest(el) {
    var $ = function (s) { return MB.$(s, el); };
    var eng = MB.QuestEngine.create();
    var room = el.getAttribute("data-quest-room") ? MB.DepthRoom && MB.DepthRoom.get(el.getAttribute("data-quest-room")) : null;
    var ui = {
      badge: $("[data-q-badge]"), main: $('[data-q-act="complete"]'), undo: $('[data-q-act="undo"]'),
      skip: $('[data-q-act="skip"]'), next: $('[data-q-act="next"]'), reset: $('[data-q-act="reset"]'),
      receipt: $("[data-q-receipt]"), pay: $("[data-q-pay]"), xp: $("[data-q-xp]"), glim: $("[data-q-glim]"),
      statFrom: $("[data-q-stat-from]"), statTo: $("[data-q-stat-to]"), statGain: $("[data-q-stat-gain]"),
      chips: $("[data-q-chips]"), ladder: MB.$$("[data-q-ladder] li", el), note: $("[data-q-note]"), status: $("[data-q-status]"),
      level: $("[data-q-level]"), xpNow: $("[data-q-xp-now]"), xpNeed: $("[data-q-xp-need]"), xpBar: $("[data-q-xp-bar]"),
      stats: $("[data-q-stats]"), streak: $("[data-q-streak]"), freezes: $("[data-q-freezes]"), ledger: $("[data-q-ledger]")
    };
    var checkTimer = 0, beatTimer = 0;
    var stage = room && room.el;
    function emit(type, phase, receipt) {
      var ev;
      try { ev = new CustomEvent("mb:quest", { detail: { type: type, phase: phase || "", receipt: receipt || null } }); }
      catch (e) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent("mb:quest", false, false, { type: type, phase: phase || "", receipt: receipt || null }); }
      el.dispatchEvent(ev);
    }

    function setText(n, t) { if (n) n.textContent = t; }
    function chipsHTML(p) {
      var parts = p.chips.map(function (c) { return '<span class="fx' + (c.hot ? " hot" : "") + '">' + c.value + " " + c.label + "</span>"; });
      return parts.join('<span aria-hidden="true">×</span>') + '<span aria-hidden="true">=</span><span class="fx sum">' + p.xp + " XP</span>";
    }

    function renderState() {
      var s = eng.state, next = eng.preview(), last = eng.last;
      var done = last && last.type === "complete";
      el.classList.toggle("is-done", !!done && s.todayCount > 0);
      setText(ui.badge, (last ? "Next: +" : "+") + next.xp + " XP");
      if (ui.main) ui.main.textContent = s.todayCount > 0 ? "Complete it again" : "Mark complete";
      var acted = eng.canUndo;
      if (ui.undo) ui.undo.hidden = !acted;
      if (ui.reset) ui.reset.hidden = !acted;
      ui.ladder.forEach(function (li, i) {
        var paid = done ? Math.min(3, last.receipt.pass - 1) : -1;
        li.classList.toggle("on", i === paid);
      });
      /* optional panels (case page) */
      setText(ui.level, s.level);
      if (ui.xpNow) MB.countTo(ui.xpNow, s.xp);
      setText(ui.xpNeed, MB.QuestEngine.xpNeeded(s.level + 1));
      if (ui.xpBar) ui.xpBar.style.transform = "scaleX(" + (s.xp / MB.QuestEngine.xpNeeded(s.level + 1)).toFixed(4) + ")";
      if (ui.stats) MB.QuestEngine.STATS.forEach(function (k) { var n = MB.$('[data-stat="' + k + '"]', ui.stats); if (n) MB.countTo(n, s.stats[k]); });
      setText(ui.streak, s.streak);
      if (ui.freezes) {
        var cap = MB.QuestEngine.capacity(s.level), html = "";
        for (var i = 0; i < cap; i++) html += '<i class="' + (i < s.freezes ? "on" : "") + '"></i>';
        ui.freezes.innerHTML = html;
        ui.freezes.setAttribute("aria-label", s.freezes + " of " + cap + " streak freezes ready");
      }
      if (ui.ledger) ui.ledger.innerHTML = s.ledger.slice(0, 5).map(function (r) {
        return "<li><span>Day " + (r.day + 1) + " · " + Math.round(r.pct * 100) + "%</span><b class=\"num\">+" + r.xp + " XP</b></li>";
      }).join("");
    }

    /* The reveal lands in two beats: first the ring, the hearth and the XP counting up; about 400 ms later
       the stat line, the formula and the ladder fade in beneath it, quieter. */
    function showReceipt(p, animate) {
      if (!ui.receipt) return;
      ui.receipt.hidden = false;
      if (stage) stage.classList.add("has-receipt");
      if (ui.pay) ui.pay.hidden = false;
      clearTimeout(beatTimer);
      var staged = animate && !MB.reduced();
      ui.receipt.classList.toggle("beat-1", staged);
      if (ui.xp) {
        if (staged) { ui.xp.setAttribute("data-value", 0); MB.countTo(ui.xp, p.xp, 520, function (v) { return "+" + Math.round(v) + " XP"; }); }
        else { ui.xp.setAttribute("data-value", p.xp); ui.xp.textContent = "+" + p.xp + " XP"; }
      }
      setText(ui.glim, "+" + p.glimmers + " Glimmers");
      setText(ui.statFrom, p.statBefore);
      if (ui.statTo) { ui.statTo.setAttribute("data-value", staged ? p.statBefore : p.statAfter); ui.statTo.textContent = staged ? p.statBefore : p.statAfter; }
      if (staged) beatTimer = setTimeout(function () {
        ui.receipt.classList.remove("beat-1");
        if (ui.statTo) MB.countTo(ui.statTo, p.statAfter);
      }, 400);
      setText(ui.statGain, "(+" + p.statGain + ")");
      if (ui.chips) { ui.chips.innerHTML = chipsHTML(p); ui.chips.setAttribute("aria-label", MB.QuestEngine.chipsText(p)); }
      setText(ui.note, receiptNote(p));
      setText(ui.status, "Quest complete. " + p.xp + " XP and " + p.glimmers + " Glimmers. Mind " + p.statBefore + " to " + p.statAfter + ".");
    }

    function showSkip() {
      if (!ui.receipt) return;
      clearTimeout(beatTimer); ui.receipt.classList.remove("beat-1");
      ui.receipt.hidden = false;
      if (stage) stage.classList.add("has-receipt");
      if (ui.pay) ui.pay.hidden = true;
      setText(ui.note, SKIP_NOTE);
      setText(ui.status, SKIP_NOTE);
    }

    function hideReceipt() { clearTimeout(beatTimer); if (ui.receipt) { ui.receipt.hidden = true; ui.receipt.classList.remove("beat-1"); } if (stage) stage.classList.remove("has-receipt"); setText(ui.status, ""); }

    function restoreView() {
      var last = eng.last;
      if (!last) hideReceipt();
      else if (last.type === "complete") showReceipt(last.receipt, false);
      else if (last.type === "skip") showSkip();
      else hideReceipt();
      renderState();
    }

    function complete() {
      MB.sound.play("tap");
      var p = eng.complete();
      clearTimeout(checkTimer);
      el.classList.remove("is-done"); void el.offsetWidth; /* replay the ring check */
      renderState();
      emit("complete", "act", p);
      var reveal = function () {
        checkTimer = 0;
        showReceipt(p, true);
        MB.sound.play("complete");
        if (room) {
          room.flare();
          if (!MB.reduced() && room.hearthVisible() < 0.5) {
            el.classList.remove("sweep"); void el.offsetWidth; el.classList.add("sweep");
          }
        }
        emit("complete", "reveal", p);
      };
      if (MB.reduced()) reveal(); else checkTimer = setTimeout(reveal, 280);
    }

    /* a pending reveal belongs to the completion it follows; any later action cancels it */
    function settle() { clearTimeout(checkTimer); checkTimer = 0; }
    if (ui.main) ui.main.addEventListener("click", complete);
    if (ui.skip) ui.skip.addEventListener("click", function () { settle(); MB.sound.play("tap"); eng.skipDay(); showSkip(); renderState(); emit("skip"); });
    if (ui.next) ui.next.addEventListener("click", function () { settle(); eng.nextDay(); hideReceipt(); renderState(); emit("next"); });
    if (ui.undo) ui.undo.addEventListener("click", function () { settle(); eng.undo(); restoreView(); if (!eng.canUndo && ui.main) ui.main.focus(); emit("undo"); });
    if (ui.reset) ui.reset.addEventListener("click", function () { settle(); eng.reset(); restoreView(); if (ui.main) ui.main.focus(); emit("reset"); });
    el.addEventListener("animationend", function (e) { if (e.animationName === "mb-sweep") el.classList.remove("sweep"); });
    renderState();
    this.engine = eng;
    el._quest = this;
  }

  MB.Quest = { init: function (el) { return new Quest(el); }, note: receiptNote, NOTES: NOTES, SKIP_NOTE: SKIP_NOTE };
  MB.$$("[data-quest]").forEach(MB.Quest.init);
})();
