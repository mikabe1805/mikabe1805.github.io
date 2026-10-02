/* Mika Be portfolio: the Room of Days depth room.
   A port of lib/widgets/quest_depth_room.dart: four registered planes on one 1635 x 962 camera,
   each moved per unit of tilt (far 3.0/2.0, wall 7.2/4.6, furniture 14.0/8.3, foreground 24.0/13.5),
   all overscaled 1.08, offsets scaled by cameraWidth/1584. The camera lerps at 0.075 and the light
   at 0.2 per 16.7 ms, framerate-normalised. Used by the homepage stage, the Room of Days door and
   the case page arrival. Markup and data attributes: build/SYSTEM.md. */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB) return;
  var CAM_W = 1635, CAM_H = 962, APP_W = 1584, OVER = 1.08;
  var FIRE = { x: 1290, y: 470, w: 320, h: 300 };
  var ARRIVE_AT = 0.35; /* the share of the room that must be on screen before it arrives */
  var instances = [];

  function num(list, i, d) { var v = parseFloat((list || "").split(/[ ,]+/)[i]); return isNaN(v) ? d : v; }

  function Room(el) {
    this.el = el;
    this.view = MB.$(".depth-view", el);
    this.camera = MB.$(".depth-camera", el);
    this.planes = MB.$$(".plane", el).map(function (p) {
      var k = (p.getAttribute("data-k") || "0,0,0").split(",").map(Number);
      return { el: p, kx: k[0] || 0, ky: k[1] || 0, ks: k[2] || 0, last: "" };
    });
    this.roomLight = MB.$(".room-light", el);
    this.flareEl = MB.$(".hearth-flare", el);
    this.fireFlare = MB.$(".fire-flare", el);
    this.fireBox = MB.$(".depth-fire", el);
    var d = el.dataset;
    this.kScale = parseFloat(d.kScale || "1");
    this.anchor = [num(d.anchor, 0, 0.5), num(d.anchor, 1, 0.5)];
    this.anchorNarrow = d.anchorNarrow ? [num(d.anchorNarrow, 0, 0.5), num(d.anchorNarrow, 1, 0.5)] : this.anchor;
    this.narrowBp = parseFloat(d.narrow || "720");
    this.inputs = (d.inputs || "pointer").split(/\s+/);
    this.pointerScope = d.pointer || "self";
    this.moon = d.moon ? d.moon.split(",").map(Number) : null;
    this.plate = d.moonPlate ? MB.$(d.moonPlate) : null;
    this.clear = d.fireClear ? MB.$(d.fireClear) : null;
    this.liveFire = d.fire === "live";
    this.fireMargin = parseFloat(d.fireMargin || "40");
    this.moonMargin = parseFloat(d.moonMargin || "8");
    this.target = { x: 0, y: 0 }; this.cam = { x: 0, y: 0 }; this.light = { x: 0, y: 0 };
    this.scroll = 0; this.unit = 1; this.visible = false; this.geo = null;
    this.layout();
    this.bind();
    var self = this;
    MB.onLayout(function () { self.layout(); });
    MB.loop.add(function (now, dt) { return self.frame(now, dt); });
  }

  Room.prototype.narrow = function () { return innerWidth < this.narrowBp; };

  /* camera geometry for a given anchor (ax, ay in 0..1), or for an explicit camera left edge */
  Room.prototype.geometry = function (ax, ay, leftAt, zoom) {
    var w = this.view.clientWidth, h = this.view.clientHeight, aspect = CAM_W / CAM_H, cw, ch, z = zoom || 1;
    if (!w || !h) return null;
    if (w / h > aspect) { cw = w * z; ch = cw / aspect; } else { ch = h * z; cw = ch * aspect; }
    var left = leftAt != null ? leftAt : (w - cw) * ax, top = (h - ch) * ay;
    var sx = cw / CAM_W, sy = ch / CAM_H;
    /* a camera point on a plane: plane scaled 1.08 about its centre, then offset by the camera */
    var X = function (cx) { return left + cw / 2 + (cx * sx - cw / 2) * OVER; };
    var Y = function (cy) { return top + ch / 2 + (cy * sy - ch / 2) * OVER; };
    var travel = 3.0 * (cw / APP_W) * this.kScale; /* far-plane maximum at full tilt */
    return { w: w, h: h, cw: cw, ch: ch, left: left, top: top, X: X, Y: Y, travel: travel, ax: ax, ay: ay, zoom: z };
  };

  Room.prototype.layout = function () {
    if (!this.view) return;
    var a = this.narrow() ? this.anchorNarrow : this.anchor;
    var g = this.geometry(a[0], a[1]);
    if (!g) return;
    var res = this.frameRules(g);
    g = res.g;
    this.moonMode = res.moon;
    this.geo = g;
    var c = this.camera.style;
    c.width = g.cw + "px"; c.height = g.ch + "px"; c.left = g.left + "px"; c.top = g.top + "px";
    this.unit = (g.cw / APP_W) * this.kScale;
    if (this.plate) {
      var shift = 0;
      if (res.plateLeft != null) shift = Math.max(0, res.plateLeft - this.wrapLeft());
      this.el.style.setProperty("--plate-shift", shift.toFixed(1) + "px");
      this.plateShift = shift;
    }
    if (this.clear) this.placeClear(g);
    this.measure();
    this.render(true);
  };

  Room.prototype.wrapLeft = function () {
    var wrap = this.plate && this.plate.parentElement;
    if (!wrap) return 0;
    var r = wrap.getBoundingClientRect(), s = this.el.getBoundingClientRect();
    return r.left - s.left + (parseFloat(getComputedStyle(wrap).paddingLeft) || 0);
  };
  /* the plate counts only where it floats over the room (it stacks under the stage on narrower screens) */
  Room.prototype.plateFloats = function () {
    return !!this.plate && !this.narrow() && getComputedStyle(this.plate.parentElement).position === "absolute";
  };

  /* FRAME RULES, decided together on every layout. The camera slides sideways from its anchor:
     1. FIRE: the fireplace opening, with every flame, stays at least data-fire-margin (40 px; 12 in the small hall
        door) inside the right edge, with the far plane at either pointer extreme. Where a frame is too close to the
        art's own shape for that, the margin may shrink to 12 px (8 in the door), never less.
     2. MOON: the crescent is either whole, at least data-moon-margin (8 px; 12 in the door) inside the frame with
        the floating plate 24 px clear of it, or wholly off the left edge. Never a sliver.
     The camera may slide past its cover-fit range by the far plane's 1.08 overscan, less that plane's travel: the
     other planes are transparent at the frame's edges, so no plane edge can ever show. Where no slide satisfies
     both rules, the camera zooms in a few percent (up to 16%) for the room it needs. */
  var FIRE_OPEN_R = 1560, ZOOMS = [1, 1.04, 1.08, 1.12, 1.16];
  Room.prototype.frameRules = function (g0) {
    var self = this, m = this.moon, floats = m && this.plateFloats(), wrapLeft = floats ? this.wrapLeft() : 0;
    var hardMargin = Math.min(this.fireMargin, this.fireMargin > 20 ? 12 : 8);
    function plan(z, fireMargin) {
      var g = z === 1 ? g0 : self.geometry(g0.ax, g0.ay, null, z), w = g.w, cw = g.cw, sx = cw / CAM_W, tr = g.travel;
      var K = function (cx) { return cw / 2 + (cx * sx - cw / 2) * OVER; }; /* X(cx) = left + K(cx) */
      var extra = Math.max(0, (OVER - 1) / 2 * cw - tr - 1);
      var lo = (w - cw) - extra, hi = extra, want = g.left;
      var cap = self.liveFire ? Math.min(hi, w - fireMargin - tr - K(FIRE_OPEN_R)) : hi;
      if (cap < lo) return null;
      var at = function (left) { return self.geometry(g0.ax, g0.ay, left, z); };
      if (!m) return { g: at(MB.clamp(want, lo, cap)), plateLeft: null, moon: null };
      var offMax = Math.min(cap, -tr - K(m[2]) - 0.5);          /* left at or below: the crescent is wholly off the left edge */
      var inMin = Math.max(lo, self.moonMargin + tr - K(m[0]) + 0.5); /* left at or above: wholly inside, with the margin */
      var best = null;
      if (offMax >= lo) { var lOff = MB.clamp(want, lo, offMax); best = { left: lOff, d: Math.abs(lOff - want), moon: "off" }; }
      if (inMin <= cap) { var lIn = MB.clamp(want, inMin, cap), dIn = Math.abs(lIn - want); if (!best || dIn < best.d) best = { left: lIn, d: dIn, moon: "visible" }; }
      if (!best) return null;
      var G = at(best.left);
      return { g: G, moon: best.moon, plateLeft: floats ? (best.moon === "visible" ? Math.max(wrapLeft, G.X(m[2]) + tr + 24) : wrapLeft) : null };
    }
    var i, r;
    for (i = 0; i < ZOOMS.length; i++) if ((r = plan(ZOOMS[i], this.fireMargin))) return r;
    for (i = 0; i < ZOOMS.length; i++) if ((r = plan(ZOOMS[i], hardMargin))) return r;
    return { g: g0, plateLeft: floats ? wrapLeft : null, moon: "unsolved" };
  };
  Room.prototype.moonBox = function (g) {
    var m = this.moon;
    return { l: g.X(m[0]) - g.travel, r: g.X(m[2]) + g.travel, t: g.Y(m[1]), b: g.Y(m[3]) };
  };
  Room.prototype.moonState = function () {
    if (!this.moon || !this.geo) return null;
    var b = this.moonBox(this.geo);
    return { box: b, mode: this.moonMode, plateShift: this.plateShift || 0, view: { w: this.geo.w, h: this.geo.h } };
  };

  /* the fire box on screen, in stage coordinates, at rest */
  Room.prototype.fireRect = function (g) {
    g = g || this.geo; if (!g) return null;
    var l = g.X(FIRE.x), t = g.Y(FIRE.y), r = g.X(FIRE.x + FIRE.w), b = g.Y(FIRE.y + FIRE.h);
    return { left: l, top: t, right: r, bottom: b, travel: g.travel };
  };
  /* keep an element (the quest card) between the plate and the fire, 40 px clear of the fire box */
  Room.prototype.placeClear = function (g) {
    var el = this.clear;
    if (this.narrow()) { this.el.style.removeProperty("--clear-x"); return; }
    var f = this.fireRect(g), qw = el.offsetWidth || 340;
    var s = this.el.getBoundingClientRect();
    var minX = 0;
    if (this.plate) { var p = this.plate.getBoundingClientRect(); minX = p.right - s.left + 32; }
    var maxX = f.left - f.travel - 40 - qw;
    var x = maxX >= minX ? minX + (maxX - minX) * 0.55 : Math.max(maxX, minX - 16);
    x = Math.min(x, g.w - qw - 16);
    this.el.style.setProperty("--clear-x", Math.round(x) + "px");
    this.clearGap = f.left - f.travel - (x + qw);
  };

  /* how much of the hearth is inside the viewport, 0..1 */
  Room.prototype.hearthVisible = function () {
    var f = this.fireRect(); if (!f) return 0;
    var s = this.el.getBoundingClientRect();
    var top = s.top + f.top, bottom = s.top + f.bottom, left = s.left + f.left, right = s.left + f.right;
    var vh = Math.max(0, Math.min(bottom, innerHeight) - Math.max(top, 0)) / (bottom - top);
    var vw = Math.max(0, Math.min(right, innerWidth) - Math.max(left, 0)) / (right - left);
    return vh * vw;
  };

  Room.prototype.bind = function () {
    var self = this, el = this.el;
    var still = function () { return MB.reduced(); };
    if (this.inputs.indexOf("pointer") >= 0) {
      if (this.pointerScope === "self") {
        el.addEventListener("pointermove", function (e) {
          if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
          var r = MB.rect(self.view);
          self.target.x = MB.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
          self.target.y = MB.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
        }, { passive: true });
        el.addEventListener("pointerleave", function () { self.target.x = 0; self.target.y = 0; MB.loop.poke(); });
      } else this.windowPointer = true;
    }
    /* phones: tilt, only after a tap (iOS asks for permission). The control is a pill over the room itself; it
       leaves once tilt is on, and if motion access is declined a short note in the caption says why the room is still */
    var tiltBtn = el.getAttribute("data-tilt-button") ? MB.$(el.getAttribute("data-tilt-button")) : null;
    var tiltOff = el.getAttribute("data-tilt-off") ? MB.$(el.getAttribute("data-tilt-off")) : null;
    if (this.inputs.indexOf("tilt") >= 0 && tiltBtn && "DeviceOrientationEvent" in window &&
        matchMedia("(hover: none) and (pointer: coarse)").matches && !still()) {
      tiltBtn.hidden = false;
      var rest = null;
      var onTilt = function (e) {
        if (e.gamma == null || still()) return;
        if (!rest) rest = { g: e.gamma, b: e.beta };
        self.target.x = MB.clamp((e.gamma - rest.g) / 18, -1, 1);
        self.target.y = MB.clamp((e.beta - rest.b) / 18, -1, 1);
        MB.loop.poke();
      };
      var go = function () { addEventListener("deviceorientation", onTilt); tiltBtn.hidden = true; self.tilting = true; };
      var declined = function () { tiltBtn.hidden = true; if (tiltOff) tiltOff.hidden = false; };
      tiltBtn.addEventListener("click", function () {
        try {
          if (typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission().then(function (r) { if (r === "granted") go(); else declined(); }).catch(declined);
          } else go();
        } catch (e) { declined(); }
      });
    }
    /* visibility: pause the fire offscreen, arrive once at 35%. Browsers report the ratio as a float32, so a scroll
       frame that lands exactly on the line reads 0.34999999: the check allows for that, and frame() re-checks the
       visible fraction on every frame, so a single crossing frame can never leave the room unlit. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          self.visible = e.isIntersecting && e.intersectionRatio > 0.01;
          self.el.classList.toggle("is-paused", !self.visible || document.hidden);
          if (e.isIntersecting && e.intersectionRatio >= ARRIVE_AT - 1e-3) self.arrive();
          if (self.visible) MB.loop.poke();
        });
      }, { threshold: [0, 0.011, ARRIVE_AT] }).observe(el);
    } else { this.visible = true; this.arrive(); }
    document.addEventListener("visibilitychange", function () { self.el.classList.toggle("is-paused", !self.visible || document.hidden); });
  };

  /* arrival: dolly settle, then hearth ignition, then the crossfade (each once). Through a hall door the hearth
     lights while the opening is still growing, so the fire is catching as you land (door: true). */
  Room.prototype.arrive = function (opts) {
    if (this.arrived) return;
    this.arrived = true;
    var el = this.el, live = this.liveFire;
    /* the crossfade starts once every frame has decoded, so a slow network never shows a blank frame */
    var decoded = function () {
      return Promise.all(MB.$$(".depth-fire img", el).map(function (img) {
        return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      }));
    };
    if (!el.hasAttribute("data-arrive")) {
      el.classList.add("is-lit");
      if (live && !MB.reduced()) decoded().then(function () { el.classList.add("is-burning"); });
      return;
    }
    if (MB.reduced()) { el.classList.add("is-arrived", "is-lit"); return; }
    MB.$$("img[data-src-on='arrive']", el).forEach(MB.loadImg);
    el.classList.add("is-arrived");
    var door = opts && opts.door;
    setTimeout(function () { el.classList.add("is-lit"); }, door ? 280 : 900);
    var frames = decoded();
    setTimeout(function () { if (live) frames.then(function () { el.classList.add("is-burning"); }); }, door ? 1180 : 1800);
  };

  /* completion flare: glow .35 -> .8 -> .35 and the fire box 1 -> 1.06 -> 1 over 900 ms */
  Room.prototype.flare = function () {
    if (MB.reduced() || !this.flareEl || !this.flareEl.animate) return;
    this.flareEl.animate([{ opacity: 0.35 }, { opacity: 0.8 }, { opacity: 0.35 }], { duration: 900, easing: "cubic-bezier(.2,.7,.1,1)" });
    if (this.fireFlare) this.fireFlare.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 900, easing: "cubic-bezier(.2,.7,.1,1)" });
  };

  Room.prototype.measure = function () {
    var r = MB.rect(this.el);
    this.rectTop = r.top;
    this.visibleShare = r.height ? Math.max(0, Math.min(r.bottom, MB.vh) - Math.max(r.top, 0)) / r.height : 0;
    /* the app: 0..240 px of scroll maps to 0..1 of counter-motion */
    this.scroll = this.inputs.indexOf("scroll") >= 0 ? MB.clamp(-r.top / 240, 0, 1) : 0;
  };

  Room.prototype.frame = function (now, dt) {
    if (!this.visible || document.hidden || MB.reduced()) return false;
    if (this.windowPointer) {
      var p = MB.pointer;
      if (p.active && MB.fine()) {
        var r = MB.rect(this.el);
        this.target.x = MB.clamp((p.x - (r.left + r.width / 2)) / (MB.vw * 0.5), -1, 1);
        this.target.y = MB.clamp((p.y - (r.top + r.height * 0.45)) / (MB.vh * 0.5), -1, 1);
      } else { this.target.x = 0; this.target.y = 0; }
    }
    this.measure();
    if (!this.arrived && this.visibleShare >= ARRIVE_AT - 1e-3) this.arrive();
    var kc = MB.smooth(0.075, dt), kl = MB.smooth(0.2, dt);
    this.cam.x += (this.target.x - this.cam.x) * kc; this.cam.y += (this.target.y - this.cam.y) * kc;
    this.light.x += (this.target.x - this.light.x) * kl; this.light.y += (this.target.y - this.light.y) * kl;
    this.render(false);
    var gap = Math.max(Math.abs(this.target.x - this.cam.x), Math.abs(this.target.y - this.cam.y)) * 24 * this.unit;
    return gap > 0.05;
  };

  Room.prototype.render = function (force) {
    if (MB.reduced()) {
      if (force) this.planes.forEach(function (p) { p.el.style.transform = ""; p.last = ""; });
      return;
    }
    var u = this.unit, cx = this.cam.x, cy = this.cam.y, sc = this.scroll;
    for (var i = 0; i < this.planes.length; i++) {
      var p = this.planes[i];
      var x = -cx * p.kx * u, y = (-cy * p.ky - sc * p.ks) * u;
      var t = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(1.08)";
      if (t !== p.last || force) { p.el.style.transform = t; p.last = t; }
    }
    if (this.roomLight) {
      this.roomLight.style.setProperty("--lx", (50 + this.light.x * 30).toFixed(1) + "%");
      this.roomLight.style.setProperty("--ly", (42 + this.light.y * 25).toFixed(1) + "%");
    }
  };

  /* Retina: the wall, furniture and foreground planes load at the compression the first paint can afford.
     Where a room's camera is drawn wider than the plane's own pixels (a 2x screen at 700 px and wider, so the
     homepage stage and the case-page arrival, never the small hall door or a phone), each plane's data-src-2x
     (the app's own lossless plane at WebP q90, the same 1635 x 962 pixels) replaces it once the room is within
     a viewport of the screen, each swapped only after it has decoded. */
  var hiDone = {};
  function sharpenRoom(room) {
    MB.$$(".plane > img[data-src-2x]", room.el).forEach(function (img) {
      var hi = img.getAttribute("data-src-2x");
      if (!hi || img.getAttribute("src") === hi) return;
      var p = hiDone[hi] || (hiDone[hi] = new Promise(function (ok, no) {
        var pre = new Image(); pre.decoding = "async"; pre.onload = function () { (pre.decode ? pre.decode() : Promise.resolve()).then(ok, ok); }; pre.onerror = no; pre.src = hi;
      }));
      p.then(function () { img.src = hi; }, function () { /* keep the first-load plane */ });
    });
  }
  function sharpen() {
    var dpr = window.devicePixelRatio || 1;
    if (dpr < 2 || !matchMedia("(min-width: 700px)").matches || !("IntersectionObserver" in window)) return;
    instances.forEach(function (room) {
      if (!room.geo || room.geo.cw * OVER * dpr < CAM_W * 1.25) return;
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect(); sharpenRoom(room);
      }, { rootMargin: "100% 0px" });
      io.observe(room.el);
    });
  }
  var later = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(sharpen); };
  if (document.readyState === "complete") later(); else addEventListener("load", later);

  MB.DepthRoom = {
    all: instances,
    get: function (el) { if (typeof el === "string") el = MB.$(el); for (var i = 0; i < instances.length; i++) if (instances[i].el === el) return instances[i]; return null; },
    init: function (el) { var r = new Room(el); instances.push(r); el.classList.add("is-live"); return r; }
  };
  MB.$$("[data-depth-room]").forEach(MB.DepthRoom.init);
})();
