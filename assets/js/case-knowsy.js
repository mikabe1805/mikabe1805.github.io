/* Knowsy Breadboard Lab case page. Runs after core.js and probe.js (MB.Probe holds the shared net rule and
   the exact notes). Five pieces:
   1. the bench lamp in the arrival follows the pointer (transform only, idles with the shared scheduler);
   2. the legend under the Lab 1 capture spotlights each part on it;
   3. (removed: the Circuit view capture, until the lab's renderer draws Lab 1's topology correctly);
   4. the probe bench: the LP-10A probe touches any net of the Lab 1 sketch, with readings, the drivers on the
      touched net, and all eight states of the three parts;
   5. the guided-lab shelf: one dot per auto-checked step, and each lab's sections. */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB || !MB.$) return;
  var doc = document;

  /* ---------------------------------------------------------------- 1. bench lamp */
  (function lamp() {
    var sec = MB.$("[data-kn-lamp]");
    var pool = sec && MB.$(".kn-lamp-pool", sec), holes = sec && MB.$(".kn-lamp-holes", sec);
    if (!pool || !holes) return;
    var W = 0, H = 0, cur = null, tgt = { x: 0, y: 0 }, rest = { x: 0, y: 0 }, vis = true;
    function place() {
      var px = Math.round(cur.x - W / 2), py = Math.round(cur.y - H / 2);
      pool.style.transform = "translate3d(" + px + "px," + py + "px,0)";
      holes.style.transform = "translate3d(" + -px + "px," + -py + "px,0)";
    }
    function measure() {
      W = pool.offsetWidth; H = pool.offsetHeight;
      var r = MB.rect(sec), hero = MB.$(".kn-hero-frame", sec), hr = hero ? MB.rect(hero) : null;
      holes.style.width = Math.ceil(r.width) + "px";
      holes.style.height = Math.ceil(r.height) + "px";
      rest.x = r.width * 0.58;
      rest.y = hr ? hr.top - r.top + hr.height * 0.12 : r.height * 0.5;
      if (!cur) cur = { x: rest.x, y: rest.y };
      place();
    }
    MB.onLayout(measure);
    measure();
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) MB.loop.wake(); }).observe(sec);
    MB.loop.add(function (now, dt) {
      if (!vis || MB.reduced()) return false;
      var p = MB.pointer, r = MB.rect(sec);
      if (p.active && MB.fine() && p.y >= r.top && p.y <= r.bottom) { tgt.x = p.x - r.left; tgt.y = p.y - r.top; }
      else { tgt.x = rest.x; tgt.y = rest.y; }
      var k = MB.smooth(0.06, dt);
      cur.x += (tgt.x - cur.x) * k; cur.y += (tgt.y - cur.y) * k;
      place();
      return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.5;
    });
  })();

  /* ---------------------------------------------------------------- 2. spotlights on the Lab 1 capture */
  (function spots() {
    var fig = MB.$("[data-kn-spots]");
    if (!fig) return;
    var btns = MB.$$("[data-spot-for]", fig), marks = MB.$$("[data-spot]", fig), pinned = null, hover = null;
    var pan = MB.$("[data-kn-pan]", fig);
    function show() {
      var id = hover || pinned;
      /* the guided steps sit above the board: the window pans up to them, and back down for the board's parts */
      if (pan) { if (id === "6") pan.setAttribute("data-pan", "top"); else pan.removeAttribute("data-pan"); }
      marks.forEach(function (m) { m.classList.toggle("on", m.getAttribute("data-spot") === id); });
      btns.forEach(function (b) {
        var k = b.getAttribute("data-spot-for");
        b.setAttribute("aria-pressed", String(k === pinned));
        b.classList.toggle("is-hot", k === id);
      });
    }
    btns.forEach(function (b) {
      var id = b.getAttribute("data-spot-for");
      b.addEventListener("click", function () { pinned = pinned === id ? null : id; hover = null; show(); });
      b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hover = id; show(); } });
      b.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hover = null; show(); } });
    });
    fig.addEventListener("keydown", function (e) { if (e.key === "Escape" && pinned) { pinned = null; show(); } });
  })();


  /* ---------------------------------------------------------------- 4. the probe bench */
  (function bench() {
    var el = MB.$("[data-kn-bench]");
    if (!el || !MB.Probe) return;
    var P = MB.Probe, NAMES = P.NAMES, VOLTS = P.VOLTS;
    var COLORS = { HIGH: "#e0604f", LOW: "#5f8fd6", FLOAT: "#8a8f8a", CONFLICT: "#e3a33b" };
    var WHERE = { vcc: "the +5 V rail", a: "input A", y: "output Y", gnd: "the ground rail" };
    var LPCAP = {
      HIGH: "Red LED lit, high tone",
      LOW: "Green LED lit, low tone",
      FLOAT: "Both LEDs dark and silent: the net is floating",
      CONFLICT: "Both LEDs flicker: two drivers fighting"
    };
    var VCAP = {
      HIGH: "TTL high, driven to +5 V",
      LOW: "TTL low, driven to ground",
      FLOAT: "About 1.6 V: floating, no driver",
      CONFLICT: "Two strong drivers fighting"
    };
    var WORD = { switch: ["open", "closed"], pullup: ["out", "in"], stray: ["off", "on"] };
    /* the sketch's wires, by net (SVG user units). The stray wire belongs to net A when it is in. */
    var SEG = {
      vcc: [[40, 40, 500, 40], [214, 40, 214, 64]],
      a: [[150, 156, 330, 156], [214, 128, 214, 156], [280, 156, 280, 194]],
      stray: [[150, 40, 150, 156]],
      y: [[386, 156, 480, 156], [480, 156, 480, 184]],
      gnd: [[40, 296, 610, 296], [280, 233, 280, 296], [480, 266, 480, 296]]
    };
    var TP = { vcc: [470, 40], a: [247, 156], y: [448, 156], gnd: [560, 296] };
    var VB = { w: 640, h: 330 };

    var st = { switch: false, pullup: true, stray: false };
    var pinned = { net: "a", x: TP.a[0], y: TP.a[1] };
    var preview = null;   /* { net: string|null, x, y } while a mouse hovers the circuit */

    var svg = MB.$(".kn-sch", el), wrap = MB.$(".kn-sch-wrap", el), pen = MB.$("[data-kn-pen]", el);
    var tps = MB.$$(".kn-tp", el), toggles = MB.$$("[data-kn-toggle]", el), rows = MB.$$(".kn-state", el), halos = MB.$$("[data-halo]", el);
    var q = function (s) { return MB.$(s, el); };
    var ui = {
      where: q("[data-kn-where]"), level: q("[data-kn-level]"), lpcap: q("[data-kn-lpcap]"), meter: q("[data-kn-meter]"),
      v: q("[data-kn-v]"), vcap: q("[data-kn-vcap]"), net: q("[data-kn-net]"), drivers: q("[data-kn-drivers]"),
      result: q("[data-kn-result]"), note: q("[data-kn-note]")
    };
    var touchEls = [pen, q(".kn-read")].filter(Boolean);
    var status = doc.createElement("p");
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");
    el.appendChild(status);

    function solve() {
      var r = P.solve(st), short = st.switch && st.stray;
      return { r: r, vcc: short ? "CONFLICT" : "HIGH", a: r.a, y: r.y, gnd: short ? "CONFLICT" : "LOW" };
    }
    /* in the lab, a wire or a closed switch joins two nets into one: the touched net lights along all of it */
    function joined(net) {
      if (net === "y") return ["y"];
      var out = [net];
      if (net === "a") { if (st.stray) out.push("vcc"); if (st.switch) out.push("gnd"); }
      if (net === "vcc" && st.stray) { out.push("a"); if (st.switch) out.push("gnd"); }
      if (net === "gnd" && st.switch) { out.push("a"); if (st.stray) out.push("vcc"); }
      return out;
    }
    function drivers(net, s) {
      if (net === "a") return [
        { label: "+5 V through the 4.7 kΩ pull-up", level: "HIGH", strength: st.pullup ? "weak" : "out", on: st.pullup },
        { label: "Ground through the switch", level: "LOW", strength: st.switch ? "strong" : "open", on: st.switch },
        { label: "+5 V through the stray wire", level: "HIGH", strength: st.stray ? "strong" : "off", on: st.stray }
      ];
      if (net === "y") {
        var ok = s.a === "HIGH" || s.a === "LOW";
        return [{ label: "The 74LS04 output", level: s.y, strength: ok ? "strong" : "none", on: ok }];
      }
      var short = st.switch && st.stray;
      if (net === "vcc") return [{ label: "Bench supply, +5 V", level: "HIGH", strength: "strong", on: true }]
        .concat(short ? [{ label: "Ground, through the switch and the stray wire", level: "LOW", strength: "strong", on: true }] : []);
      return [{ label: "Bench supply, ground", level: "LOW", strength: "strong", on: true }]
        .concat(short ? [{ label: "+5 V, through the stray wire and the switch", level: "HIGH", strength: "strong", on: true }] : []);
    }
    function result(net, s) {
      var L = function (lv) { return "<b>" + NAMES[lv] + "</b>"; };
      if (net === "a") {
        var p = st.pullup, w = st.switch, x = st.stray;
        if (w && x) return "Two strong drivers disagree: " + L("CONFLICT") + ".";
        if (w && p) return "The strong low beats the weak high: " + L("LOW") + ".";
        if (w) return "One strong low: " + L("LOW") + ".";
        if (x && p) return "A strong and a weak high agree: " + L("HIGH") + ".";
        if (x) return "One strong high: " + L("HIGH") + ".";
        if (p) return "One weak high with nothing against it: " + L("HIGH") + ".";
        return "Nothing drives the net, so it floats: " + L("FLOAT") + ".";
      }
      if (net === "y") {
        if (s.a === "HIGH") return "The inverter drives the opposite of its high input: " + L("LOW") + ".";
        if (s.a === "LOW") return "The inverter drives the opposite of its low input: " + L("HIGH") + ".";
        if (s.a === "FLOAT") return "Its input floats, so the lab leaves the output undefined: " + L("FLOAT") + ".";
        return "Its input is in conflict, so the lab leaves the output undefined: " + L("FLOAT") + ".";
      }
      if (s[net] === "CONFLICT") return "The stray wire and the closed switch join +5 V to ground through net A, so two strong drivers disagree: " + L("CONFLICT") + ".";
      if (net === "vcc") return (st.stray ? "The supply holds it high, and the stray wire joins net A to it: " : "The supply holds the rail high: ") + L("HIGH") + ".";
      return (st.switch ? "The supply holds it low, and the closed switch joins net A to it: " : "The supply holds the rail low: ") + L("LOW") + ".";
    }
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    var lastStatus = "", lastKey = "", lastLedger = "", ledgerT = 0, scale = 1;
    function ledger(net, s) {
      var html = drivers(net, s).map(function (d) {
        return '<li data-on="' + d.on + '"><span class="kn-dlabel">' + esc(d.label) + '</span><span class="kn-dlevel" data-level="' + d.level + '">' + NAMES[d.level] + '</span><span class="kn-dstrength">' + d.strength + "</span></li>";
      }).join("") + "|" + result(net, s);
      if (html === lastLedger) return;
      lastLedger = html;
      var parts = html.split("|");
      ui.net.textContent = WHERE[net];
      ui.drivers.innerHTML = parts[0];
      ui.result.innerHTML = parts[1];
    }
    function measure() { var w = svg ? svg.getBoundingClientRect().width : 0; if (w) scale = w / VB.w; }
    function render() {
      var s = solve(), at = preview || pinned, air = !at.net, net = at.net || pinned.net, lv = s[net];
      if (pen) pen.style.transform = "translate3d(" + (at.x * scale).toFixed(1) + "px," + (at.y * scale).toFixed(1) + "px,0)";
      /* while the probe slides along one net nothing else changes: skip the rest */
      var key = [+st.switch, +st.pullup, +st.stray, net, air, !!preview, pinned.net, pinned.x, pinned.y].join("|");
      if (key === lastKey) return;
      lastKey = key;
      el.setAttribute("data-a", s.a); el.setAttribute("data-y", s.y);
      el.setAttribute("data-vcc", s.vcc); el.setAttribute("data-gnd", s.gnd);
      el.setAttribute("data-led", s.r.led ? "on" : "off");
      el.setAttribute("data-switch", WORD.switch[+st.switch]);
      el.setAttribute("data-pullup", WORD.pullup[+st.pullup]);
      el.setAttribute("data-stray", WORD.stray[+st.stray]);
      /* touch state lives on the few elements that show it, so a probe move restyles only those */
      touchEls.forEach(function (t) {
        t.setAttribute("data-touch-level", lv);
        if (air) t.setAttribute("data-air", ""); else t.removeAttribute("data-air");
      });
      var lit = air ? [] : joined(net);
      halos.forEach(function (h) {
        var on = lit.indexOf(h.getAttribute("data-halo")) >= 0;
        if (on) { h.style.color = COLORS[lv]; h.setAttribute("data-on", ""); } else h.removeAttribute("data-on");
      });

      ui.where.textContent = WHERE[net];
      ui.level.textContent = NAMES[lv];
      ui.lpcap.textContent = LPCAP[lv];
      ui.meter.setAttribute("data-level", lv);
      ui.v.textContent = VOLTS[lv];
      ui.vcap.textContent = VCAP[lv];
      clearTimeout(ledgerT);
      if (preview) ledgerT = setTimeout(function () { ledger(net, s); }, 90);
      else ledger(net, s);
      if (ui.note.textContent !== s.r.note) ui.note.textContent = s.r.note;

      toggles.forEach(function (b) {
        var k = b.getAttribute("data-kn-toggle");
        b.setAttribute("aria-pressed", String(st[k]));
        var w = MB.$("[data-state]", b); if (w) w.textContent = WORD[k][+st[k]];
      });
      var key = [+st.switch, +st.pullup, +st.stray].join(" ");
      rows.forEach(function (r) {
        var on = r.getAttribute("data-st") === key;
        r.setAttribute("aria-checked", String(on));
        r.tabIndex = on ? 0 : -1;
      });
      tps.forEach(function (b) {
        var on = !preview && b.getAttribute("data-tp") === pinned.net && pinned.x === TP[pinned.net][0] && pinned.y === TP[pinned.net][1];
        var sel = b.getAttribute("data-tp") === pinned.net;
        b.setAttribute("aria-checked", String(sel));
        b.tabIndex = sel ? 0 : -1;
        b.classList.toggle("is-at", on);
      });
      if (!preview) {
        var msg = "Probe on " + WHERE[net] + ": " + NAMES[lv] + ", " + VOLTS[lv] + " volts.";
        if (msg !== lastStatus) { status.textContent = msg; lastStatus = msg; }
      }
    }

    /* ---- the probe follows a mouse over the circuit and snaps to the nearest wire */
    var ctm = null;
    MB.onLayout(function () { ctm = null; measure(); lastKey = ""; render(); });
    addEventListener("scroll", function () { ctm = null; }, { passive: true });
    function toSvg(e) {
      if (!ctm) { var m = svg.getScreenCTM(); ctm = m && m.inverse(); }
      if (!ctm) return null;
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(ctm);
    }
    /* pointer moves are handled once per frame */
    var pending = null, raf = 0;
    function flush() {
      raf = 0;
      var e = pending; pending = null;
      if (!e) return;
      var p = toSvg(e);
      if (!p) return;
      var hit = e.tp ? { net: e.tp, x: TP[e.tp][0], y: TP[e.tp][1] } : nearest(p.x, p.y, 16);
      var c = clampPt(p);
      preview = hit || { net: null, x: c.x, y: c.y };
      pen.classList.add("is-following");
      render();
    }
    function nearest(x, y, radius) {
      var best = null, bd = radius * radius;
      Object.keys(SEG).forEach(function (k) {
        var net = k === "stray" ? (st.stray ? "a" : null) : k;
        if (!net) return;
        SEG[k].forEach(function (g) {
          var dx = g[2] - g[0], dy = g[3] - g[1], len = dx * dx + dy * dy;
          var t = len ? MB.clamp(((x - g[0]) * dx + (y - g[1]) * dy) / len, 0, 1) : 0;
          var px = g[0] + t * dx, py = g[1] + t * dy, d = (x - px) * (x - px) + (y - py) * (y - py);
          if (d < bd) { bd = d; best = { net: net, x: px, y: py }; }
        });
      });
      return best;
    }
    function clampPt(p) { return { x: MB.clamp(p.x, 6, VB.w - 6), y: MB.clamp(p.y, 4, VB.h - 4) }; }
    if (wrap && svg && pen) {
      wrap.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse" || MB.reduced()) return;
        var tp = e.target.closest && e.target.closest(".kn-tp");
        pending = { clientX: e.clientX, clientY: e.clientY, tp: tp ? tp.getAttribute("data-tp") : null };
        if (!raf) raf = requestAnimationFrame(flush);
      });
      wrap.addEventListener("pointerleave", function () {
        pending = null;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (!preview) return;
        preview = null;
        pen.classList.remove("is-following");
        render();
      });
      wrap.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".kn-tp")) return;
        var p = toSvg(e);
        if (!p) return;
        var hit = nearest(p.x, p.y, e.pointerType === "touch" ? 30 : 18);
        if (!hit) return;
        pinned = hit; preview = null;
        pen.classList.remove("is-following");
        render();
      });
    }
    function pinTp(k, focus) {
      pinned = { net: k, x: TP[k][0], y: TP[k][1] };
      preview = null;
      if (pen) pen.classList.remove("is-following");
      render();
      if (focus) tps.forEach(function (b) { if (b.getAttribute("data-tp") === k) b.focus(); });
    }
    tps.forEach(function (b, i) {
      b.addEventListener("click", function () { pinTp(b.getAttribute("data-tp"), false); });
      b.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = tps[(i + 1) % tps.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = tps[(i + tps.length - 1) % tps.length];
        else if (e.key === "Home") n = tps[0];
        else if (e.key === "End") n = tps[tps.length - 1];
        if (n) { e.preventDefault(); pinTp(n.getAttribute("data-tp"), true); }
      });
    });

    toggles.forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-kn-toggle");
        st[k] = !st[k];
        render();
      });
    });
    function setState(r, focus) {
      var v = r.getAttribute("data-st").split(" ");
      st.switch = v[0] === "1"; st.pullup = v[1] === "1"; st.stray = v[2] === "1";
      render();
      if (focus) r.focus();
    }
    rows.forEach(function (r, i) {
      r.addEventListener("click", function () { setState(r, false); });
      r.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") n = rows[(i + 1) % rows.length];
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = rows[(i + rows.length - 1) % rows.length];
        else if (e.key === "Home") n = rows[0];
        else if (e.key === "End") n = rows[rows.length - 1];
        if (n) { e.preventDefault(); setState(n, true); }
      });
    });

    measure();
    el._bench = {
      state: st, render: render, solve: solve, joined: joined,
      set: function (o) { Object.keys(o).forEach(function (k) { st[k] = !!o[k]; }); render(); },
      touch: function (net) { pinTp(net, false); },
      reading: function () {
        var s = solve(), net = (preview || pinned).net || pinned.net;
        return { net: net, level: s[net], volts: VOLTS[s[net]], led: s.r.led, note: s.r.note, air: !(preview || pinned).net };
      }
    };
    render();
  })();

  /* ---------------------------------------------------------------- 5. the guided-lab shelf */
  (function shelf() {
    MB.$$(".kn-lab").forEach(function (li) {
      var groups = (li.getAttribute("data-groups") || "").split(" ").map(Number);
      var lit = (li.getAttribute("data-lit") || "").split(" ").map(Number);
      var dots = MB.$(".kn-dots", li), n = 0;
      if (dots && !dots.children.length) {
        groups.forEach(function (g, gi) {
          var grp = doc.createElement("span");
          grp.className = "kn-grp";
          for (var i = 0; i < g; i++) {
            var d = doc.createElement("i");
            d.className = "kn-dot";
            if ((lit[gi] || 0) > i) { d.className += " is-lit"; d.style.setProperty("--d", 160 + n++ * 60 + "ms"); }
            grp.appendChild(d);
          }
          dots.appendChild(grp);
        });
      }
      var btn = MB.$(".kn-lab-row", li), secs = MB.$(".kn-lab-secs", li);
      if (!btn || !secs) return;
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        secs.hidden = !open;
      });
    });
  })();
})();
