/* Mika Be portfolio: the Knowsy probe. A sketch of the lab engine's net rule
   (modules/bits-and-gates/breadboard-lab/simulate.js) applied to the Lab 1 circuit:
   strong beats weak, equal levels merge, disagreeing strong drivers are a CONFLICT, and an inverter
   with a FLOAT or CONFLICT input gives a FLOAT output (invertOnce). Meter readings follow probe.js:
   HIGH 5.00, LOW 0.00, FLOAT 1.60, CONFLICT 2.50 V. Markup: build/SYSTEM.md. */
(function (root) {
  "use strict";
  var LV = { HIGH: "HIGH", LOW: "LOW", FLOAT: "FLOAT", CONFLICT: "CONFLICT" };
  var VOLTS = { HIGH: "5.00", LOW: "0.00", FLOAT: "1.60", CONFLICT: "2.50" };
  var NAMES = { HIGH: "High", LOW: "Low", FLOAT: "Floating", CONFLICT: "Conflict" };
  var NOTES = {
    pullOpen: "The pull-up holds the input high, so the inverter’s output is low and the LED stays dark.",
    pullClosed: "The closed switch is a strong path to ground and the pull-up is weak, so the input goes low without a false conflict. The output goes high and the LED lights.",
    float: "Nothing drives the input, so the output is undefined and the meter reads about 1.6 V, the reading the lab manual teaches students to recognize. A real 74LS input left open usually reads as a high, so a missing pull-up can go unnoticed at the bench. The lab marks this net as floating so the missing driver shows.",
    closed: "The switch drives the input low, so the output goes high and the LED lights.",
    strayPull: "The stray wire and the pull-up agree on high, so there is no conflict. The output is low and the LED stays dark.",
    stray: "The stray wire drives the input high, so the output is low and the LED stays dark.",
    conflict: "The closed switch and the stray wire are both strong drivers and they disagree, which is a real conflict, like a short. The meter reads 2.50 V and the output is undefined."
  };

  function resolve(drivers) {
    var level = LV.FLOAT, strength = null, conflict = false;
    drivers.forEach(function (d) {
      if (level === LV.FLOAT) { level = d.level; strength = d.strength; return; }
      if (d.level === level) { if (d.strength === "strong") strength = "strong"; return; }
      if (d.strength === "strong" && strength === "weak") { level = d.level; strength = "strong"; return; }
      if (d.strength === "weak" && strength === "strong") return;
      conflict = true;
    });
    return conflict ? LV.CONFLICT : level;
  }
  function invert(a) { return a === LV.HIGH ? LV.LOW : a === LV.LOW ? LV.HIGH : LV.FLOAT; }

  /* state: { switch: closed?, pullup: in?, stray: on? } -> levels, volts, LED, note */
  function solve(st) {
    var drivers = [];
    if (st.pullup) drivers.push({ level: LV.HIGH, strength: "weak" });
    if (st.switch) drivers.push({ level: LV.LOW, strength: "strong" });
    if (st.stray) drivers.push({ level: LV.HIGH, strength: "strong" });
    var a = resolve(drivers), y = invert(a);
    var note;
    if (a === LV.CONFLICT) note = NOTES.conflict;
    else if (a === LV.FLOAT) note = NOTES.float;
    else if (st.switch && st.pullup) note = NOTES.pullClosed;
    else if (st.switch) note = NOTES.closed;
    else if (st.stray && st.pullup) note = NOTES.strayPull;
    else if (st.stray) note = NOTES.stray;
    else note = NOTES.pullOpen;
    return { a: a, y: y, va: VOLTS[a], vy: VOLTS[y], led: y === LV.HIGH, note: note };
  }

  var Probe = { solve: solve, VOLTS: VOLTS, NAMES: NAMES, NOTES: NOTES };
  if (typeof module !== "undefined" && module.exports) module.exports = Probe;
  if (!root || !root.MB) return;
  var MB = root.MB;
  MB.Probe = Probe;

  MB.$$("[data-probe]").forEach(function (el) {
    var st = { switch: false, pullup: true, stray: false };
    var WORD = { switch: ["open", "closed"], pullup: ["out", "in"], stray: ["off", "on"] };
    function render() {
      var r = solve(st);
      el.setAttribute("data-a", r.a); el.setAttribute("data-y", r.y); el.setAttribute("data-led", r.led ? "on" : "off");
      el.setAttribute("data-switch", st.switch ? "closed" : "open");
      el.setAttribute("data-pullup", st.pullup ? "in" : "out");
      el.setAttribute("data-stray", st.stray ? "on" : "off");
      [["a", r.a, r.va], ["y", r.y, r.vy]].forEach(function (m) {
        var box = MB.$('[data-meter="' + m[0] + '"]', el);
        if (!box) return;
        box.setAttribute("data-level", m[1]);
        MB.$("[data-v]", box).textContent = m[2];
        MB.$("[data-l]", box).textContent = NAMES[m[1]];
      });
      var n = MB.$("[data-probe-note]", el); if (n) n.textContent = r.note;
      var glow = el.closest("[data-probe-room]");
      if (glow) glow.setAttribute("data-led", r.led ? "on" : "off");
    }
    MB.$$("[data-toggle]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-toggle");
        st[k] = !st[k];
        b.setAttribute("aria-pressed", String(st[k]));
        var w = MB.$("[data-state]", b); if (w) w.textContent = WORD[k][st[k] ? 1 : 0];
        render();
      });
    });
    el._probe = { state: st, render: render };
    render();
  });
})(typeof window !== "undefined" ? window : null);
