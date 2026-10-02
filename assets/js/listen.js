/* Mika Be portfolio: audio players with waveforms and timed words, plus the equation tabs.
   A player is [data-player] with data-clip="<key in MB.DATA.clips>". A listening panel is
   [data-listen] holding a tablist (tabs carry data-eq) and players with data-kind="lit|new";
   choosing a tab loads "<eq>-<kind>" into each player. Details: build/SYSTEM.md. */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB || !MB.DATA) return;
  var CLIPS = MB.DATA.clips, NS = "http://www.w3.org/2000/svg";

  function Player(el) {
    this.el = el;
    this.audio = MB.$("audio", el);
    this.btn = MB.$(".play", el);
    this.wave = MB.$("[data-wave]", el);
    this.tp = MB.$("[data-transcript]", el);
    this.durEl = MB.$("[data-dur]", el);
    this.dateEl = MB.$("[data-date]", el);
    this.label = el.getAttribute("data-label") || "the clip";
    this.bars = []; this.words = []; this.clip = null; this.raf = 0;
    el.setAttribute("data-audio-intent", "");
    var self = this, a = this.audio;
    this.btn.addEventListener("click", function () { self.toggle(); });
    a.addEventListener("play", function () { self.setPlaying(true); });
    a.addEventListener("pause", function () { self.setPlaying(false); self.paint(a.currentTime); });
    a.addEventListener("ended", function () { self.setPlaying(false); self.ended = true; self.paint(0); self.el.classList.remove("has-progress"); });
    a.addEventListener("timeupdate", function () { if (a.paused) self.paint(a.currentTime); });
    /* seek: the waveform is a slider */
    var seekTo = function (t) {
      var dur = self.duration();
      t = MB.clamp(t, 0, dur);
      var go = function () { a.currentTime = t; self.ended = false; self.paint(t); };
      if (a.readyState < 1) { MB.audio.prime(a); a.addEventListener("loadedmetadata", go, { once: true }); a.load(); self.paint(t); }
      else go();
    };
    /* Mouse and pen seek on press. A finger that lands on the waveform may be scrolling the page
       (touch-action: pan-y), so touch seeks only on a tap or once the drag is clearly sideways. */
    var at = function (x) { var r = self.wave.getBoundingClientRect(); return ((x - r.left) / r.width) * self.duration(); };
    var drag = null;
    this.wave.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, side: false }; return; }
      seekTo(at(e.clientX));
    });
    this.wave.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.side && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) drag.side = true;
      if (drag.side) seekTo(at(e.clientX));
    });
    this.wave.addEventListener("pointerup", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.side && Math.abs(e.clientX - drag.x) < 8 && Math.abs(e.clientY - drag.y) < 8) seekTo(at(e.clientX));
      drag = null;
    });
    this.wave.addEventListener("pointercancel", function () { drag = null; });
    this.wave.addEventListener("keydown", function (e) {
      var t = a.currentTime || 0, d = self.duration(), n = null;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") n = t + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = t - 1;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = d;
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); self.toggle(); return; }
      if (n != null) { e.preventDefault(); seekTo(n); }
    });
    if (el.getAttribute("data-clip")) this.load(el.getAttribute("data-clip"));
  }

  Player.prototype.duration = function () { return (this.clip && this.clip.dur) || this.audio.duration || 1; };

  Player.prototype.toggle = function () {
    var a = this.audio;
    if (a.paused) { MB.audio.prime(a); MB.audio.stopAll(a); var p = a.play(); if (p && p.catch) p.catch(function () {}); }
    else a.pause();
  };

  Player.prototype.setPlaying = function (on) {
    var self = this;
    this.el.classList.toggle("is-playing", on);
    this.btn.setAttribute("aria-label", (on ? "Pause " : "Play ") + this.label);
    if (on) {
      this.ended = false;
      this.el.classList.add("has-progress");
      cancelAnimationFrame(this.raf);
      var tick = function () { self.paint(self.audio.currentTime); if (!self.audio.paused) self.raf = requestAnimationFrame(tick); };
      this.raf = requestAnimationFrame(tick);
    } else cancelAnimationFrame(this.raf);
  };

  Player.prototype.load = function (key) {
    var c = CLIPS[key];
    if (!c) return;
    var a = this.audio;
    if (!a.paused) a.pause();
    this.clip = c; this.key = key; this.ended = false;
    this.el.setAttribute("data-clip", key);
    this.el.classList.remove("has-progress", "is-playing");
    var src = MB.base + c.src;
    if (a.getAttribute("src") !== src) { a.preload = "none"; a.setAttribute("src", src); }
    if (this.durEl) this.durEl.textContent = MB.fmtTime(c.dur);
    if (this.dateEl && c.date) this.dateEl.textContent = c.date;
    this.buildWave(c); this.buildWords(c);
    this.wave.setAttribute("aria-valuemax", c.dur.toFixed(1));
    this.paint(0);
  };

  Player.prototype.buildWave = function (c) {
    var svg = this.wave;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    this.bars = c.peaks.map(function (v, i) {
      var h = Math.max(1.4, v * 30), r = document.createElementNS(NS, "rect");
      r.setAttribute("x", (i + 0.18).toFixed(2)); r.setAttribute("width", "0.64");
      r.setAttribute("y", ((32 - h) / 2).toFixed(2)); r.setAttribute("height", h.toFixed(2)); r.setAttribute("rx", "0.32");
      svg.appendChild(r);
      return r;
    });
  };

  /* words: changed phrases (marks) get an underline; pause commas in a rewrite are marked too */
  Player.prototype.buildWords = function (c) {
    var p = this.tp, words = c.text.split(" "), marks = c.marks || [], rewrite = !!c.marks;
    p.textContent = "";
    var inMark = function (i) { for (var k = 0; k < marks.length; k++) if (i >= marks[k][0] && i <= marks[k][1]) return marks[k]; return null; };
    var out = [], wrap = null, wrapRange = null;
    words.forEach(function (w, i) {
      var m = inMark(i);
      if (m && m !== wrapRange) { wrap = document.createElement("span"); wrap.className = "chg"; p.appendChild(wrap); wrapRange = m; }
      if (!m) { wrap = null; wrapRange = null; }
      var host = wrap || p;
      var s = document.createElement("span");
      s.className = "w";
      var comma = rewrite && /,$/.test(w);
      if (comma) { s.appendChild(document.createTextNode(w.slice(0, -1))); var pc = document.createElement("span"); pc.className = "pause"; pc.textContent = ","; s.appendChild(pc); }
      else s.textContent = w;
      host.appendChild(s);
      out.push(s);
      if (i < words.length - 1) {
        var next = inMark(i + 1);
        (next && next === m ? host : p).appendChild(document.createTextNode(" "));
      }
    });
    this.words = out;
  };

  Player.prototype.paint = function (t) {
    var c = this.clip; if (!c) return;
    var dur = c.dur, n = Math.round((t / dur) * this.bars.length);
    for (var i = 0; i < this.bars.length; i++) this.bars[i].classList.toggle("on", i < n);
    var cur = -1;
    for (var j = 0; j < this.words.length; j++) {
      var st = c.times[j] != null ? c.times[j] : (j / this.words.length) * dur;
      var said = t >= st - 0.04;
      this.words[j].classList.toggle("said", said);
      if (said) cur = j;
    }
    var playing = !this.audio.paused;
    for (var k = 0; k < this.words.length; k++) this.words[k].classList.toggle("now", playing && k === cur && t > 0);
    this.wave.setAttribute("aria-valuenow", t.toFixed(1));
    this.wave.setAttribute("aria-valuetext", MB.fmtTime(t) + " of " + MB.fmtTime(dur));
  };

  MB.Player = { init: function (el) { var p = new Player(el); el._player = p; return p; } };

  /* listening panels: equation tabs swap both readings and stop playback */
  MB.$$("[data-listen]").forEach(function (panel) {
    var players = MB.$$("[data-player]", panel).map(MB.Player.init);
    var list = MB.$('[role="tablist"]', panel);
    if (!list) return;
    var maths = MB.$$("[data-eq-math]", panel);
    var tabpanel = MB.$('[role="tabpanel"]', panel);
    var move = MB.inkFor(list);
    var show = function (tab) {
      var eq = tab.getAttribute("data-eq");
      MB.audio.stopAll();
      /* MathML elements have no hidden property in Chromium or WebKit, so toggle the attribute itself */
      maths.forEach(function (m) { if (m.hasAttribute("hidden") !== (m.getAttribute("data-eq-math") !== eq)) m.toggleAttribute("hidden"); });
      players.forEach(function (p) { p.load(eq + "-" + p.el.getAttribute("data-kind")); });
      if (tabpanel) tabpanel.setAttribute("aria-labelledby", tab.id);
      move();
    };
    var tl = MB.tablist(list, show);
    var first = MB.$('[aria-selected="true"]', list) || tl.tabs[0];
    tl.select(first, false);
  });
  MB.$$("[data-player]").forEach(function (el) { if (!el._player) MB.Player.init(el); });
})();
