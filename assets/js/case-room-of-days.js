/* Room of Days case page. Runs after quest-ui.js (it reads the engine instance quest-ui made). The theme's
   waveform ("rod-lamp-left-on") is in data.js, so the shared player in listen.js draws it.
     1. the reward engine's receipt, stats, ledger and history sky (quest-ui drives the engine itself)
     2. live readouts in "Each stat changes a rule"
     3. the six rooms: plates crossfade, the app's fire sits at each room's hearth
     4. the App Store film strip and the tap and completion sounds */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB || !MB.$) return;
  var noop = function () {};

  var QE = MB.QuestEngine;
  var engineEl = MB.$("#engine");

  /* ---------------------------------------------------------------- 1. the reward engine (2. the rule readouts live inside it) */
  /* Per-stat rank names and thresholds from lib/content/stat_ranks.dart (same thresholds for every stat). */
  var RANK_AT = [0, 10, 25, 50, 100, 200];
  var RANKS = {
    Body: ["Soft", "Limber", "Trained", "Strong", "Mighty", "Titan"],
    Care: ["Frail", "Steady", "Hale", "Vital", "Radiant", "Undimmed"],
    Mind: ["Curious", "Learner", "Sharp", "Astute", "Sage", "Luminary"],
    Craft: ["Novice", "Apprentice", "Practiced", "Skilled", "Expert", "Master"],
    People: ["Quiet", "Warming", "Kind", "Beloved", "Magnetic", "Beacon"],
    Home: ["Cluttered", "Tidying", "Kept", "Homey", "Welcoming", "Sanctuary"]
  };
  function tierOf(v) { var t = 0; for (var i = 0; i < RANK_AT.length; i++) if (v >= RANK_AT[i]) t = i; return t; }
  function rankProgress(v) { var t = tierOf(v); if (t >= RANK_AT.length - 1) return 1; return MB.clamp((v - RANK_AT[t]) / (RANK_AT[t + 1] - RANK_AT[t]), 0, 1); }
  function ord(n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); }

  /* The receipt notes come from quest-ui.js, so the homepage card and this page always say the same thing. */
  var receiptNote = MB.Quest && MB.Quest.note ? MB.Quest.note : function () { return ""; };
  var SKIP_NOTE = (MB.Quest && MB.Quest.SKIP_NOTE) || "A day passed with nothing done. Your stats stayed where they were.";
  var REST_NOTE = "Starting from the account in the App Store screenshots: level 18, a 12-day streak and 3 streak freezes ready.";
  var NEXT_NOTE = "A new day. The first completion pays in full again.";

  function chipsHTML(p) {
    var parts = p.chips.map(function (c) { return '<span class="fx' + (c.hot ? " hot" : "") + '">' + c.value + " " + c.label + "</span>"; });
    return parts.join('<span aria-hidden="true">×</span>') + '<span aria-hidden="true">=</span><span class="fx sum">' + p.xp + " XP</span>";
  }

  /* HISTORY SKY: a port of lib/widgets/constellation.dart (HistorySky). Every active day is a star on an
     outward spiral; days that touch join into a thread; a missed day leaves no mark. Drawn still: the app's
     stars breathe slowly, and this page keeps light reactive only. */
  var SKY = { W: 145, H: 100, reachAt: 40 };
  function mix(a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); }
  var XP_LIGHT = [242, 205, 147], EMBER = [236, 96, 7], SPECULAR = [255, 244, 217];
  function rgb(c, a) { return "rgb(" + c[0] + " " + c[1] + " " + c[2] + (a != null ? " / " + a.toFixed(3) : "") + ")"; }
  function skyLayout(hist) {
    var days = Object.keys(hist).map(Number).filter(function (d) { return hist[d] > 0; }).sort(function (a, b) { return a - b; });
    var n = days.length, out = [];
    if (!n) return out;
    var turns = MB.clamp(n / 22, 0.35, 3.2), step = n > 1 ? 2 * Math.PI * turns / (n - 1) : 0, span = Math.max(n - 1, SKY.reachAt);
    for (var i = 0; i < n; i++) {
      var th = -Math.PI / 2 + i * step, r = 0.11 + 0.86 * Math.pow(i / span, 0.78);
      out.push({ day: days[i], x: Math.cos(th) * r, y: Math.sin(th) * r, count: hist[days[i]], linked: i > 0 && days[i] - days[i - 1] === 1 });
    }
    return out;
  }
  /* a fixed faint dust behind the record, so a short history never reads as an empty state */
  var DUST = (function () {
    var s = 11, rnd = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }, out = [];
    for (var i = 0; i < 34; i++) { var a = rnd() * 2 * Math.PI, r = Math.sqrt(rnd()); out.push([Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06, 0.25 + rnd() * 0.3, 0.10 + 0.14 * rnd()]); }
    return out;
  })();
  function skySVG(hist, flash) {
    var cx = SKY.W / 2, cy = SKY.H / 2, rx = cx * 0.9, ry = cy * 0.88, unit = Math.min(rx, ry);
    var stars = skyLayout(hist), html = "<defs>";
    var at = function (s) { return [cx + s.x * rx, cy + s.y * ry]; };
    stars.forEach(function (s, i) {
      var heat = (MB.clamp(s.count, 1, 6) - 1) / 5, tone = mix(XP_LIGHT, EMBER, heat);
      html += '<radialGradient id="sk' + i + '"><stop offset="0" stop-color="' + rgb(tone) + '" stop-opacity="' + (0.34 + 0.3 * heat).toFixed(2) + '"/><stop offset="1" stop-color="' + rgb(tone) + '" stop-opacity="0"/></radialGradient>';
    });
    html += '<radialGradient id="skburst"><stop offset="0" stop-color="rgb(255 226 170)" stop-opacity=".75"/><stop offset=".35" stop-color="rgb(255 170 90)" stop-opacity=".28"/><stop offset="1" stop-color="rgb(236 96 7)" stop-opacity="0"/></radialGradient></defs>';
    DUST.forEach(function (d) { html += '<circle class="dust" cx="' + (cx + d[0] * rx).toFixed(2) + '" cy="' + (cy + d[1] * ry).toFixed(2) + '" r="' + d[2].toFixed(2) + '" fill-opacity="' + d[3].toFixed(2) + '"/>'; });
    for (var i = 1; i < stars.length; i++) {
      if (!stars[i].linked) continue;
      var a = at(stars[i - 1]), b = at(stars[i]);
      html += '<line class="thread" x1="' + a[0].toFixed(2) + '" y1="' + a[1].toFixed(2) + '" x2="' + b[0].toFixed(2) + '" y2="' + b[1].toFixed(2) + '"/>';
    }
    stars.forEach(function (s, i) {
      var p = at(s), heat = (MB.clamp(s.count, 1, 6) - 1) / 5, tone = mix(XP_LIGHT, EMBER, heat), core = mix(tone, SPECULAR, 0.3);
      var r = unit * (0.014 + 0.022 * heat) * 1.05;
      var cls = flash && flash.day === s.day ? (flash.kind === "new" ? ' class="is-new"' : ' class="is-grow"') : "";
      html += "<g" + cls + '><circle class="halo" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="' + (r * 3.4).toFixed(2) + '" fill="url(#sk' + i + ')"/>' +
        '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="' + r.toFixed(2) + '" fill="' + rgb(core) + '"/></g>';
    });
    if (flash && flash.kind === "new") {
      var fs = stars.filter(function (s) { return s.day === flash.day; })[0];
      if (fs) { var fp = at(fs); html += '<circle class="burst" cx="' + fp[0].toFixed(2) + '" cy="' + fp[1].toFixed(2) + '" r="' + (unit * 0.16).toFixed(2) + '" fill="url(#skburst)"/>'; }
    }
    if (stars.length) {
      var last = at(stars[stars.length - 1]);
      html += '<circle class="ring" cx="' + last[0].toFixed(2) + '" cy="' + last[1].toFixed(2) + '" r="' + (unit * 0.058).toFixed(2) + '"/>';
    }
    var lit = stars.length, longest = 0, run = 0;
    stars.forEach(function (s) { run = s.linked ? run + 1 : 1; if (run > longest) longest = run; });
    return { svg: html, lit: lit, longest: longest };
  }

  if (engineEl && engineEl._quest && QE) (function () {
    var el = engineEl, eng = el._quest.engine;
    var $ = function (s) { return MB.$(s, el); };
    var ui = {
      kicker: $("[data-e-kicker]"), xp: $("[data-e-xp]"), glim: $("[data-e-glim]"), gain: $("[data-e-gain]"), chips: $("[data-e-chips]"),
      note: $("[data-e-note]"), ledgerEmpty: $("[data-e-ledger-empty]"), ledger: $("[data-e-ledger]"), day: $("[data-e-day]"),
      status: $("[data-e-status]"), sky: $("[data-e-sky]"), skyMeta: $("[data-e-sky-meta]"), glow: $("[data-e-glow]"),
      ladder: MB.$$("[data-q-ladder] li", el), stats: {}
    };
    MB.$$("[data-e-stat]", el).forEach(function (li) {
      ui.stats[li.getAttribute("data-e-stat")] = { li: li, val: MB.$("[data-val]", li), rank: MB.$("[data-rank]", li), gain: MB.$("[data-gain]", li), bar: MB.$(".st-bar i", li) };
    });
    var rules = { Mind: MB.$('[data-rule="Mind"]'), Care: MB.$('[data-rule="Care"]'), Home: MB.$('[data-rule="Home"]') };

    /* the sky's history: the account's 12-day streak (days -12..-1), then the days played here.
       Kept as snapshots beside quest-ui's undo stack, so Undo and Start over restore it exactly. */
    var SEED = 12;
    function seedHist() { var h = {}; for (var d = -SEED; d < 0; d++) h[d] = 1; return h; }
    var hist = seedHist(), stack = [];
    function copy(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }

    function renderSky(flash) {
      if (!ui.sky) return;
      var s = skySVG(hist, flash);
      ui.sky.innerHTML = s.svg;
      var meta = s.lit + " active day" + (s.lit === 1 ? "" : "s") + (s.longest > 1 ? " · longest run " + s.longest + " days" : "");
      if (ui.skyMeta) ui.skyMeta.textContent = meta;
      ui.sky.setAttribute("aria-label", "History sky: " + meta + ". Missed days leave no mark.");
    }

    function renderStats(gainStat, gain, animate) {
      var st = eng.state.stats;
      Object.keys(ui.stats).forEach(function (k) {
        var s = ui.stats[k], v = st[k], up = k === gainStat && gain > 0;
        if (animate && up) MB.countTo(s.val, v, 320); else { s.val.setAttribute("data-value", v); s.val.textContent = v; }
        s.rank.textContent = RANKS[k][tierOf(v)];
        s.bar.style.setProperty("--p", rankProgress(v).toFixed(4));
        s.li.classList.toggle("is-up", up);
        s.gain.textContent = up ? "+" + gain : "";
        s.gain.classList.toggle("on", up);
      });
    }

    function renderRules() {
      var st = eng.state.stats;
      if (rules.Mind) {
        var t = "XP ×" + QE.mindMult(st.Mind).toFixed(2) + " at Mind " + st.Mind;
        if (rules.Mind.textContent !== t) {
          rules.Mind.textContent = t;
          rules.Mind.classList.add("is-bump"); clearTimeout(rules.Mind._t);
          rules.Mind._t = setTimeout(function () { rules.Mind.classList.remove("is-bump"); }, 700);
        }
      }
      if (rules.Care) rules.Care.textContent = "refills every " + QE.cadence(st.Care) + " days at Care " + st.Care;
      if (rules.Home) rules.Home.textContent = "idle bonus ×" + (1 + Math.min(1, st.Home / 200) * 0.25).toFixed(2) + " at Home " + st.Home;
    }

    function renderLedger() {
      var rows = eng.state.ledger.slice(0, 5);
      if (ui.ledgerEmpty) ui.ledgerEmpty.hidden = !!rows.length;
      if (ui.ledger) ui.ledger.innerHTML = rows.map(function (r) {
        return "<li><span>Day " + (r.day + 1) + " · " + ord(r.pass) + " today</span><span class=\"num\">" + Math.round(r.pct * 100) + "%</span><b class=\"num\">+" + r.xp + " XP</b></li>";
      }).join("");
    }

    function renderAccount() {
      var s = eng.state;
      if (ui.day) ui.day.textContent = "Day " + (s.day + 1);
      ui.ladder.forEach(function (li, i) { li.classList.toggle("is-next", i === Math.min(3, s.todayCount)); });
      renderLedger();
      renderRules();
    }

    function showNumbers(p, animate) {
      if (animate) { ui.xp.textContent = "0"; ui.xp.setAttribute("data-value", "0"); MB.countTo(ui.xp, p.xp, 320); }
      else { ui.xp.setAttribute("data-value", p.xp); ui.xp.textContent = p.xp; }
      ui.glim.textContent = "+" + p.glimmers;
      ui.gain.textContent = "+" + p.statGain;
      ui.chips.innerHTML = chipsHTML(p);
      ui.chips.setAttribute("aria-label", QE.chipsText(p));
    }

    /* the view before a completion: what the next completion would pay, and why */
    function showPreview(note) {
      var p = eng.preview(), s = eng.state;
      el.classList.add("is-preview");
      ui.kicker.textContent = "Day " + (s.day + 1) + " · next completion pays";
      showNumbers(p, false);
      if (p.comeback && note === SKIP_NOTE) note += " The gap is now longer than the freezes can cover, so the next completion pays a comeback bonus.";
      ui.note.textContent = note;
    }

    /* the view after a completion: the receipt lands, the stat rises, tonight's star appears */
    function showReceipt(p, animate) {
      el.classList.remove("is-preview");
      ui.kicker.textContent = "Day " + (eng.state.day + 1) + " · " + ord(p.pass) + " completion today";
      showNumbers(p, animate);
      ui.note.textContent = receiptNote(p);
    }

    function flare() {
      if (MB.reduced() || !ui.glow || !ui.glow.animate) return;
      ui.glow.animate([{ opacity: 0.35 }, { opacity: 0.85 }, { opacity: 0.35 }], { duration: 900, easing: "cubic-bezier(.2,.7,.1,1)" });
    }

    /* redraw everything from the engine state, with no motion (load, undo, start over) */
    function restore() {
      var last = eng.last;
      if (last && last.type === "complete") { showReceipt(last.receipt, false); renderStats(last.receipt.stat, last.receipt.statGain, false); }
      else { showPreview(!last ? REST_NOTE : last.type === "skip" ? SKIP_NOTE : situationNote()); renderStats(null, 0, false); }
      renderAccount();
      renderSky(null);
    }
    function situationNote() { return QE.situation(eng.state).gap ? SKIP_NOTE : NEXT_NOTE; }

    /* quest-ui runs every action and tells this page through "mb:quest" (see quest-ui.js) */
    var pending = null;
    el.addEventListener("mb:quest", function (e) {
      var d = e.detail || {}, act = d.type;
      if (act === "complete" && d.phase === "act") {
        var p = d.receipt, day = eng.state.day;
        if (!p) return;
        stack.push(copy(hist));
        pending = { p: p, day: day, isNew: !hist[day] };
        hist[day] = (hist[day] || 0) + 1;
      } else if (act === "complete" && d.phase === "reveal") {
        /* the receipt lands: the stat rises, tonight's star appears */
        var r = pending; pending = null;
        if (!r || r.p !== d.receipt) return;
        renderAccount();
        showReceipt(r.p, true);
        renderStats(r.p.stat, r.p.statGain, true);
        renderSky({ day: r.day, kind: r.isNew ? "new" : "grow" });
        flare();
        if (ui.status) ui.status.textContent = "Quest complete. " + r.p.xp + " XP and " + r.p.glimmers + " Glimmers. Mind " + r.p.statBefore + " to " + r.p.statAfter + ". " + receiptNote(r.p);
      } else if (act === "skip" || act === "next") {
        pending = null;
        stack.push(copy(hist));
        showPreview(act === "skip" ? SKIP_NOTE : situationNote());
        renderStats(null, 0, false);
        renderAccount();
        renderSky(null);
        if (ui.status) ui.status.textContent = ui.note.textContent;
      } else if (act === "undo") {
        pending = null;
        if (stack.length) hist = stack.pop();
        restore();
        if (ui.status) ui.status.textContent = "Undone.";
      } else if (act === "reset") {
        pending = null;
        hist = seedHist(); stack = [];
        restore();
        if (ui.status) ui.status.textContent = "Back to the account in the App Store screenshots.";
      }
    });
    restore();
  })();

  /* ---------------------------------------------------------------- 3. the six rooms */
  var roomsStage = MB.$("[data-rooms]"), pickGroup = MB.$("[data-rooms-pick]");
  if (roomsStage && pickGroup) (function () {
    var stage = roomsStage;
    var layers = MB.$$("[data-room-layer]", stage), picks = MB.$$('[role="radio"]', pickGroup);
    var view = MB.$(".rooms-view", stage), drift = MB.$(".rooms-drift", stage), light = MB.$(".rooms-light", stage);
    var plate = MB.$(".rooms-plate", stage), nameEl = MB.$("[data-room-name]", stage), lineEl = MB.$("[data-room-line]", stage), countEl = MB.$("[data-room-count]", stage), altEl = MB.$("[data-room-alt]", stage);
    var active = 0, visible = false, started = false, swapTimer = 0;
    /* the app sizes its fire against the plate's width and pins the bottom of the frame to the room's
       hearthAnchor (lib/widgets/home_room.dart: 0.125 wide, 0.11 tall). The last number in data-anchor
       lowers it onto the painted grate (a fraction of plate width), checked by eye on each plate. */
    var FIRE_W = 0.125, FIRE_H = 0.11, GLOW_R = 0.30, GLOW_LIFT = 0.048;
    var rooms = layers.map(function (layer) {
      var a = (layer.getAttribute("data-anchor") || "0.866,0.662,0").split(",").map(Number);
      return { layer: layer, img: MB.$(".room-plate", layer), fire: MB.$(".room-fire", layer), glow: MB.$(".room-glow", layer),
        frames: MB.$$(".room-fire img", layer), ax: a[0], ay: a[1], dy: a[2] || 0, iw: +layer.getAttribute("data-iw"), ih: +layer.getAttribute("data-ih") };
    });
    view.setAttribute("role", "img");
    view.removeAttribute("aria-hidden");

    function load(i, withFire) {
      var r = rooms[i];
      if (r.img.getAttribute("data-src")) MB.loadImg(r.img);
      r.frames.forEach(function (f) { if (withFire || f.getAttribute("data-frame") === "b") MB.loadImg(f); });
      return r.img.decode ? r.img.decode().catch(noop) : Promise.resolve();
    }
    /* object-fit: cover math, so the fire rides the exact plate-to-screen mapping at any aspect */
    function place(r) {
      var w = r.layer.clientWidth, h = r.layer.clientHeight;
      if (!w || !h) return;
      var cs = getComputedStyle(r.img).objectPosition.split(" ");
      var px = parseFloat(cs[0]) / 100, py = parseFloat(cs[1] || "50%") / 100;
      if (isNaN(px)) px = 0.5; if (isNaN(py)) py = 0.5;
      var sc = Math.max(w / r.iw, h / r.ih), dw = r.iw * sc, dh = r.ih * sc;
      var ox = (w - dw) * px, oy = (h - dh) * py;
      var bx = ox + r.ax * dw, by = oy + r.ay * dh + r.dy * dw;
      var fw = FIRE_W * dw, fh = FIRE_H * dw;
      var fs = r.fire.style;
      fs.left = (bx - fw / 2).toFixed(1) + "px"; fs.top = (by - fh).toFixed(1) + "px"; fs.width = fw.toFixed(1) + "px"; fs.height = fh.toFixed(1) + "px";
      var gr = GLOW_R * dw, gy = by - GLOW_LIFT * dw, gs = r.glow.style;
      gs.left = (bx - gr).toFixed(1) + "px"; gs.top = (gy - gr).toFixed(1) + "px"; gs.width = gs.height = (2 * gr).toFixed(1) + "px";
    }
    function placeAll() { rooms.forEach(place); }
    MB.onLayout(placeAll);
    placeAll();

    function burn() {
      rooms.forEach(function (r, i) { r.layer.classList.toggle("is-burning", i === active && visible && !MB.reduced()); });
      stage.classList.toggle("is-paused", !visible || document.hidden);
    }
    function caption(i) {
      var p = picks[i], price = +p.getAttribute("data-price");
      nameEl.textContent = p.getAttribute("data-name");
      lineEl.textContent = p.getAttribute("data-line");
      countEl.textContent = (i + 1) + " of " + picks.length + " · " + (price ? "unlocks for " + price + " Glimmers" : "free from the start");
      /* the picture itself is aria-hidden; its description is read from the live plate */
      if (altEl) altEl.textContent = p.getAttribute("data-alt") || "";
    }
    function select(i, focus) {
      if (i === active && started) { if (focus) picks[i].focus(); return; }
      picks.forEach(function (p, k) { var on = k === i; p.setAttribute("aria-checked", String(on)); p.tabIndex = on ? 0 : -1; });
      if (focus) picks[i].focus();
      active = i;
      load(i, true).then(function () {
        if (active !== i) return;
        place(rooms[i]);
        rooms.forEach(function (r, k) { r.layer.classList.toggle("is-active", k === i); });
        burn();
        if (MB.reduced()) caption(i);
        else {
          plate.classList.add("is-swapping");
          clearTimeout(swapTimer);
          swapTimer = setTimeout(function () { caption(i); plate.classList.remove("is-swapping"); }, 220);
        }
      });
    }
    picks.forEach(function (p, i) {
      p.addEventListener("click", function () { select(i, false); });
      p.addEventListener("pointerenter", function () { load(i, false); });
      p.addEventListener("focus", function () { load(i, false); });
      p.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % picks.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i + picks.length - 1) % picks.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = picks.length - 1;
        if (n != null) { e.preventDefault(); select(n, true); }
      });
    });
    active = Math.max(0, picks.findIndex(function (p) { return p.getAttribute("aria-checked") === "true"; }));
    caption(active);

    /* load the first room and the thumbnails when the section comes near; burn only while in view */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !started) {
            started = true;
            load(active, true).then(function () { place(rooms[active]); });
            MB.$$("img[data-src]", pickGroup).forEach(MB.loadImg);
          }
        });
      }, { rootMargin: "700px 0px" }).observe(stage);
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { visible = e.isIntersecting && e.intersectionRatio > 0.01; burn(); if (visible) MB.loop.poke(); });
      }, { threshold: [0, 0.011] }).observe(stage);
    } else { started = true; visible = true; load(active, true); MB.$$("img[data-src]", pickGroup).forEach(MB.loadImg); burn(); }
    document.addEventListener("visibilitychange", burn);

    /* the room drifts a few pixels with the pointer and its light follows; nothing moves on its own */
    var tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, lit = { x: 0, y: 0 }, last = "";
    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      var r = MB.rect(view);
      tgt.x = MB.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      tgt.y = MB.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    }, { passive: true });
    stage.addEventListener("pointerleave", function () { tgt.x = 0; tgt.y = 0; MB.loop.poke(); });
    MB.loop.add(function (now, dt) {
      if (!visible || MB.reduced()) return false;
      var kc = MB.smooth(0.075, dt), kl = MB.smooth(0.2, dt);
      cur.x += (tgt.x - cur.x) * kc; cur.y += (tgt.y - cur.y) * kc;
      lit.x += (tgt.x - lit.x) * kl; lit.y += (tgt.y - lit.y) * kl;
      var t = "translate3d(" + (-cur.x * 9).toFixed(2) + "px," + (-cur.y * 6).toFixed(2) + "px,0) scale(1.03)";
      if (t !== last) { drift.style.transform = t; last = t; }
      var vr = MB.rect(view), w = vr.width, h = vr.height;
      light.style.transform = "translate3d(" + (lit.x * 0.3 * w).toFixed(1) + "px," + (lit.y * 0.25 * h).toFixed(1) + "px,0)";
      return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.004;
    });
  })();

  /* ---------------------------------------------------------------- 4a. the App Store film */
  var film = MB.$("[data-film]");
  if (film) (function () {
    var prev = MB.$("[data-film-prev]"), next = MB.$("[data-film-next]");
    var items = MB.$$(".film-item", film);
    function stepPx() { var it = items[0]; if (!it) return 300; var gap = parseFloat(getComputedStyle(it.parentNode).columnGap) || 24; return (it.offsetWidth + gap) * 2; }
    function state() {
      var max = film.scrollWidth - film.clientWidth - 2;
      if (prev) prev.disabled = film.scrollLeft <= 2;
      if (next) next.disabled = film.scrollLeft >= max;
    }
    var smooth = function () { return MB.reduced() ? "auto" : "smooth"; };
    if (prev) prev.addEventListener("click", function () { film.scrollBy({ left: -stepPx(), behavior: smooth() }); });
    if (next) next.addEventListener("click", function () { film.scrollBy({ left: stepPx(), behavior: smooth() }); });
    film.addEventListener("scroll", function () { state(); }, { passive: true });
    film.addEventListener("keydown", function (e) {
      if (e.target !== film) return;
      if (e.key === "ArrowRight") { e.preventDefault(); film.scrollBy({ left: stepPx() / 2, behavior: smooth() }); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); film.scrollBy({ left: -stepPx() / 2, behavior: smooth() }); }
    });
    MB.onLayout(state);
    state();
    /* the nine frames load together as the strip comes near, so scrolling it never shows blanks */
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { MB.$$("img[data-src]", film).forEach(MB.loadImg); io.disconnect(); }
      }, { rootMargin: "600px 0px" });
      io.observe(film);
    } else MB.$$("img[data-src]", film).forEach(MB.loadImg);
  })();

  /* ---------------------------------------------------------------- 4b. the tap and completion sounds, on request only */
  var sfxBtn = MB.$("[data-rod-sfx]");
  if (sfxBtn) sfxBtn.addEventListener("click", function () {
    try {
      MB.audio.stopAll();
      var tap = new Audio(MB.base + "audio/world/rod-tap.wav"), done = new Audio(MB.base + "audio/world/rod-complete.wav");
      tap.volume = 0.6; done.volume = 0.8; done.preload = "auto";
      sfxBtn.classList.add("is-sounding");
      var p = tap.play(); if (p && p.catch) p.catch(noop);
      setTimeout(function () { var q = done.play(); if (q && q.catch) q.catch(noop); }, 420);
      setTimeout(function () { sfxBtn.classList.remove("is-sounding"); }, 1000);
    } catch (e) { /* sound is an enhancement */ }
  });
})();
