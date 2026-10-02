/* Mika Be portfolio: Room Notes components.
   [data-devices]   one page on three devices; tabs pick one, which scales forward
   [data-pen-pad]   a browser replay of the measured pen freeze (BENCHMARKS.md survivors only)
   [data-erase-grid] 2,000 dots, one per stroke, lit when a single erase re-records them
   Markup and options: build/SYSTEM.md. */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB) return;

  /* ================================================================ device stage */
  MB.$$("[data-devices]").forEach(function (root) {
    var stage = MB.$("[data-device-stage]", root);
    var list = MB.$('[role="tablist"]', root);
    var frames = MB.$$("[data-device]", stage);
    var caps = MB.$$("[data-device-cap]", root);
    var move = MB.inkFor(list);
    var active = "all";
    /* the lineup is sized in CSS (container units); this only covers browsers without them */
    var cq = window.CSS && CSS.supports && CSS.supports("width", "1cqw");
    function size() {
      if (cq) return;
      var w = stage.clientWidth, gap = 16, narrow = innerWidth < 700;
      var dh = Math.min((w - 2 * gap - 8) / 2.8114, 380);
      stage.style.setProperty("--dh", dh.toFixed(1) + "px");
      stage.style.setProperty("--stage-h", (narrow ? 360 : Math.min(443, Math.round(w / 2.466))) + "px");
    }
    function place() {
      size();
      if (active === "all") { frames.forEach(function (f) { f.classList.remove("is-active"); f.style.removeProperty("--tx"); f.style.removeProperty("--s"); }); return; }
      var sw = stage.clientWidth, sh = stage.clientHeight;
      frames.forEach(function (f) {
        var on = f.getAttribute("data-device") === active;
        f.classList.toggle("is-active", on);
        var cx = f.offsetLeft + f.offsetWidth / 2;
        var tx = sw / 2 - cx;
        f.style.setProperty("--tx", (on ? tx : tx * 0.18).toFixed(1) + "px");
        if (on) {
          var s = Math.min((sh - 12) / f.offsetHeight, (sw * 0.94) / f.offsetWidth);
          f.style.setProperty("--s", Math.max(1, s).toFixed(3));
        }
      });
    }
    /* a device with a second face (the phone's board-photo sheet) shows it, and zooms to it, only when chosen alone */
    function soloFace(f) {
      var solo = MB.$(".ph-solo", f), main = MB.$(".ph-page", f);
      if (!solo || !main) return;
      if (!f._zoomAll) { f._zoomAll = [f.getAttribute("data-zoom"), f.getAttribute("data-caption")]; f._altMain = main.alt; }
      var alone = active === f.getAttribute("data-device");
      f.setAttribute("data-zoom", alone ? f.getAttribute("data-zoom-solo") : f._zoomAll[0]);
      f.setAttribute("data-caption", alone ? f.getAttribute("data-caption-solo") : f._zoomAll[1]);
      solo.alt = alone ? solo.getAttribute("data-alt") : ""; solo.setAttribute("aria-hidden", String(!alone));
      main.alt = alone ? "" : f._altMain; if (alone) main.setAttribute("aria-hidden", "true"); else main.removeAttribute("aria-hidden");
    }
    function pick(tab) {
      active = tab.getAttribute("data-device-tab");
      stage.setAttribute("data-active", active);
      if (tab.id) stage.setAttribute("aria-labelledby", tab.id);
      frames.forEach(function (f) { f.tabIndex = active === "all" || f.getAttribute("data-device") === active ? 0 : -1; });
      caps.forEach(function (c) { c.hidden = c.getAttribute("data-device-cap") !== active; });
      frames.forEach(soloFace);
      place(); move();
    }
    var tl = MB.tablist(list, pick);
    var narrow = innerWidth < 700 && root.getAttribute("data-default-narrow");
    var want = narrow ? root.getAttribute("data-default-narrow") : (root.getAttribute("data-default") || "all");
    var first = MB.$('[data-device-tab="' + want + '"]', list) || tl.tabs[0];
    tl.select(first, false);
    MB.onLayout(place);
  });

  /* ================================================================ pen pad
     Build 30: after a pause of about two seconds (1.8 to 2.6 s between pen up and pen down), the new
     stroke's ink is held for 1,479 ms from pen down (the measured median), then flushed over 120 ms. The UI
     thread is busy for that whole time, so any stroke started inside the hold waits for the same flush.
     Other pauses draw normally and show the hint. Now: ink is never held. */
  var HOLD_MS = 1479, FLUSH_MS = 120, WIN = [1.8, 2.6];

  /* shared with the case page's bench (case-room-notes.js) */
  MB.pen = {
    HOLD_MS: HOLD_MS, FLUSH_MS: FLUSH_MS, WIN: WIN,
    /* the resting reference (hand-ref.js): two cursive words in a 2:1 box, fitted to a W x H pad and
       returned in the pad's 0..1 coordinates with times in ms */
    hand: function (W, H) {
      var src = MB.HAND && MB.HAND.strokes;
      if (!src || !W || !H) return [];
      /* the band between the instruction line at the top and the tag at the bottom */
      var top = Math.max(H * 0.14, 38), band = H - top - Math.max(H * 0.12, 30);
      var bw = Math.min(W * 0.92, band * 2), ox = (W - bw) / 2, oy = top + (band - bw / 2) / 2;
      return src.map(function (flat) {
        var pts = [];
        for (var i = 0; i < flat.length; i += 4) pts.push({ x: (ox + flat[i] / 1000 * bw) / W, y: (oy + flat[i + 1] / 1000 * bw) / H, p: flat[i + 2] / 100, t: flat[i + 3] });
        return pts;
      });
    },
    /* one smoothed segment: a quadratic through the midpoints, so samples never show as corners */
    seg: function (ctx, W, H, a, b, c) {
      var m1x = (a.x + b.x) / 2 * W, m1y = (a.y + b.y) / 2 * H, m2x = (b.x + c.x) / 2 * W, m2y = (b.y + c.y) / 2 * H;
      ctx.beginPath(); ctx.moveTo(m1x, m1y); ctx.quadraticCurveTo(b.x * W, b.y * H, m2x, m2y); ctx.stroke();
    },
    path: function (ctx, W, H, pts) {
      if (!pts.length) return;
      ctx.beginPath(); ctx.moveTo(pts[0].x * W, pts[0].y * H);
      for (var i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i].x * W, pts[i].y * H, (pts[i].x + pts[i + 1].x) / 2 * W, (pts[i].y + pts[i + 1].y) / 2 * H);
      var l = pts[pts.length - 1]; ctx.lineTo(l.x * W, l.y * H); ctx.stroke();
    },
    /* pointer input for a pad. A mouse or pen writes at once. On a touch screen the pad lets vertical swipes
       scroll the page (touch-action: pan-y): a touch becomes a stroke only once it moves without the browser
       taking it for a scroll, and a tap with no movement switches the pad to writing mode (touch-action:
       none) until a touch lands elsewhere or the pad leaves the screen. h: down(t, pt), move(pt), up(t),
       blocked() */
    input: function (surface, canvas, h) {
      var pending = null, active = null;
      function norm(e) {
        var r = canvas.getBoundingClientRect();
        return { x: MB.clamp((e.clientX - r.left) / r.width, 0, 1), y: MB.clamp((e.clientY - r.top) / r.height, 0, 1), p: e.pressure && e.pointerType === "pen" ? e.pressure : 0.5 };
      }
      function arm(on) { surface.classList.toggle("is-writing", !!on); }
      function capture(id) { try { canvas.setPointerCapture(id); } catch (err) { /* capture is optional */ } }
      canvas.addEventListener("pointerdown", function (e) {
        if (h.blocked()) return;
        if (e.pointerType === "touch" && !surface.classList.contains("is-writing")) {
          pending = { id: e.pointerId, t: performance.now(), pt: norm(e), x: e.clientX, y: e.clientY };
          return;
        }
        e.preventDefault(); capture(e.pointerId);
        active = e.pointerId; h.down(performance.now(), norm(e));
      });
      canvas.addEventListener("pointermove", function (e) {
        if (h.blocked()) return;
        if (pending && e.pointerId === pending.id) {
          /* only a stroke that starts sideways is writing; one that starts vertically belongs to the page's scroll */
          var dx = Math.abs(e.clientX - pending.x), dy = Math.abs(e.clientY - pending.y);
          if (pending.vertical || (dx < 6 && dy < 6)) return;
          if (dy >= dx) { pending.vertical = true; return; }
          active = pending.id; capture(active); h.down(pending.t, pending.pt); pending = null;
        }
        if (active !== e.pointerId) return;
        var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        if (!list.length) list = [e];
        list.forEach(function (ce) { h.move(norm(ce)); });
      });
      var end = function (e) {
        if (pending && e.pointerId === pending.id) { if (e.type === "pointerup" && !pending.vertical) arm(true); pending = null; return; }
        if (active === e.pointerId) { active = null; if (!h.blocked()) h.up(performance.now()); }
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
      document.addEventListener("pointerdown", function (e) { if (!surface.contains(e.target)) arm(false); }, true);
      if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { if (!es[0].isIntersecting) arm(false); }).observe(surface);
      if (matchMedia("(pointer: coarse)").matches) {
        var instr = MB.$(".pen-instr", surface);
        if (instr) instr.textContent = "Tap the pad, write, pause two seconds, write again.";
      }
    }
  };

  MB.$$("[data-pen-pad]").forEach(function (root) {
    var surface = MB.$(".pen-surface", root), canvas = MB.$("canvas", surface), ctx = canvas.getContext("2d");
    var modeBtns = MB.$$("[data-pen-mode]", root);
    var readPause = MB.$("[data-pen-pause]", root), readHeld = MB.$("[data-pen-held]", root), hint = MB.$("[data-pen-hint]", root);
    var replayBtn = MB.$("[data-pen-replay]", root), clearBtn = MB.$("[data-pen-clear]", root);
    var mode = root.getAttribute("data-mode") || "b30";
    var strokes = [], cur = null, lastUp = null, replaying = false, dpr = 1, W = 0, H = 0, busyUntil = 0, holdTimer = 0;
    var showingRef = false; /* at rest the pad shows the measured case in light ink, until a stroke is drawn */
    var log = (root._penLog = []); /* timing log for tests: { down, firstInk } */

    function size() {
      var r = surface.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      redraw();
    }
    function style() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = "#2a2620"; ctx.fillStyle = "#2a2620"; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
    function dot(a) { ctx.beginPath(); ctx.arc(a.x * W, a.y * H, 1.4, 0, 6.3); ctx.fill(); }
    function drawRange(s, from, to) {
      style();
      for (var i = Math.max(1, from); i < to; i++) {
        var a = s.pts[i - 1], b = s.pts[i];
        ctx.lineWidth = 1.5 + (b.p || 0.5) * 1.7;
        MB.pen.seg(ctx, W, H, s.pts[i - 2] || a, a, b);
      }
      if (from === 0 && to >= 1) dot(s.pts[0]);
      s.drawn = Math.max(s.drawn, to);
    }
    function redraw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (showingRef) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = "rgba(42, 38, 32, 0.46)"; ctx.lineWidth = 2.1; ctx.lineCap = "round"; ctx.lineJoin = "round";
        MB.pen.hand(W, H).forEach(function (pts) { MB.pen.path(ctx, W, H, pts); });
      }
      strokes.forEach(function (s) { var n = s.drawn; s.drawn = 0; drawRange(s, 0, n); });
    }
    /* the resting state: the measured case on the pad and in the readouts */
    function refHeld() {
      say(readHeld, mode === "now" ? 'none (measured about <span class="num">1.5 ms</span>)' : '<span class="num">1,479 ms</span> (Build 30 median)');
    }
    function showReference() {
      showingRef = true;
      surface.classList.add("is-ref");
      say(readPause, '<span class="num">2.0 s</span>');
      refHeld();
      redraw();
    }
    function dropReference() {
      if (!showingRef) return;
      showingRef = false; surface.classList.remove("is-ref");
      readPause.textContent = "none yet"; readHeld.textContent = "none yet";
      redraw();
    }
    function setMode(m) {
      mode = m; root.setAttribute("data-mode", m);
      modeBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-pen-mode") === m)); });
      if (moveInk) moveInk();
      if (showingRef) refHeld(); else readHeld.textContent = "none yet";
      hint.hidden = true;
    }
    function fmtPause(s) { return '<span class="num">' + s.toFixed(1) + " s</span>"; }
    function say(el, html) { el.innerHTML = html; }

    function down(t, pt) {
      dropReference();
      surface.classList.add("is-used");
      var pause = lastUp == null ? null : (t - lastUp) / 1000;
      cur = { pts: [pt], drawn: 0, held: false, flushing: false, down: t };
      strokes.push(cur);
      var entry = { down: t, firstInk: null, held: false, pause: pause };
      log.push(entry); cur.entry = entry;
      if (pause != null) say(readPause, fmtPause(pause));
      if (mode === "b30" && pause != null && pause >= WIN[0] && pause <= WIN[1]) {
        cur.held = true; entry.held = true;
        surface.classList.add("is-holding"); root.classList.add("is-holding");
        say(readHeld, '<span class="num">1,479 ms</span> (Build 30 median)');
        hint.hidden = true;
        busyUntil = t + HOLD_MS;
        clearTimeout(holdTimer);
        holdTimer = setTimeout(flushAll, Math.max(0, busyUntil - performance.now()));
      } else if (mode === "b30" && t < busyUntil) {
        /* the UI thread is still busy with the echo: this stroke waits for the same flush */
        cur.held = true;
      } else {
        if (pause != null) {
          say(readHeld, mode === "now" ? 'none (measured about <span class="num">1.5 ms</span>)' : "none");
          hint.hidden = !(mode === "b30" && pause >= 1);
        }
        drawRange(cur, 0, 1); entry.firstInk = performance.now();
      }
    }
    function flushAll() {
      surface.classList.remove("is-holding"); root.classList.remove("is-holding");
      strokes.forEach(function (s) { if (s.held && !s.flushing) flush(s); });
    }
    function flush(s) {
      s.flushing = true;
      var t0 = performance.now(), total = s.pts.length;
      if (s.entry.firstInk == null) s.entry.firstInk = t0;
      var step = function (now) {
        if (strokes.indexOf(s) < 0) return;
        var k = MB.reduced() ? 1 : MB.clamp((now - t0) / FLUSH_MS, 0, 1);
        var upto = Math.max(1, Math.round(total * k));
        drawRange(s, s.drawn, upto);
        if (k < 1) requestAnimationFrame(step);
        else { s.held = false; s.flushing = false; drawRange(s, s.drawn, s.pts.length); }
      };
      step(t0);
    }
    function moveTo(pt) {
      if (!cur) return;
      cur.pts.push(pt);
      if (!cur.held && !cur.flushing) drawRange(cur, cur.drawn, cur.pts.length);
    }
    function up(t) { if (!cur) return; lastUp = t; cur = null; }

    MB.pen.input(surface, canvas, { down: down, move: moveTo, up: up, blocked: function () { return replaying; } });

    function clear() {
      showingRef = false; surface.classList.remove("is-ref");
      clearTimeout(holdTimer); busyUntil = 0;
      strokes = []; cur = null; lastUp = null; log.length = 0;
      surface.classList.remove("is-used", "is-holding"); root.classList.remove("is-holding");
      readPause.textContent = "none yet"; readHeld.textContent = "none yet"; hint.hidden = true;
      redraw();
    }
    /* the keyboard path: the reference words, written again with their own timing (the 2.0 s pause included) */
    function replay() {
      if (replaying) return;
      clear(); replaying = true; replayBtn.disabled = true; clearBtn.disabled = true;
      var t0 = performance.now(), all = [];
      MB.pen.hand(W, H).forEach(function (pts) {
        pts.forEach(function (p, i) { all.push({ t: p.t, kind: i === 0 ? "down" : "move", p: p }); });
        all.push({ t: pts[pts.length - 1].t, kind: "up" });
      });
      var idx = 0;
      var tick = function () {
        var now = performance.now(), el = now - t0;
        while (idx < all.length && all[idx].t <= el) {
          var ev = all[idx++];
          if (ev.kind === "down") down(t0 + ev.t, ev.p); else if (ev.kind === "move") moveTo(ev.p); else up(t0 + ev.t);
        }
        if (idx < all.length) requestAnimationFrame(tick);
        else setTimeout(function () { replaying = false; replayBtn.disabled = false; clearBtn.disabled = false; }, mode === "b30" ? 1500 : 0);
      };
      requestAnimationFrame(tick);
    }

    var seg = modeBtns[0] && modeBtns[0].closest(".seg"), moveInk = seg ? MB.inkFor(seg) : null;
    modeBtns.forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-pen-mode")); }); });
    replayBtn.addEventListener("click", replay);
    clearBtn.addEventListener("click", clear);
    setMode(mode);
    showReference();
    size();
    MB.onLayout(size);
    root._pen = { replay: replay, clear: clear, setMode: setMode, log: log };
  });

  /* ================================================================ proof tabs: one lit instrument, two fixes */
  MB.$$(".proof-tabs").forEach(function (list) {
    var move = MB.inkFor(list);
    MB.tablist(list, function (t) {
      MB.$$('[role="tab"]', list).forEach(function (x) {
        var panel = document.getElementById(x.getAttribute("aria-controls"));
        if (panel) panel.hidden = x !== t;
      });
      move(); MB.invalidate();
    });
  });

  /* ================================================================ erase grid */
  MB.$$("[data-erase-grid]").forEach(function (root) {
    var canvas = MB.$("canvas", root), ctx = canvas.getContext("2d");
    var btns = MB.$$("[data-erase-mode]", root), count = MB.$("[data-erase-count]", root);
    var COLS = 50, ROWS = 40, N = COLS * ROWS, ERASED = 812;
    /* on the cream paper (homepage) the dots are ink; on the slate (case page) they are light */
    var paper = root.getAttribute("data-erase-ink") === "paper";
    var INK = paper ? { off: "rgba(42, 38, 32, 0.17)", lit: "196, 84, 62", hit: "rgb(42 38 32)" } : { off: "rgba(170, 190, 220, 0.16)", lit: "226, 150, 112", hit: "rgb(255 236 214)" };
    var group = Math.floor(ERASED / 32) * 32;
    var lit = {
      b30: function (i) { return i >= ERASED && i < ERASED + 1000; },
      now: function (i) { return i >= group + 1 && i < group + 31; }
    };
    var TEXT = { b30: '<b class="num">~1,000</b> of 2,000 strokes re-recorded', now: '<b class="num">~30</b> of 2,000 strokes re-recorded' };
    var mode = "b30", mix = 0, from = 0, t0 = 0, raf = 0;
    function draw() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = canvas.clientWidth || 400, h = canvas.clientHeight || w * 0.8;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      var cw = w / COLS, ch = h / ROWS, r = Math.min(cw, ch) * 0.28;
      for (var i = 0; i < N; i++) {
        var x = (i % COLS) * cw + cw / 2, y = Math.floor(i / COLS) * ch + ch / 2;
        if (i === ERASED) { ctx.fillStyle = INK.hit; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, 6.3); ctx.fill(); continue; }
        var a = lit.b30(i) ? 1 - mix : 0, b = lit.now(i) ? mix : 0, l = Math.max(a, b);
        ctx.fillStyle = l > 0.02 ? "rgba(" + INK.lit + ", " + (0.22 + l * 0.78).toFixed(3) + ")" : INK.off;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      }
    }
    function animate(now) {
      var goal = mode === "now" ? 1 : 0;
      var k = MB.reduced() ? 1 : MB.clamp((now - t0) / 600, 0, 1);
      var e = 1 - Math.pow(1 - k, 3);
      mix = from + (goal - from) * e;
      draw();
      if (k < 1) raf = requestAnimationFrame(animate);
    }
    function set(m) {
      mode = m;
      btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-erase-mode") === m)); });
      count.innerHTML = TEXT[m];
      from = mix; t0 = performance.now();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(animate);
      if (moveInk) moveInk();
    }
    var seg = MB.$(".seg", root), moveInk = seg ? MB.inkFor(seg) : null;
    btns.forEach(function (b) { b.addEventListener("click", function () { set(b.getAttribute("data-erase-mode")); }); });
    MB.onLayout(draw);
    set("b30"); draw();
  });
})();
