/* Kuiper TTS case page. Runs after listen.js (players are already built; el._player is the Player).
   1. The listening panel: a reading marker follows the voice through the equation (the words each reading
      is saying map to the part of the equation they speak, MB.KUIPER.terms); pointing at a part of the
      equation, or at a change row, lights the words both readings use for it; each change row plays the
      literal phrase and then the rewritten one, cut from the same clips (MB.KUIPER.changes).
   2. Two small toggles: the pitch sketch (resampling vs time-stretching) and the caching study's verdicts.
   Data: assets/js/data-kuiper-tts.js. Only transform and opacity animate. */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB) return;
  var K = MB.KUIPER || { terms: {}, changes: {} };
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------------------------------------------------------------- unlock a second clip inside the click
     Safari lets a media element start without a fresh gesture only once a gesture has started it. The
     phrase comparison plays a second clip about a second after the click, so that clip is started and
     paused inside the click. These two events are hidden from the page's audio manager and the player. */
  var hush = function (e) { var a = e.target; if (a && a._ktHush && a.tagName === "AUDIO") { e.stopImmediatePropagation(); if (e.type === "pause") a._ktHush = false; } };
  window.addEventListener("play", hush, true);
  window.addEventListener("pause", hush, true);
  function unlock(a) {
    if (!a || a._ktUnlocked || !a.paused) return;
    a._ktUnlocked = true; a._ktHush = true;
    MB.audio.prime(a);
    try { var p = a.play(); a.pause(); if (p && p.catch) p.catch(function () {}); } catch (e) { a._ktHush = false; }
  }

  /* ---------------------------------------------------------------- the listening panel */
  var panel = MB.$("[data-kt-listen]");
  if (panel && MB.Player) listen(panel);

  function listen(panel) {
    var players = {};
    MB.$$("[data-player]", panel).forEach(function (el) { if (el._player) players[el.getAttribute("data-kind")] = el._player; });
    if (!players.lit || !players["new"]) return;
    var box = MB.$("[data-kt-eq]", panel), marker = MB.$(".kt-marker", panel), list = MB.$("[data-kt-changes]", panel);
    var tabs = MB.$$('[role="tab"]', panel);
    var eq = selected(), seq = null, reading = false, lastTerm = null, hoverTerm = null, hoverRow = null;

    function selected() { var t = MB.$('[role="tab"][aria-selected="true"]', panel); return t ? t.getAttribute("data-eq") : "eq0003"; }
    function math() { return MB.$('math[data-eq-math="' + eq + '"]', box); }
    function termEl(i) { var m = math(); return m ? MB.$('[data-t="' + i + '"]', m) : null; }
    function termEls() { var m = math(); return m ? MB.$$("[data-t]", m) : []; }
    function ranges(kind) { return (K.terms[eq] && K.terms[eq][kind]) || []; }
    function wordAt(clip, t) {
      var j = -1;
      for (var i = 0; i < clip.times.length; i++) { if (t >= clip.times[i] - 0.04) j = i; else break; }
      return j;
    }
    function termOf(kind, j) {
      var r = ranges(kind);
      for (var i = 0; i < r.length; i++) if (j >= r[i][1] && j <= r[i][2]) return r[i];
      return null;
    }

    /* the marker: a highlighter stroke placed behind one part of the equation */
    function place(i) {
      var el = i == null ? null : termEl(i);
      if (!el) { marker.classList.remove("on"); lastTerm = null; return; }
      if (i === lastTerm && marker.classList.contains("on")) return;
      var b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
      var padX = 7, padY = 5;
      var x = r.left - b.left + box.scrollLeft - padX, y = r.top - b.top - padY;
      var w = r.width + padX * 2, h = r.height + padY * 2;
      var wasOn = marker.classList.contains("on");
      if (!wasOn) marker.classList.add("jump");
      marker.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + (w / 100).toFixed(3) + "," + (h / 100).toFixed(3) + ")";
      if (!wasOn) { void marker.offsetWidth; marker.classList.remove("jump"); }
      marker.classList.add("on");
      lastTerm = i;
    }
    MB.onLayout(function () { var t = lastTerm; lastTerm = null; if (t != null) place(t); });

    /* the words both readings use for a part of the equation, or for a change row */
    function lightWords(litRange, newRange) {
      ["lit", "new"].forEach(function (kind) {
        var rg = kind === "lit" ? litRange : newRange;
        players[kind].words.forEach(function (w, i) { w.classList.toggle("kt-hl", !!rg && i >= rg[0] && i <= rg[1]); });
      });
    }
    function clearHover() {
      termEls().forEach(function (el) { el.classList.remove("hl"); });
      lightWords(null, null);
      MB.$$(".kt-change.is-hl", list).forEach(function (li) { li.classList.remove("is-hl"); });
      if (!reading) place(null);
    }
    function showTerm(i) {
      if (reading) return;
      var lr = null, nr = null;
      ranges("lit").forEach(function (r) { if (r[0] === i) lr = [r[1], r[2]]; });
      ranges("new").forEach(function (r) { if (r[0] === i) nr = [r[1], r[2]]; });
      termEls().forEach(function (el) { el.classList.toggle("hl", +el.getAttribute("data-t") === i); });
      lightWords(lr, nr);
      place(i);
    }
    function showRow(li) {
      var ch = li._ch; if (!ch) return;
      li.classList.add("is-hl");
      if (reading) return;
      termEls().forEach(function (el) { el.classList.toggle("hl", +el.getAttribute("data-t") === ch.term); });
      lightWords(ch.lit, ch["new"]);
      place(ch.term);
    }

    /* pointing at the equation */
    MB.$$("math [data-t]", box).forEach(function (el) {
      el.addEventListener("pointerenter", function (e) { if (e.pointerType === "touch") return; hoverTerm = +el.getAttribute("data-t"); showTerm(hoverTerm); });
      el.addEventListener("pointerleave", function () { hoverTerm = null; clearHover(); });
      el.addEventListener("click", function () { hoverTerm = +el.getAttribute("data-t"); clearHover(); showTerm(hoverTerm); });
    });

    /* the reading follows the voice: whichever player in the panel is playing drives the marker */
    function tick() {
      var p = !players.lit.audio.paused ? players.lit : (!players["new"].audio.paused ? players["new"] : null);
      if (!p) {
        if (reading) {
          reading = false;
          panel.classList.remove("is-reading");
          termEls().forEach(function (el) { el.classList.remove("said", "now"); });
          place(null);
          if (hoverRow) showRow(hoverRow);
        }
        return false;
      }
      if (!reading) { reading = true; panel.classList.add("is-reading"); termEls().forEach(function (el) { el.classList.remove("hl"); }); lightWords(null, null); }
      var kind = p === players.lit ? "lit" : "new";
      var j = wordAt(p.clip, p.audio.currentTime);
      var cur = termOf(kind, j), ri = ranges(kind);
      termEls().forEach(function (el) {
        var i = +el.getAttribute("data-t"), r = null;
        for (var k = 0; k < ri.length; k++) if (ri[k][0] === i) { r = ri[k]; break; }
        el.classList.toggle("said", !!r && j >= r[1]);
        el.classList.toggle("now", !!cur && cur[0] === i);
      });
      place(cur ? cur[0] : (j < 0 ? null : lastTerm));
      return true;
    }
    MB.loop.add(tick);
    ["lit", "new"].forEach(function (k) {
      var a = players[k].audio;
      a.addEventListener("play", function () { MB.loop.wake(); });
      a.addEventListener("pause", function () { MB.loop.wake(); });
      a.addEventListener("seeked", function () { MB.loop.wake(); });
    });

    /* change rows, rebuilt for each equation */
    /* a phrase as text: changed words underlined in one run, pause commas tinted like the transcripts */
    function phrase(text, startIndex, under, pauses) {
      var frag = document.createDocumentFragment(), run = null, runRange = null;
      var inU = function (idx) { var hit = null; (under || []).forEach(function (r) { if (idx >= r[0] && idx <= r[1]) hit = r; }); return hit; };
      var words = text.split(" ");
      words.forEach(function (w, i) {
        var idx = startIndex + i, r = inU(idx);
        if (r && r !== runRange) { run = document.createElement("span"); run.className = "kt-u"; frag.appendChild(run); runRange = r; }
        if (!r) { run = null; runRange = null; }
        var host = run || frag;
        if (pauses && /,$/.test(w)) {
          host.appendChild(document.createTextNode(w.slice(0, -1)));
          var c = document.createElement("span"); c.className = "kt-pause"; c.textContent = ","; host.appendChild(c);
        } else host.appendChild(document.createTextNode(w));
        if (i < words.length - 1) { var nr = inU(idx + 1); (nr && nr === r ? host : frag).appendChild(document.createTextNode(" ")); }
      });
      return frag;
    }
    function icon() {
      var svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "0 0 20 20"); svg.setAttribute("aria-hidden", "true");
      var a = document.createElementNS(SVGNS, "path"); a.setAttribute("class", "i-play"); a.setAttribute("d", "M5 3l12 7-12 7z");
      var b = document.createElementNS(SVGNS, "path"); b.setAttribute("class", "i-stop"); b.setAttribute("d", "M4 4h12v12H4z");
      svg.appendChild(a); svg.appendChild(b);
      return svg;
    }
    function render() {
      var rows = K.changes[eq] || [];
      list.textContent = "";
      rows.forEach(function (ch, n) {
        var li = document.createElement("li"); li.className = "kt-change"; li._ch = ch;
        var rule = document.createElement("p"); rule.className = "kt-rule"; rule.textContent = ch.rule;
        var pair = document.createElement("p"); pair.className = "kt-pair";
        var from = document.createElement("span"); from.className = "kt-from"; from.appendChild(phrase(ch.litText, ch.lit[0], null, false));
        var arrow = document.createElement("span"); arrow.className = "kt-arrow"; arrow.setAttribute("aria-hidden", "true"); arrow.textContent = "→";
        var to = document.createElement("span"); to.className = "kt-to"; to.appendChild(phrase(ch.newText, ch["new"][0], ch.under, true));
        var sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = " becomes ";
        pair.appendChild(from); pair.appendChild(arrow); pair.appendChild(sr); pair.appendChild(to);
        var btn = document.createElement("button"); btn.type = "button"; btn.className = "kt-hear";
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", "Hear both: “" + ch.litText + "”, then “" + ch.newText.replace(/,$/, "") + "”");
        var dot = document.createElement("span"); dot.className = "kt-dot"; dot.appendChild(icon());
        btn.appendChild(dot); btn.appendChild(document.createTextNode("Hear both"));
        btn.addEventListener("click", function () { hearBoth(li, btn, ch); });
        li.appendChild(rule); li.appendChild(pair); li.appendChild(btn);
        li.addEventListener("pointerenter", function (e) { if (e.pointerType === "touch") return; hoverRow = li; showRow(li); });
        li.addEventListener("pointerleave", function () { hoverRow = null; clearHover(); });
        btn.addEventListener("focus", function () { if (btn.matches(":focus-visible")) { hoverRow = li; showRow(li); } });
        btn.addEventListener("blur", function () { if (hoverRow === li) { hoverRow = null; clearHover(); } });
        list.appendChild(li);
      });
    }

    /* the phrase comparison: the literal phrase, a short breath, then the rewritten phrase */
    function ready(a) {
      return new Promise(function (res) {
        if (a.readyState >= 1) return res();
        MB.audio.prime(a);
        a.addEventListener("loadedmetadata", function () { res(); }, { once: true });
        if (a.networkState === 0 || a.networkState === 3) a.load();
      });
    }
    function seekTo(a, t) {
      return new Promise(function (res) {
        if (Math.abs(a.currentTime - t) < 0.02) return res();
        var done = false, fin = function () { if (!done) { done = true; a.removeEventListener("seeked", fin); res(); } };
        a.addEventListener("seeked", fin);
        a.currentTime = t;
        setTimeout(fin, 1500);
      });
    }
    function segment(p, cut, token) {
      var a = p.audio;
      return ready(a).then(function () { return seekTo(a, cut[0]); }).then(function () {
        if (seq !== token) throw new Error("stopped");
        return new Promise(function (res, rej) {
          var raf = 0, timer = 0, ours = false, base = null;
          /* the stop point is the media clock. A timer aimed at the cut does the precise stop (an animation frame
             can be 100 ms or more apart in a busy or background tab); when it fires it checks currentTime, and if
             the audio fell behind the wall clock (a stall, a late start: WebKit fires "playing" before output
             starts) it re-aims at what is left instead of clipping the phrase. base only times the fade-in. */
          var started = function () { if (!base && a.currentTime > cut[0] + 0.02) { base = { t: performance.now(), c: a.currentTime }; arm(); } };
          var onPlaying = function () { started(); arm(); };
          var onTime = function () { started(); };
          var onWaiting = function () { base = null; clearTimeout(timer); };
          var cleanup = function () { cancelAnimationFrame(raf); clearTimeout(timer); a.removeEventListener("pause", onPause); a.removeEventListener("playing", onPlaying); a.removeEventListener("waiting", onWaiting); a.removeEventListener("timeupdate", onTime); a._ktFading = false; setTimeout(function () { if (!a._ktFading) a.volume = 1; }, 30); };
          var onPause = function () { if (!ours) { cleanup(); rej(new Error("interrupted")); } };
          var est = function () { return a.currentTime; }, rearms = 0;
          var stop = function (ok) { ours = true; cleanup(); a.pause(); if (ok) res(); else rej(new Error("stopped")); };
          /* a short fade at each cut, so a cut inside continuous speech does not click (volume is fixed on iOS) */
          var watch = function () {
            if (seq !== token) return stop(false);
            started();
            var e = est();
            if (e >= cut[1] - 0.015 || a.ended) return stop(true);
            var fin = base ? Math.min(1, (performance.now() - base.t) / 35) : 0;
            var fout = Math.min(1, Math.max(0, (cut[1] - 0.015 - e) / 0.045));
            try { a.volume = Math.min(fin, fout); } catch (err) { /* read-only volume */ }
            raf = requestAnimationFrame(watch);
          };
          var arm = function () {
            clearTimeout(timer);
            var left = (cut[1] - 0.015 - est()) * 1000 / (a.playbackRate || 1);
            timer = setTimeout(function () {
              if (seq !== token) return stop(false);
              if (!a.ended && !a.paused && cut[1] - 0.015 - est() > 0.02 && rearms++ < 12) return arm();
              stop(true);
            }, Math.max(0, left));
          };
          a._ktFading = true;
          try { a.volume = 0; } catch (err) { /* read-only volume */ }
          a.addEventListener("pause", onPause);
          a.addEventListener("playing", onPlaying);
          a.addEventListener("waiting", onWaiting);
          a.addEventListener("timeupdate", onTime);
          var pr = a.play(); if (pr && pr.catch) pr.catch(function () { cleanup(); rej(new Error("blocked")); });
          raf = requestAnimationFrame(watch);
        });
      });
    }
    function rest(p) {
      var a = p.audio;
      if (!a.paused) return;
      if (a.readyState >= 1) { try { a.currentTime = 0; } catch (e) { /* not seekable yet */ } }
      p.el.classList.remove("has-progress");
      p.paint(0);
    }
    function endSeq(token) {
      if (seq !== token) return;
      var li = token.li;
      seq = null;
      li.classList.remove("is-lit", "is-new");
      token.btn.setAttribute("aria-pressed", "false");
      setTimeout(function () { if (!seq) { rest(players.lit); rest(players["new"]); } }, 160);
    }
    function hearBoth(li, btn, ch) {
      if (seq && seq.li === li) { var s = seq; seq = null; MB.audio.stopAll(); s.li.classList.remove("is-lit", "is-new"); s.btn.setAttribute("aria-pressed", "false"); rest(players.lit); rest(players["new"]); return; }
      if (seq) { var o = seq; seq = null; o.li.classList.remove("is-lit", "is-new"); o.btn.setAttribute("aria-pressed", "false"); }
      MB.audio.stopAll();
      unlock(players["new"].audio);
      var token = { li: li, btn: btn };
      seq = token;
      btn.setAttribute("aria-pressed", "true");
      li.classList.add("is-lit");
      segment(players.lit, ch.litCut, token)
        .then(function () { li.classList.remove("is-lit"); return new Promise(function (r) { setTimeout(r, MB.reduced() ? 250 : 420); }); })
        .then(function () { if (seq !== token) throw new Error("stopped"); li.classList.add("is-new"); return segment(players["new"], ch.newCut, token); })
        .then(function () { endSeq(token); }, function () { endSeq(token); });
    }

    /* a new equation: stop, clear, rebuild the rows */
    function switchTo(now) {
      if (now === eq) return;
      if (seq) { var s = seq; seq = null; s.li.classList.remove("is-lit", "is-new"); s.btn.setAttribute("aria-pressed", "false"); }
      eq = now; hoverTerm = null; hoverRow = null;
      /* listen.js has already shown this equation's MathML and hidden the others */
      MB.$$("math [data-t]", box).forEach(function (el) { el.classList.remove("said", "now", "hl"); });
      reading = false; panel.classList.remove("is-reading");
      place(null);
      render();
    }
    var obs = new MutationObserver(function () { switchTo(selected()); });
    tabs.forEach(function (t) { obs.observe(t, { attributes: true, attributeFilter: ["aria-selected"] }); });
    render();

    /* the arrival's example line plays the first change of the first equation through the same players */
    var hero = MB.$("[data-kt-hero]"), heroBtn = hero && MB.$("[data-kt-hero-play]", hero);
    if (heroBtn && K.changes.eq0003) {
      heroBtn.addEventListener("click", function () {
        if (eq !== "eq0003") { var t = MB.$('[role="tab"][data-eq="eq0003"]', panel); if (t) t.click(); switchTo("eq0003"); }
        hearBoth(hero, heroBtn, K.changes.eq0003[0]);
      });
    }
  }

  /* ---------------------------------------------------------------- window light: drifts a little as the page scrolls */
  var pane = MB.$(".kt-window i");
  if (pane && !MB.reduced()) {
    var lastY = null;
    MB.loop.add(function () {
      var y = Math.min(MB.scrollY, 1200);
      if (y === lastY) return false;
      lastY = y;
      pane.style.setProperty("--kt-win-y", (y * 0.16).toFixed(1) + "px");
      return false;
    });
  }

  /* ---------------------------------------------------------------- two-state cards: pitch sketch, caching verdicts */
  function toggleCard(card, onSet) {
    var seg = MB.$(".kt-seg", card); if (!seg) return;
    var btns = MB.$$("[data-kt-mode]", seg), move = MB.inkFor(seg);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-kt-mode");
        if (card.getAttribute("data-mode") === m) return;
        btns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        card.setAttribute("data-mode", m);
        move();
        if (onSet) onSet(m);
      });
    });
  }
  MB.$$("[data-kt-pitch]").forEach(function (card) { toggleCard(card); });
  MB.$$("[data-kt-cache]").forEach(function (card) {
    var count = MB.$("[data-kt-count]", card);
    var items = MB.$$(".kt-contexts li", card);
    var states = items.map(function (li) { var s = document.createElement("span"); s.className = "sr-only"; li.appendChild(s); return s; });
    var label = function (m) { states.forEach(function (s) { s.textContent = m === "ear" ? " (cacheable)" : " (not cacheable)"; }); };
    label(card.getAttribute("data-mode"));
    toggleCard(card, function (m) { label(m); if (count) MB.countTo(count, m === "ear" ? 9 : 0, 560); });
  });
})();
