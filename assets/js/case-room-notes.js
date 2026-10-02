/* Mika Be portfolio: Room Notes case page (projects/room-notes.html).
   [data-reg]    the hero lineup. Point at the page on one device and the same 900 x 1200 page
                 coordinate is marked on the other two. The page rectangles were measured from the
                 captures (page borders and the equation box line up across all three). Plays once on
                 arrival to show what it does; fine pointers only after that.
   [data-bench]  the pen-freeze bench: the homepage pad, plus a live trace of the visitor's own strokes
                 that shows Build 30 and Now for the same input. Same timing contract as notes.js:
                 Build 30 holds a new stroke's ink for 1,479 ms when the pause was 1.8 to 2.6 s, then
                 flushes it over 120 ms. Only BENCHMARKS.md survivors appear (1,479, 1,462, about 1.5, 8.3).
                 Other pauses of a second or more are marked as outside the measured case.
   [data-kills]  40 hard process kills (20 + an independent re-run of 20), lit once on first view.
   Needs core.js (MB.loop, MB.inkFor, MB.reduced). Element API for tests: bench._pen. */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB) return;

  /* ================================================================ same spot on every device */
  var PAGE_W = 900, PAGE_H = 1200;
  /* page rectangle inside each capture, in capture pixels: origin x, y and s pixels per page unit.
     vis is the last page row in view: the laptop shows the top of the page, the phone's sheet covers the rest. */
  var GEO = {
    laptop: { iw: 1440, ih: 900, x: 203.5, y: 216.5, s: 1.1489, vis: 595 },
    ipad: { iw: 1024, ih: 1366, x: 95.5, y: 164.5, s: 0.9256, vis: 1200 },
    phone: { iw: 430, ih: 932, x: 32, y: 259, s: 0.4056, vis: 988, visAll: 1200 } /* the reading-mode face shows the whole page; the photo sheet covers below 988 */
  };
  function pct(v, of) { return (v / of * 100).toFixed(3) + "%"; }

  MB.$$("[data-reg]").forEach(function (fig) {
    var stage = MB.$("[data-device-stage]", fig);
    var hint = MB.$("[data-reg-hint]", fig), read = MB.$("[data-reg-read]", fig);
    var marks = {}, demo = 0;
    function visOf(k, g) { return g.visAll && stage.getAttribute("data-active") !== k ? g.visAll : g.vis; }
    MB.$$("[data-device]", stage).forEach(function (d) {
      var key = d.getAttribute("data-device"), g = GEO[key];
      if (!g) return;
      var L = pct(g.x, g.iw), T = pct(g.y, g.ih), W = pct(PAGE_W * g.s, g.iw), H = pct(PAGE_H * g.s, g.ih);
      var o = document.createElement("span");
      o.className = "rn-reg";
      o.setAttribute("aria-hidden", "true");
      o.innerHTML = '<span class="rn-reg-page" style="left:' + L + ";top:" + T + ";width:" + W + ";height:" + H + '"></span>' +
        '<span class="rn-reg-x" style="left:' + L + ";width:" + W + '"></span>' +
        '<span class="rn-reg-y" style="top:' + T + ";height:" + H + '"></span><span class="rn-reg-dot"></span>';
      d.appendChild(o);
      marks[key] = { el: o, g: g };
    });
    function show(px, py) {
      Object.keys(marks).forEach(function (k) {
        var m = marks[k], g = m.g, vis = visOf(k, g), off = k === "laptop" && py > vis;
        /* the marks move by transform only (px of this device's box), so nothing is laid out again */
        var w = m.el.offsetWidth, h = m.el.offsetHeight;
        m.el.style.setProperty("--tx", ((g.x + px * g.s) / g.iw * w).toFixed(1) + "px");
        m.el.style.setProperty("--ty", ((g.y + (off ? vis : py) * g.s) / g.ih * h).toFixed(1) + "px");
        m.el.classList.toggle("is-off", off);
        m.el.classList.toggle("is-under", k === "phone" && py > vis);
      });
      fig.classList.add("is-reg");
      if (read) read.textContent = "x " + Math.round(px) + " · y " + Math.round(py);
    }
    function hide() { fig.classList.remove("is-reg"); if (read) read.textContent = ""; }
    function pageAt(e) {
      var d = e.target && e.target.closest ? e.target.closest("[data-device]") : null;
      var m = d && marks[d.getAttribute("data-device")];
      if (!m) return null;
      var g = m.g, r = d.getBoundingClientRect();
      if (!r.width) return null;
      var px = (((e.clientX - r.left) / r.width) * g.iw - g.x) / g.s;
      var py = (((e.clientY - r.top) / r.height) * g.ih - g.y) / g.s;
      if (px < 0 || px > PAGE_W || py < 0 || py > Math.min(PAGE_H, visOf(d.getAttribute("data-device"), g))) return null;
      return [px, py];
    }
    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      demo = 0;
      var p = pageAt(e);
      if (p) show(p[0], p[1]); else hide();
    });
    stage.addEventListener("pointerleave", function () { if (!demo) hide(); });
    if (hint && MB.fine()) hint.hidden = false;

    /* once, on arrival: the mark travels from the page title to the equation on all three devices */
    function runDemo() {
      var a = [74, 96], b = [669, 244], t0 = performance.now() + 500, dur = 1300, hold = 1200, id = ++demo;
      var step = function (now) {
        if (demo !== id) return;
        if (now >= t0) {
          var k = MB.clamp((now - t0) / dur, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          show(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e);
        }
        if (now < t0 + dur + hold) requestAnimationFrame(step);
        else { demo = 0; hide(); }
      };
      requestAnimationFrame(step);
    }
    if (!MB.reduced() && innerWidth >= 900 && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        if (stage.getAttribute("data-active") === "all") runDemo();
      }, { threshold: 0.6 });
      io.observe(stage);
    }
  });

  /* ================================================================ the pen bench and its live trace */
  var HOLD_MS = 1479, FLUSH_MS = 120, WIN = [1.8, 2.6], FLOW = 1.0, CAP = 3.4;
  var C = {
    pen: "rgba(236, 231, 223, 0.36)", ink: "rgba(239, 233, 221, 0.86)", ui: "rgba(120, 152, 200, 0.62)",
    out: "rgba(236, 231, 223, 0.30)", axis: "rgba(236, 231, 223, 0.09)", label: "rgba(236, 231, 223, 0.6)",
    held: "#e88a7c", blue: "rgb(168, 196, 236)", cursor: "rgba(168, 196, 236, 0.55)"
  };
  var SANS = '500 11.5px Inter, ui-sans-serif, system-ui, sans-serif', MONO = '600 11px "JetBrains Mono", ui-monospace, monospace';

  function kindFor(pause) {
    if (pause == null) return "first";
    if (pause < FLOW) return "flow";
    if (pause >= WIN[0] && pause <= WIN[1]) return "measured";
    return "outside";
  }
  function fmtS(s) { return s.toFixed(1) + " s"; }

  MB.$$("[data-bench]").forEach(function (root) {
    var surface = MB.$("[data-bench-surface]", root), canvas = MB.$("canvas", surface), ctx = canvas.getContext("2d");
    var modeBtns = MB.$$("[data-bench-mode]", root);
    var readPause = MB.$("[data-bench-pause]", root), readHeld = MB.$("[data-bench-held]", root), hint = MB.$("[data-bench-hint]", root);
    var replayBtn = MB.$("[data-bench-replay]", root), clearBtn = MB.$("[data-bench-clear]", root);
    var title = MB.$("[data-trace-title]", root), tcan = MB.$("[data-trace-canvas]", root), tctx = tcan.getContext("2d");
    var scaleBar = MB.$("[data-trace-scale]", root);
    var mode = root.getAttribute("data-mode") || "b30";
    var strokes = [], cur = null, lastUp = null, replaying = false, dpr = 1, W = 0, H = 0, busyUntil = 0, holdTimer = 0;
    var showingRef = false; /* at rest the pad shows the measured case, replayed, until a stroke is drawn */
    var log = [];
    /* the trace: one entry per stroke, both builds computed from the same input */
    var trace = { list: [], reference: true, lastUp: null, now: 0 };
    var live = false, tW = 0, tH = 0, tdpr = 1, pxs = 100, viewStart = 0, hatch = null;

    /* ---------------------------------------------------------------- pad (same drawing as notes.js) */
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
        /* one path per stroke, so the lighter ink has no overlapping joints */
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.strokeStyle = "rgba(42, 38, 32, 0.46)"; ctx.lineWidth = 2.1; ctx.lineCap = "round"; ctx.lineJoin = "round";
        MB.pen.hand(W, H).forEach(function (pts) { MB.pen.path(ctx, W, H, pts); });
      }
      strokes.forEach(function (s) { var n = s.drawn; s.drawn = 0; drawRange(s, 0, n); });
    }
    /* the resting state: the scripted measured case on the pad, in the readouts and in the trace */
    function showReference() {
      showingRef = true;
      surface.classList.add("is-ref");
      say(readPause, '<span class="num">2.0 s</span>');
      refHeld();
      redraw();
    }
    function refHeld() {
      say(readHeld, mode === "now" ? 'none <small>measured about <span class="num">1.5 ms</span></small>' : '<span class="num">1,479 ms</span> <small>Build 30 median</small>');
    }
    function dropReference() {
      if (!showingRef) return;
      showingRef = false; surface.classList.remove("is-ref");
      readPause.textContent = "none yet"; readHeld.textContent = "none yet";
      redraw();
    }
    function say(el, html) { el.innerHTML = html; }

    function down(t, pt) {
      if (trace.reference) { trace.reference = false; trace.list = []; if (!replaying) title.textContent = "Your strokes"; }
      dropReference();
      surface.classList.add("is-used");
      surface.classList.remove("is-cue");
      var pause = lastUp == null ? null : (t - lastUp) / 1000, kind = kindFor(pause);
      cur = { pts: [pt], drawn: 0, held: false, flushing: false, down: t };
      strokes.push(cur);
      var entry = { down: t, firstInk: null, held: false, pause: pause, kind: kind };
      log.push(entry); cur.entry = entry;
      var te = { down: t, up: null, pause: pause, kind: kind };
      trace.list.push(te);
      if (pause != null && pause >= FLOW) {
        say(readPause, '<span class="num">' + fmtS(pause) + "</span>");
        hint.hidden = kind !== "outside";
        if (kind === "outside") say(readHeld, "outside the replayed case");
        else if (mode === "now") say(readHeld, 'none <small>measured about <span class="num">1.5 ms</span></small>');
      }
      if (mode === "b30" && kind === "measured") {
        cur.held = true; entry.held = true;
        surface.classList.add("is-holding");
        say(readHeld, '<span class="num">1,479 ms</span> <small>Build 30 median</small>');
        busyUntil = t + HOLD_MS;
        clearTimeout(holdTimer);
        holdTimer = setTimeout(flushAll, Math.max(0, busyUntil - performance.now()));
      } else if (mode === "b30" && t < busyUntil) {
        /* the UI thread is still busy with the echo: this stroke waits for the same flush */
        cur.held = true; te.inkAt = busyUntil;
      } else {
        drawRange(cur, 0, 1); entry.firstInk = performance.now();
      }
      wake();
    }
    function flushAll() {
      surface.classList.remove("is-holding");
      strokes.forEach(function (s) { if (s.held && !s.flushing) flush(s); });
    }
    function flush(s) {
      if (strokes.indexOf(s) < 0) return;
      s.flushing = true;
      var t0 = performance.now();
      if (s.entry.firstInk == null) s.entry.firstInk = t0;
      var step = function (now) {
        if (strokes.indexOf(s) < 0) return;
        var k = MB.reduced() ? 1 : MB.clamp((now - t0) / FLUSH_MS, 0, 1);
        drawRange(s, s.drawn, Math.max(1, Math.round(s.pts.length * k)));
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
    function up(t) {
      if (!cur) return;
      lastUp = t; trace.lastUp = t;
      var e = trace.list[trace.list.length - 1];
      if (e && e.up == null) e.up = t;
      cur = null;
      describe();
      wake();
    }

    MB.pen.input(surface, canvas, { down: down, move: moveTo, up: up, blocked: function () { return replaying; } });

    function clear() {
      dropReference();
      clearTimeout(holdTimer); busyUntil = 0;
      strokes = []; cur = null; lastUp = null; log.length = 0;
      trace.list = []; trace.reference = false; trace.lastUp = null;
      surface.classList.remove("is-used", "is-holding", "is-cue");
      readPause.textContent = "none yet"; readHeld.textContent = "none yet"; hint.hidden = true;
      title.textContent = "Your strokes";
      redraw(); drawTrace(performance.now()); describe();
    }
    function replay() {
      if (replaying) return;
      clear(); replaying = true; replayBtn.disabled = true; clearBtn.disabled = true;
      title.textContent = "The measured timing, replayed";
      /* the reference words, written again with their own timing (the 2.0 s pause included) */
      var t0 = performance.now(), all = [];
      MB.pen.hand(W, H).forEach(function (pts) {
        pts.forEach(function (p, i) { all.push({ t: p.t, kind: i === 0 ? "down" : "move", p: p }); });
        all.push({ t: pts[pts.length - 1].t, kind: "up" });
      });
      var idx = 0;
      var tick = function () {
        var el = performance.now() - t0;
        while (idx < all.length && all[idx].t <= el) {
          var ev = all[idx++];
          if (ev.kind === "down") down(t0 + ev.t, ev.p); else if (ev.kind === "move") moveTo(ev.p); else up(t0 + ev.t);
        }
        if (idx < all.length) requestAnimationFrame(tick);
        else setTimeout(function () { replaying = false; replayBtn.disabled = false; clearBtn.disabled = false; }, mode === "b30" ? 1500 : 0);
      };
      requestAnimationFrame(tick);
    }
    function setMode(m) {
      mode = m; root.setAttribute("data-mode", m);
      modeBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-bench-mode") === m)); });
      if (moveInk) moveInk();
      hint.hidden = true;
      if (showingRef) refHeld(); else readHeld.textContent = "none yet";
    }

    /* ---------------------------------------------------------------- the trace */
    function tsize() {
      var r = tcan.getBoundingClientRect();
      if (!r.width) return;
      tdpr = Math.min(2, window.devicePixelRatio || 1);
      tW = r.width; tH = r.height;
      tcan.width = Math.round(tW * tdpr); tcan.height = Math.round(tH * tdpr);
      pxs = MB.clamp(tW / (tW < 520 ? 5.6 : 9.6), 44, 128);
      if (scaleBar) scaleBar.style.width = Math.round(pxs) + "px";
      hatch = null;
      drawTrace(performance.now());
    }
    function hatchFill() {
      if (hatch) return hatch;
      var c = document.createElement("canvas"), s = Math.round(7 * tdpr);
      c.width = s; c.height = s;
      var x = c.getContext("2d");
      x.fillStyle = "rgba(224, 96, 79, 0.16)"; x.fillRect(0, 0, s, s);
      x.strokeStyle = "rgba(232, 120, 104, 0.85)"; x.lineWidth = 1.6 * tdpr;
      x.beginPath(); x.moveTo(-1, s + 1); x.lineTo(s + 1, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(s - 1, s + 1); x.lineTo(s + 1, s - 1); x.stroke();
      hatch = tctx.createPattern(c, "repeat");
      return hatch;
    }
    function rr(x, y, w, h, r) {
      w = Math.max(w, 0.5); r = Math.min(r, w / 2, h / 2);
      tctx.beginPath(); tctx.moveTo(x + r, y); tctx.arcTo(x + w, y, x + w, y + h, r); tctx.arcTo(x + w, y + h, x, y + h, r);
      tctx.arcTo(x, y + h, x, y, r); tctx.arcTo(x, y, x + w, y, r); tctx.closePath();
    }
    function bar(x0, x1, lane, fill, opts) {
      opts = opts || {};
      var h = opts.h || 12, y = lane * 34 + 34 - h - 5 + (opts.dy || 0);
      if (x1 < 0 || x0 > tW) return;
      rr(x0, y, x1 - x0, h, 3);
      if (opts.dash) { tctx.setLineDash([3, 3]); tctx.strokeStyle = fill; tctx.lineWidth = 1; tctx.stroke(); tctx.setLineDash([]); }
      else { tctx.fillStyle = fill; tctx.fill(); if (opts.stroke) { tctx.strokeStyle = opts.stroke; tctx.lineWidth = 1; tctx.stroke(); } }
    }
    /* a label made of runs: [text, font, colour]; placed at x, clamped inside the canvas */
    function label(runs, x, lane, align) {
      var w = 0;
      runs.forEach(function (r) { tctx.font = r[1]; r.w = tctx.measureText(r[0]).width; w += r.w; });
      var start = align === "center" ? x - w / 2 : x;
      start = MB.clamp(start, 2, Math.max(2, tW - w - 2));
      var y = lane * 34 + 12;
      runs.forEach(function (r) { tctx.font = r[1]; tctx.fillStyle = r[2]; tctx.textBaseline = "alphabetic"; tctx.fillText(r[0], start, y); start += r.w; });
    }
    function layout(now) {
      var out = [], upDisp = 0;
      trace.list.forEach(function (e, i) {
        var d0 = i === 0 ? 0 : upDisp + Math.min(e.pause, CAP);
        var len = ((e.up != null ? e.up : now) - e.down) / 1000;
        out.push({ e: e, d0: d0, len: len, gap0: upDisp, el: (now - e.down) / 1000 });
        upDisp = d0 + len;
      });
      var dNow = upDisp;
      if (!cur && trace.lastUp != null && out.length) dNow = upDisp + Math.min((now - trace.lastUp) / 1000, CAP);
      return { items: out, dNow: dNow, upDisp: upDisp };
    }
    function drawTrace(now) {
      if (!tW) return;
      tctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
      tctx.clearRect(0, 0, tW, tH);
      for (var l = 0; l < 4; l++) { tctx.fillStyle = C.axis; tctx.fillRect(0, l * 34 + 34 - 11, tW, 1); }
      var ref = trace.reference;
      var tnow = ref ? 1e12 : now;
      var lay = ref ? refLayout() : layout(tnow);
      var span = tW / pxs;
      if (!ref) viewStart = Math.max(0, lay.dNow + 0.9 - span); else viewStart = 0;
      var X = function (d) { return (d - viewStart) * pxs + (ref ? pxs * 0.35 : 4); };
      if (!lay.items.length) {
        tctx.font = SANS; tctx.fillStyle = C.label; tctx.textBaseline = "middle";
        tctx.fillText("Write on the pad to trace your strokes here.", 4, 34 * 1.5);
        return;
      }
      var labelled = {};
      lay.items.forEach(function (it, i) {
        var e = it.e, x0 = X(it.d0), x1 = X(it.d0 + it.len), measured = e.kind === "measured", outside = e.kind === "outside";
        /* the gap before this stroke, labelled with the pause */
        if (i > 0 && e.pause >= FLOW) {
          var g0 = X(it.gap0), g1 = x0, mid = (g0 + g1) / 2;
          if (e.pause > CAP) {
            tctx.strokeStyle = C.label; tctx.lineWidth = 1;
            tctx.beginPath(); tctx.moveTo(mid - 5, 27); tctx.lineTo(mid - 1, 19); tctx.moveTo(mid + 1, 27); tctx.lineTo(mid + 5, 19); tctx.stroke();
          }
          label([[fmtS(e.pause), MONO, measured ? C.blue : C.label]], mid, 0, "center");
        }
        /* lane 0: the pen */
        bar(x0, Math.max(x1, x0 + 2), 0, C.pen);
        /* lanes 1 and 2: Build 30 */
        if (measured) {
          var held = Math.min(HOLD_MS / 1000, Math.max(0, it.el));
          var hx = X(it.d0 + held);
          bar(x0, hx, 1, hatchFill(), { h: 13, dy: 0.5, stroke: "rgba(232, 120, 104, 0.7)" });
          bar(x0, hx, 2, C.ui);
          if (it.el >= HOLD_MS / 1000) {
            var inkEnd = Math.max(it.len, HOLD_MS / 1000 + FLUSH_MS / 1000);
            if (e.up == null) inkEnd = Math.max(it.el, HOLD_MS / 1000 + 0.02);
            bar(hx + 1, X(it.d0 + inkEnd), 1, C.ink);
          }
          if (!labelled.held) { labelled.held = 1; label([["pen held ", SANS, C.held], ["1,479 ms", MONO, C.held]], x0, 1); }
          if (!labelled.ui) { labelled.ui = 1; label([["handling its own save echo", SANS, C.label]], x0, 2); }
        } else if (outside) {
          bar(x0, Math.max(x1, x0 + 2), 1, C.out, { dash: true });
        } else if (e.inkAt != null) {
          var wait = (e.inkAt - e.down) / 1000;
          if (it.el >= wait) bar(X(it.d0 + wait) + 1, Math.max(x1, X(it.d0 + wait + FLUSH_MS / 1000)), 1, C.ink);
        } else {
          bar(x0, Math.max(x1, x0 + 2), 1, C.ink);
        }
        /* lane 3: now */
        if (outside) {
          bar(x0, Math.max(x1, x0 + 2), 3, C.out, { dash: true });
          if (!labelled.out) { labelled.out = 1; label([["not the measured pause", SANS, C.label]], x0, 1); }
        } else {
          bar(x0, Math.max(x1, x0 + 2), 3, C.ink);
          if (measured && !labelled.now) { labelled.now = 1; label([["ink right away", SANS, C.label]], x0, 3); }
        }
      });
      /* while the pen is up: the window of the measured pause, and the time cursor */
      if (!ref && !cur && trace.lastUp != null) {
        var gap = (now - trace.lastUp) / 1000, inBand = gap >= WIN[0] && gap <= WIN[1];
        if (gap <= CAP) {
          var b0 = X(lay.upDisp + WIN[0]), b1 = X(lay.upDisp + WIN[1]);
          tctx.fillStyle = inBand ? "rgba(120, 152, 200, 0.30)" : "rgba(120, 152, 200, 0.13)";
          rr(b0, 34 - 19, b1 - b0, 14, 3); tctx.fill();
          tctx.setLineDash([2, 3]); tctx.strokeStyle = "rgba(168, 196, 236, " + (inBand ? 0.9 : 0.45) + ")"; tctx.lineWidth = 1; tctx.stroke(); tctx.setLineDash([]);
          label([["about two seconds", SANS, inBand ? C.blue : C.label]], (b0 + b1) / 2, 0, "center");
          var cx = X(lay.dNow);
          tctx.fillStyle = C.cursor; tctx.fillRect(Math.round(cx), 14, 1, 4 * 34 - 18);
          tctx.setLineDash([1, 3]); tctx.strokeStyle = "rgba(236, 231, 223, 0.3)";
          tctx.beginPath(); tctx.moveTo(X(lay.upDisp) + 2, 34 - 11); tctx.lineTo(cx, 34 - 11); tctx.stroke(); tctx.setLineDash([]);
        }
      }
    }
    /* the reference trace shown before anyone writes: the scripted measured case, complete */
    function refLayout() {
      var h = MB.pen.hand(2, 1), a = h[0], b = h[1];
      if (!a || !b) return { items: [], dNow: 0, upDisp: 0 };
      var aEnd = a[a.length - 1].t / 1000, b0 = b[0].t / 1000, bEnd = b[b.length - 1].t / 1000;
      return { items: [
        { e: { kind: "first", pause: null, up: aEnd }, d0: 0, len: aEnd, gap0: 0, el: 9 },
        { e: { kind: "measured", pause: b0 - aEnd, up: bEnd }, d0: b0, len: bEnd - b0, gap0: aEnd, el: 9 }
      ], dNow: bEnd + 1, upDisp: bEnd };
    }
    /* screen-reader summary, refreshed when a stroke ends */
    function describe() {
      var e = trace.list[trace.list.length - 1], text;
      if (trace.reference) text = tcan.getAttribute("aria-label");
      else if (!e) text = "Trace of your strokes. Nothing written yet.";
      else if (e.kind === "measured") text = "Trace of your strokes. Last pause " + e.pause.toFixed(1) + " seconds, the measured case: Build 30 holds the pen for 1,479 ms while the UI thread handles its own save echo; now the ink appears right away.";
      else if (e.kind === "outside") text = "Trace of your strokes. Last pause " + e.pause.toFixed(1) + " seconds, outside the replayed case of about two seconds.";
      else text = "Trace of your strokes. " + trace.list.length + (trace.list.length === 1 ? " stroke" : " strokes") + " so far.";
      tcan.setAttribute("aria-label", text);
    }
    function busy(now) {
      if (cur || replaying) return true;
      for (var i = 0; i < strokes.length; i++) if (strokes[i].held || strokes[i].flushing) return true;
      return trace.lastUp != null && (now - trace.lastUp) / 1000 < CAP + 0.3;
    }
    function wake() { live = true; MB.loop.wake(); }
    MB.loop.add(function (now) {
      if (!live) return false;
      var gap = trace.lastUp != null && !cur ? (now - trace.lastUp) / 1000 : -1;
      surface.classList.toggle("is-cue", !replaying && gap >= WIN[0] && gap <= WIN[1]);
      drawTrace(now);
      if (!busy(now)) { live = false; surface.classList.remove("is-cue"); drawTrace(now); return false; }
      return true;
    });

    var seg = MB.$(".seg", root), moveInk = seg ? MB.inkFor(seg) : null;
    modeBtns.forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-bench-mode")); }); });
    replayBtn.addEventListener("click", replay);
    clearBtn.addEventListener("click", clear);
    setMode(mode);
    size(); showReference(); tsize();
    MB.onLayout(function () { size(); tsize(); });
    root._pen = { replay: replay, clear: clear, setMode: setMode, log: log, trace: trace };
  });

  /* ================================================================ process kills, lit once */
  MB.$$("[data-kills]").forEach(function (card) {
    var n = 0;
    MB.$$("[data-kill-row]", card).forEach(function (row) {
      var c = +row.getAttribute("data-kill-row") || 20, html = "";
      for (var i = 0; i < c; i++) html += '<i style="--i:' + (n++) + '"></i>';
      row.innerHTML = html;
    });
    var run = function () { card.classList.add("is-run"); };
    if (MB.reduced() || !("IntersectionObserver" in window)) { run(); return; }
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      setTimeout(run, 260);
    }, { threshold: 0.5 });
    io.observe(card);
  });
})();
