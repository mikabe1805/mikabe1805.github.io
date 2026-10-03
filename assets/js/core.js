/* Mika Be portfolio: core. Shared by the homepage and the case pages.
   One rAF scheduler, cached rects, world-light layers, the nav room chip, reveals, glass rim light,
   the zoom dialog, the audio manager (one clip at a time, loads on intent), the sound preference
   and the copy-address button. API reference: build/SYSTEM.md. */
(function () {
  "use strict";
  var MB = (window.MB = window.MB || {});
  var doc = document, root = doc.documentElement;
  root.classList.add("js");

  /* ---------------------------------------------------------------- helpers */
  MB.$ = function (s, r) { return (r || doc).querySelector(s); };
  MB.$$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  MB.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  MB.lerp = function (a, b, t) { return a + (b - a) * t; };
  /* framerate-normalised smoothing: base is the per-16.7 ms factor */
  MB.smooth = function (base, dt) { return 1 - Math.pow(1 - base, dt / 16.7); };
  var mqReduced = matchMedia("(prefers-reduced-motion: reduce)");
  var mqFine = matchMedia("(pointer: fine)");
  MB.reduced = function () { return mqReduced.matches; };
  MB.fine = function () { return mqFine.matches; };
  MB.base = (doc.body && doc.body.getAttribute("data-base")) || "";
  MB.fmtTime = function (s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  MB.store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: preference lasts this visit */ } }
  };

  /* ---------------------------------------------------------------- content flags (data.js) */
  var flags = MB.FLAGS || {};
  Object.keys(flags).forEach(function (k) {
    if (flags[k] === false) MB.$$('[data-flag="' + k + '"]').forEach(function (el) { el.remove(); });
    else MB.$$('[data-flag-off="' + k + '"]').forEach(function (el) { el.remove(); });
  });

  /* ---------------------------------------------------------------- scheduler
     One rAF loop. It runs while a pointer moved in the last 1.5 s, a scroll is pending,
     or a subscriber reports it is unsettled. Otherwise it stops completely. */
  var subs = [], running = false, lastInput = -1e9, lastT = 0;
  MB.loop = {
    frames: 0,
    add: function (fn) { subs.push(fn); wake(); },
    remove: function (fn) { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); },
    wake: wake,
    poke: function () { lastInput = performance.now(); wake(); },
    get running() { return running; }
  };
  function wake() {
    if (running || doc.hidden) return;
    running = true; lastT = performance.now();
    requestAnimationFrame(frame);
  }
  function frame(now) {
    var dt = Math.min(64, Math.max(1, now - lastT)); lastT = now;
    MB.loop.frames++;
    var busy = now - lastInput < 1500;
    for (var i = 0; i < subs.length; i++) { if (subs[i](now, dt)) busy = true; }
    if (busy && !doc.hidden) requestAnimationFrame(frame); else running = false;
  }
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden) MB.loop.poke(); });

  /* ---------------------------------------------------------------- pointer and scroll */
  MB.pointer = { x: innerWidth * 0.3, y: -innerHeight * 0.25, active: false };
  addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    MB.pointer.x = e.clientX; MB.pointer.y = e.clientY; MB.pointer.active = true;
    MB.loop.poke();
  }, { passive: true });
  doc.addEventListener("pointerleave", function () { MB.pointer.active = false; MB.loop.poke(); });
  addEventListener("blur", function () { MB.pointer.active = false; });
  /* scroll and viewport values are cached by their own events, so no frame reads them from the window
     after another subscriber has written styles (each such read forces a style recalculation) */
  MB.scrollY = scrollY; MB.scrollX = scrollX; MB.vw = innerWidth; MB.vh = innerHeight;
  addEventListener("scroll", function () { MB.scrollY = scrollY; MB.scrollX = scrollX; MB.loop.poke(); }, { passive: true });
  addEventListener("resize", function () { MB.vw = innerWidth; MB.vh = innerHeight; MB.scrollX = scrollX; MB.scrollY = scrollY; });

  /* ---------------------------------------------------------------- rect cache
     Document-relative rects, measured once and invalidated by resize, ResizeObserver and font
     loading. Reading a rect during a frame costs no layout. Fixed elements cache viewport rects. */
  var rects = new Map(), rectGen = 0;
  MB.rect = function (el) {
    var c = rects.get(el);
    if (!c || c.gen !== rectGen) {
      var r = el.getBoundingClientRect();
      var fixed = el.hasAttribute("data-fixed");
      MB.scrollX = scrollX; MB.scrollY = scrollY;
      c = { gen: rectGen, x: r.left + (fixed ? 0 : MB.scrollX), y: r.top + (fixed ? 0 : MB.scrollY), w: r.width, h: r.height, fixed: fixed };
      rects.set(el, c);
    }
    var ox = c.fixed ? 0 : MB.scrollX, oy = c.fixed ? 0 : MB.scrollY;
    return { left: c.x - ox, top: c.y - oy, width: c.w, height: c.h, right: c.x - ox + c.w, bottom: c.y - oy + c.h };
  };
  var relayout = [];
  MB.onLayout = function (fn) { relayout.push(fn); };
  var layoutQueued = false;
  function invalidate() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(function () {
      layoutQueued = false; rectGen++;
      relayout.forEach(function (fn) { fn(); });
      MB.loop.poke();
    });
  }
  MB.invalidate = invalidate;
  addEventListener("resize", invalidate);
  if ("ResizeObserver" in window) new ResizeObserver(invalidate).observe(doc.body);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(invalidate);
  addEventListener("load", invalidate);

  /* ---------------------------------------------------------------- world light and the nav room chip */
  var lightLayers = MB.$$(".world-light [data-light]");
  var LIGHT_FOR = { hall: "hall", rod: "rod", kuiper: "kuiper", notes: "notes", knowsy: "knowsy", about: "shell", contact: "shell", shell: "shell" };
  var nav = MB.$(".nav");
  var chip = MB.$(".nav-room"), chipText = chip && MB.$("span", chip);
  var current = "";
  MB.setWorld = function (world, name) {
    if (world === current) return;
    current = world;
    var layer = LIGHT_FOR[world] || "shell";
    lightLayers.forEach(function (l) { l.classList.toggle("on", l.getAttribute("data-light") === layer); });
    /* the pill's material follows the room under it (the scrim loop below); with no rooms, the page's world */
    if (nav && !worldSections.length) nav.setAttribute("data-world", world);
    if (chip) chip.setAttribute("data-world", world);
    if (chip && chipText) {
      chipText.textContent = name || "";
      chip.classList.toggle("empty", !name);
    }
  };
  var worldSections = MB.$$("main section[data-world]");
  if (worldSections.length && "IntersectionObserver" in window) {
    var worldIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) MB.setWorld(e.target.getAttribute("data-world"), e.target.getAttribute("data-room") || "");
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    worldSections.forEach(function (s) { worldIO.observe(s); });
  }
  var startWorld = doc.body.getAttribute("data-world") || (worldSections[0] && worldSections[0].getAttribute("data-world")) || "hall";
  MB.setWorld(startWorld, doc.body.getAttribute("data-room") || "");

  /* nav scrim: a band behind the pill in the colour of whatever room lies under it, so no text ever reads
     above or around the pill. It follows the section under the nav, not the one at the viewport centre. */
  var navWrap = nav && nav.parentElement;
  if (navWrap) navWrap.setAttribute("data-scrim", startWorld);
  /* while a door's transition runs the pill keeps its look (MB.holdNav), so its text never crossfades between the
     dark and the paper styles; it takes the new room's look once the room has landed */
  var navHeld = false, scrimNow = startWorld;
  MB.holdNav = function (on) {
    navHeld = !!on;
    if (!navHeld && nav && nav.getAttribute("data-world") !== scrimNow) nav.setAttribute("data-world", scrimNow);
  };
  if (navWrap && worldSections.length) {
    var scrimDirty = true;
    addEventListener("scroll", function () { scrimDirty = true; }, { passive: true });
    MB.onLayout(function () { scrimDirty = true; });
    MB.loop.add(function () {
      if (!scrimDirty) return false;
      scrimDirty = false;
      var y = 40, w = "shell";
      for (var i = 0; i < worldSections.length; i++) {
        var r = MB.rect(worldSections[i]);
        if (r.top <= y && r.bottom > y) { w = worldSections[i].getAttribute("data-world"); break; }
      }
      if (w !== scrimNow) { scrimNow = w; navWrap.setAttribute("data-scrim", w); if (!navHeld) nav.setAttribute("data-world", w); }
      return false;
    });
  }

  /* ---------------------------------------------------------------- deferred images
     img[data-src] loads when it comes within 600 px of the viewport (native lazy loading reaches much
     further, which would put below-the-fold captures into the first load). */
  MB.loadImg = function (img) { var s = img.getAttribute("data-src"); if (s) { img.src = s; img.removeAttribute("data-src"); } };
  if ("IntersectionObserver" in window) {
    var imgIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { MB.loadImg(e.target); imgIO.unobserve(e.target); } });
    }, { rootMargin: "600px 0px" });
    MB.$$("img[data-src]:not([data-src-on])").forEach(function (img) { imgIO.observe(img); });
  } else MB.$$("img[data-src]").forEach(MB.loadImg);

  /* ---------------------------------------------------------------- deferred components
     [data-load-js="a.js b.js"] (+ data-load-css) loads its stylesheet, then its scripts in order, when the element
     starts to enter the viewport: the homepage's Quest board keeps its script, styles and fonts out of the first
     load, and fades in over the room once its faces are ready. Paths resolve through MB.base, so the pages still open from file://. */
  function loadComponent(el) {
    if (el._loading) return; el._loading = true;
    var js = (el.getAttribute("data-load-js") || "").split(/\s+/).filter(Boolean), css = el.getAttribute("data-load-css");
    function scripts() { js.forEach(function (src) { var sc = doc.createElement("script"); sc.src = MB.base + src; sc.async = false; doc.body.appendChild(sc); }); }
    if (!css) { scripts(); return; }
    var l = doc.createElement("link"); l.rel = "stylesheet"; l.href = MB.base + css;
    l.onload = l.onerror = scripts;
    doc.head.appendChild(l);
  }
  MB.loadComponent = loadComponent;
  if ("IntersectionObserver" in window) {
    var compIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { compIO.unobserve(e.target); loadComponent(e.target); } });
    }, { rootMargin: "0px" });
    MB.$$("[data-load-js]").forEach(function (el) { compIO.observe(el); });
  } else MB.$$("[data-load-js]").forEach(loadComponent);

  /* ---------------------------------------------------------------- reveal, once */
  if ("IntersectionObserver" in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    MB.$$("[data-reveal]").forEach(function (el) { revealIO.observe(el); });
    /* keyboard focus (or find-in-page) inside a block that has not revealed yet shows it at once */
    doc.addEventListener("focusin", function (e) {
      var r = e.target && e.target.closest && e.target.closest("[data-reveal]:not(.in)");
      if (r) { r.classList.add("in"); revealIO.unobserve(r); }
    });
  } else MB.$$("[data-reveal]").forEach(function (el) { el.classList.add("in"); });

  /* ---------------------------------------------------------------- room lamps: each room's light comes on once as you enter */
  var lamps = MB.$$(".room[data-lamp]");
  if (MB.reduced() || !("IntersectionObserver" in window)) lamps.forEach(function (r) { r.classList.add("is-lit"); });
  else {
    var lampIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-lit"); lampIO.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -35% 0px" });
    lamps.forEach(function (r) { lampIO.observe(r); });
  }

  /* ---------------------------------------------------------------- glass rim light
     The hot spot sits where a light would hit the rim: the pointer when there is one, otherwise a
     virtual light above the viewport that slides with scroll. It never animates on a timer. */
  var glass = new Set();
  if ("IntersectionObserver" in window) {
    var glassIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) glass.add(e.target); else glass.delete(e.target); });
      MB.loop.wake();
    }, { rootMargin: "80px" });
    MB.$$(".glass").forEach(function (g) { glassIO.observe(g); });
  }
  function tri(v) { v = v - Math.floor(v); return v < 0.5 ? v * 2 : 2 - v * 2; }
  var glassDirty = true;
  MB.onLayout(function () { glassDirty = true; });
  addEventListener("scroll", function () { glassDirty = true; }, { passive: true });
  addEventListener("pointermove", function () { glassDirty = true; }, { passive: true });
  MB.loop.add(function () {
    if (!glassDirty) return false;
    glassDirty = false;
    var p = MB.pointer, useP = p.active && MB.fine();
    var lx = useP ? p.x : MB.vw * (0.2 + 0.6 * tri(MB.scrollY / 2400));
    var ly = useP ? p.y : -MB.vh * 0.22;
    glass.forEach(function (g) {
      var r = MB.rect(g);
      if (!r.width) return;
      var gx = MB.clamp(((lx - r.left) / r.width) * 100, -25, 125);
      var gy = MB.clamp(((ly - r.top) / r.height) * 100, -40, 140);
      var key = gx.toFixed(0) + "," + gy.toFixed(0);
      if (g._gk === key) return;
      g._gk = key;
      g.style.setProperty("--gx", gx.toFixed(1) + "%");
      g.style.setProperty("--gy", gy.toFixed(1) + "%");
    });
    return false;
  });

  /* ---------------------------------------------------------------- doors: peek light and arrival focus */
  var peekLayers = MB.$$(".world-light .peek");
  function peek(door, on) {
    var name = door.getAttribute("data-peek");
    peekLayers.forEach(function (l) {
      var hit = on && l.getAttribute("data-peek") === name;
      if (hit) {
        var r = door.getBoundingClientRect();
        l.style.setProperty("--peek-x", (r.left + r.width / 2).toFixed(0) + "px");
        l.style.setProperty("--peek-y", (r.bottom - r.height * 0.15).toFixed(0) + "px");
      }
      l.classList.toggle("on", hit);
    });
  }
  MB.$$("a[data-peek], button[data-peek]").forEach(function (door) {
    door.addEventListener("pointerenter", function () { peek(door, true); });
    door.addEventListener("pointerleave", function () { peek(door, false); });
    door.addEventListener("focus", function () { if (door.matches(":focus-visible")) peek(door, true); });
    door.addEventListener("blur", function () { peek(door, false); });
  });
  /* door light on the hall floor: each door's spill brightens as a fine pointer comes near it.
     Only --near-js changes; CSS takes the larger of it and the hover or focus force (--force) and turns that
     into an opacity, eased by a transition. */
  var doorList = MB.$$(".door");
  if (doorList.length) {
    var nearDirty = true;
    addEventListener("pointermove", function () { nearDirty = true; }, { passive: true });
    addEventListener("scroll", function () { nearDirty = true; }, { passive: true });
    doc.addEventListener("pointerleave", function () { nearDirty = true; });
    MB.onLayout(function () { nearDirty = true; });
    MB.loop.add(function () {
      if (!nearDirty) return false;
      nearDirty = false;
      var p = MB.pointer, live = p.active && MB.fine();
      doorList.forEach(function (d) {
        var w = d._win || (d._win = MB.$(".door-window", d) || d);
        var n = 0;
        if (live) {
          var r = MB.rect(w);
          if (r.bottom > -200 && r.top < MB.vh + 200) {
            var dx = Math.max(r.left - p.x, 0, p.x - r.right), dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
            n = MB.clamp(1 - Math.sqrt(dx * dx + dy * dy) / 220, 0, 1);
            n = n * n * (3 - 2 * n);
          }
        }
        var v = n.toFixed(2);
        if (d._near !== v) { d._near = v; d.style.setProperty("--near-js", v); }
      });
      return false;
    });
  }
  /* any link marked data-arrive-focus takes you to its room and moves focus to the room's heading.
     A hall door is the way in: its opening grows into the room's lit object (data-portal: the stage, the paper
     sheet, the pad, the capture) while the hall fades, then the room arrives (the hearth lights as you land).
     View Transitions where the browser has them, a transform-only flight elsewhere, an instant jump under
     reduced motion. */
  function jumpTo(section) {
    var sb = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    section.scrollIntoView({ block: "start" });
    root.style.scrollBehavior = sb;
    MB.scrollX = scrollX; MB.scrollY = scrollY;
  }
  /* the object the door grows into, if at least half of it is on screen after the jump; else the room's frame */
  function portalTarget(sel, section) {
    var el = sel && MB.$(sel);
    if (el) {
      var r = el.getBoundingClientRect(), vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (r.height && vis / Math.min(r.height, innerHeight) >= 0.5) return el;
    }
    return MB.$(".portal-box", section) || el;
  }
  /* the most a door's own pixels may be enlarged while they are still visible: past this the snapshot reads as a
     blurred blow-up, so a door that grows into a much larger frame fades its picture out early instead */
  var PORTAL_MAX = 1.6;
  function portalScale(a, b) { return Math.max(b.width / a.width, b.height / a.height); }
  /* a depth room arrives as the door opens: its dolly settles and its hearth lights during the flight */
  function arriveRoom(el) {
    var host = el && el.closest && el.closest("[data-depth-room]"), room = host && MB.DepthRoom && MB.DepthRoom.get(host);
    if (room) room.arrive({ door: true });
  }
  /* the layers that float over the object (the stage's plate, Quest and caption) wait out the flight, then settle
     onto the room (they are glass, so they are not captured into the transition, where their blur would misdraw) */
  function layers(section, phase) {
    section.classList.toggle("portal-landing", phase === "landing");
    if (phase === "landed") {
      section.classList.add("portal-landed");
      setTimeout(function () { section.classList.remove("portal-landed"); }, 700);
    }
  }
  MB.portal = function (door, section, done) {
    var from = MB.$(".door-window", door), sel = door.getAttribute("data-portal");
    if (MB.reduced() || !from || !sel) { jumpTo(section); done(); return; }
    arriveRoom(MB.$(sel));
    if (typeof doc.startViewTransition === "function") {
      var fromBox = from.getBoundingClientRect();
      from.style.viewTransitionName = "mb-portal";
      if (nav) nav.style.viewTransitionName = "mb-nav"; /* the nav stays put above everything, in its old look */
      MB.holdNav(true);
      root.classList.add("is-portal");
      var to = null;
      var vt;
      try {
        vt = doc.startViewTransition(function () {
          from.style.viewTransitionName = "";
          jumpTo(section);
          to = portalTarget(sel, section);
          if (to) {
            to.style.viewTransitionName = "mb-portal";
            /* growing to more than 1.8x the door: the door's picture hands over to the room's own snapshot early
               (home.css), so no enlarged copy of it is drawn opaque */
            root.classList.toggle("portal-wide", portalScale(fromBox, to.getBoundingClientRect()) > PORTAL_MAX + 0.2);
          }
          layers(section, "landing");
        });
      } catch (err) { vt = null; }
      if (vt) {
        var end = function () {
          if (to) to.style.viewTransitionName = ""; if (nav) nav.style.viewTransitionName = "";
          MB.holdNav(false); layers(section, "landed"); root.classList.remove("is-portal", "portal-wide");
        };
        vt.updateCallbackDone.then(done, done);
        vt.finished.then(end, end);
        return;
      }
      from.style.viewTransitionName = ""; if (nav) nav.style.viewTransitionName = ""; MB.holdNav(false); root.classList.remove("is-portal");
    }
    /* transform-only flight: a copy of the opening flies to the object while a veil hides the jump */
    var a = from.getBoundingClientRect();
    var veil = doc.createElement("div"); veil.className = "portal-veil";
    var fly = doc.createElement("div"); fly.className = "portal-fly";
    /* the copy keeps its world's look (the paper door's daylight, the bench's light): those rules key off the door's modifier class */
    Array.prototype.forEach.call(door.classList, function (c) { if (/^door--/.test(c)) fly.classList.add(c); });
    fly.style.cssText = "left:" + a.left + "px;top:" + a.top + "px;width:" + a.width + "px;height:" + a.height + "px";
    fly.appendChild(from.cloneNode(true));
    doc.body.appendChild(veil); doc.body.appendChild(fly);
    var ease = "cubic-bezier(.2,.7,.1,1)";
    var v1 = veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: ease, fill: "forwards" });
    v1.onfinish = function () {
      jumpTo(section); done();
      /* the jump's first paint can be a long frame: the flight starts after it, so none of the flight is lost to it */
      requestAnimationFrame(function () { requestAnimationFrame(fly2); });
    };
    var fly2 = function () {
      var to = portalTarget(sel, section), b = to ? to.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
      var s = portalScale(a, b), wide = s > PORTAL_MAX + 0.2;
      var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      var t = "translate(" + dx + "px," + dy + "px) scale(" + (wide ? PORTAL_MAX : s) + ")";
      /* the copy is gone by 60% of the flight (by 30%, never past 1.6x, when the frame is much larger than the door) */
      var f = fly.animate(wide
        ? [{ transform: "none", opacity: 1 }, { transform: t, opacity: 0, offset: 0.3 }, { transform: t, opacity: 0 }]
        : [{ transform: "none", opacity: 1 }, { opacity: 1, offset: 0.35 }, { transform: t, opacity: 0, offset: 0.6 }, { transform: t, opacity: 0 }],
        { duration: 760, easing: ease, fill: "forwards" });
      f.onfinish = function () { fly.remove(); };
      var v2 = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 300, easing: ease, fill: "forwards" });
      v2.onfinish = function () { veil.remove(); fly.remove(); };
    };
  };
  /* Each such link adds a history entry, as a plain anchor does, so Back (or a swipe back) returns to where the
     visitor was. The entry is pushed before the page moves, so the browser keeps the hall's own scroll position
     for it; on the way back, focus returns to the link that was followed. Forward restores the room's position
     without replaying the door. */
  var arrivedFrom = null;
  MB.$$("a[data-arrive-focus]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
      var id = (a.getAttribute("href") || "").split("#")[1];
      var target = id && doc.getElementById(id);
      if (!target) return;
      e.preventDefault();
      peekLayers.forEach(function (l) { l.classList.remove("on"); });
      if (history.pushState && location.hash !== "#" + id) { history.pushState({ mbFrom: true }, "", "#" + id); arrivedFrom = a; }
      var land = function () {
        var h = MB.$("[data-room-heading]", target) || MB.$("h2", target);
        if (h) { if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      };
      if (a.classList.contains("door")) { MB.portal(a, target, land); return; }
      target.scrollIntoView({ behavior: MB.reduced() ? "auto" : "smooth", block: "start" });
      land();
    });
  });
  addEventListener("popstate", function () {
    /* the browser restores the entry's scroll position itself; the page's smooth scrolling would turn that into a
       second-long glide across every room, so the restore is instant */
    root.style.scrollBehavior = "auto";
    setTimeout(function () { root.style.scrollBehavior = ""; }, 120);
    if (!arrivedFrom) return;
    var back = arrivedFrom, id = (back.getAttribute("href") || "").split("#")[1];
    if (location.hash === "#" + id) return; /* forward again: the browser restores the room's own position */
    arrivedFrom = null;
    back.focus({ preventScroll: true });
  });

  /* ---------------------------------------------------------------- swipe rows: reachable by keyboard while they scroll
     A row marked data-swipe-label becomes a focusable, named scroller only at widths where it overflows. */
  var swipes = MB.$$("[data-swipe-label]");
  function swipeState() {
    swipes.forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 2;
      if (scrolls) {
        el.tabIndex = 0; el.setAttribute("aria-label", el.getAttribute("data-swipe-label"));
        if (el.hasAttribute("data-swipe-role")) el.setAttribute("role", el.getAttribute("data-swipe-role"));
      } else { el.removeAttribute("tabindex"); el.removeAttribute("aria-label"); el.removeAttribute("role"); }
    });
  }
  if (swipes.length) { MB.onLayout(swipeState); swipeState(); }

  /* ---------------------------------------------------------------- zoom dialog */
  var zoom = MB.$("#zoom"), zoomImg = zoom && MB.$("img", zoom), zoomCap = zoom && MB.$(".zoom-cap", zoom), zoomFrom = null;
  MB.$$("[data-zoom]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      if (!zoom || typeof zoom.showModal !== "function") { window.open(b.getAttribute("data-zoom"), "_blank", "noopener"); return; }
      e.preventDefault();
      zoomFrom = b;
      zoomImg.src = b.getAttribute("data-zoom");
      var img = MB.$("img", b);
      zoomImg.alt = b.getAttribute("data-alt") || (img && img.alt) || "";
      var fig = b.closest("figure"), cap = b.getAttribute("data-caption") || (fig && MB.$("figcaption", fig) && MB.$("figcaption", fig).textContent) || "";
      if (zoomCap) zoomCap.textContent = cap.trim();
      zoom.showModal();
      var close = MB.$(".zoom-close", zoom); if (close) close.focus();
    });
  });
  if (zoom) {
    zoom.addEventListener("click", function (e) { if (e.target === zoom) zoom.close(); });
    zoom.addEventListener("close", function () { if (zoomFrom) zoomFrom.focus(); zoomFrom = null; });
  }


  /* ---------------------------------------------------------------- tilt card (the Kuiper paper): at most 2deg toward the pointer */
  MB.$$("[data-tilt-card]").forEach(function (card) {
    var max = parseFloat(card.getAttribute("data-tilt-card")) || 2, cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, vis = false;
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(card);
    MB.loop.add(function (now, dt) {
      if (!vis || MB.reduced()) return false;
      var p = MB.pointer;
      if (p.active && MB.fine()) {
        var r = MB.rect(card);
        tgt.x = MB.clamp((p.x - (r.left + r.width / 2)) / (MB.vw * 0.5), -1, 1);
        tgt.y = MB.clamp((p.y - (r.top + r.height / 2)) / (MB.vh * 0.5), -1, 1);
      } else { tgt.x = 0; tgt.y = 0; }
      var k = MB.smooth(0.08, dt);
      cur.x += (tgt.x - cur.x) * k; cur.y += (tgt.y - cur.y) * k;
      card.style.setProperty("--tilt-x", (cur.x * max).toFixed(2) + "deg");
      card.style.setProperty("--tilt-y", (-cur.y * max).toFixed(2) + "deg");
      return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.002;
    });
  });

  /* ---------------------------------------------------------------- copy address */
  MB.$$("[data-copy]").forEach(function (b) {
    var label = MB.$("[data-copy-label]", b) || b;
    var status = b.parentNode && MB.$("[data-copy-status]", b.parentNode);
    var idle = label.textContent;
    b.addEventListener("click", function () {
      var text = b.getAttribute("data-copy");
      var done = function () {
        label.textContent = "Copied";
        if (status) status.textContent = "Address copied";
        clearTimeout(b._t);
        b._t = setTimeout(function () { label.textContent = idle; if (status) status.textContent = ""; }, 2000);
      };
      var fallback = function () {
        try {
          var ta = doc.createElement("textarea");
          ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
          doc.body.appendChild(ta); ta.select(); var ok = doc.execCommand("copy"); ta.remove();
          if (ok) done();
        } catch (e) { /* nothing to do; the address stays visible on the page */ }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  });

  /* ---------------------------------------------------------------- count-up (one rAF handle per node) */
  var counters = new Map();
  MB.countTo = function (node, to, ms, fmt) {
    fmt = fmt || function (v) { return String(Math.round(v)); };
    var from = parseFloat(node.getAttribute("data-value") || node.textContent) || 0;
    node.setAttribute("data-value", to);
    if (counters.has(node)) cancelAnimationFrame(counters.get(node));
    if (MB.reduced() || from === to) { node.textContent = fmt(to); counters.delete(node); return; }
    var t0 = performance.now(), d = ms || 320;
    var step = function (now) {
      var k = MB.clamp((now - t0) / d, 0, 1), e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (k < 1) counters.set(node, requestAnimationFrame(step)); else counters.delete(node);
    };
    counters.set(node, requestAnimationFrame(step));
  };

  /* ---------------------------------------------------------------- audio manager
     One clip plays site-wide. Clips keep preload="none" until a pointer hovers or a key focuses
     their player, so no audio is requested on load; then only the metadata loads (enough for a fast
     start), and the clip itself downloads when it plays. */
  MB.audio = {
    stopAll: function (except) {
      MB.$$("audio").forEach(function (a) { if (a !== except && !a.paused) a.pause(); });
    },
    prime: function (a) { if (a && a.preload === "none") a.preload = "metadata"; }
  };
  doc.addEventListener("play", function (e) {
    if (e.target && e.target.tagName === "AUDIO") MB.audio.stopAll(e.target);
  }, true);
  function primeWithin(e) {
    /* a finger landing on a player is usually scrolling the page: only a mouse or pen hover, or focus, counts as intent */
    if (e.pointerType === "touch") return;
    var host = e.target && e.target.closest && e.target.closest("[data-audio-intent]");
    if (host) MB.$$("audio", host).forEach(MB.audio.prime);
  }
  doc.addEventListener("pointerover", primeWithin, { passive: true });
  doc.addEventListener("focusin", primeWithin);

  /* ---------------------------------------------------------------- sound preference
     On unless the visitor turned it off. Only the quest board uses it, and every sound answers the
     visitor's own click there, so nothing ever plays on its own. */
  var sfx = {};
  var SFX = { tap: { src: "audio/world/rod-tap.wav", vol: 0.5 }, complete: { src: "audio/world/rod-completion.wav", vol: 1 } };
  MB.sound = {
    on: MB.store.get("mb-sound") !== "off",
    set: function (v) {
      this.on = !!v;
      MB.store.set("mb-sound", this.on ? "on" : "off");
      MB.$$("[data-sound-toggle]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(MB.sound.on));
        var l = MB.$("[data-sound-label]", b);
        if (l) l.textContent = (MB.sound.on ? l.getAttribute("data-label-on") : l.getAttribute("data-label-off")) || (MB.sound.on ? "Sound on" : "Sound off");
      });
    },
    play: function (name) {
      if (!this.on || !SFX[name]) return;
      try {
        var a = sfx[name] || (sfx[name] = new Audio(MB.base + SFX[name].src));
        a.volume = SFX[name].vol; a.currentTime = 0;
        var p = a.play(); if (p && p.catch) p.catch(function () {});
      } catch (e) { /* sound is an enhancement */ }
    }
  };
  MB.$$("[data-sound-toggle]").forEach(function (b) {
    b.addEventListener("click", function () { MB.sound.set(!MB.sound.on); if (MB.sound.on) MB.sound.play("tap"); });
  });
  MB.sound.set(MB.sound.on);

  /* ---------------------------------------------------------------- segmented controls: slide the ink under the selected item */
  MB.inkFor = function (seg) {
    var ink = MB.$(".seg-ink", seg);
    if (!ink) return function () {};
    var move = function () {
      var on = MB.$('[aria-selected="true"], [aria-pressed="true"]', seg);
      if (!on) return;
      ink.style.width = on.offsetWidth + "px";
      ink.style.height = on.offsetHeight + "px";
      ink.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)";
    };
    MB.onLayout(move);
    move();
    return move;
  };

  /* ---------------------------------------------------------------- roving tablist helper */
  MB.tablist = function (list, onSelect) {
    var tabs = MB.$$('[role="tab"]', list);
    function select(t, focus) {
      tabs.forEach(function (x) { var on = x === t; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; });
      if (focus) t.focus();
      onSelect(t);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = tabs[(i + tabs.length - 1) % tabs.length];
        else if (e.key === "Home") n = tabs[0];
        else if (e.key === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    return { select: select, tabs: tabs };
  };
})();
