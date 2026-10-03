/* Mika Be portfolio: the Room of Days Quest board. A rebuild of the app's Quest board (build 1.0.4+49) over
   MB.QuestEngine, at the app's sizes, colours, curves and timings. Every beat below cites its source:
   lib/screens/quests.dart _runCompletion (the sequence), lib/widgets/quest_card.dart (the card, its ring and
   plate), lib/widgets/quest_desk.dart QuestCompletionStitch (the XP thread), lib/widgets/reward_receipt.dart,
   lib/widgets/particles.dart, lib/widgets/levelup_overlay.dart and lib/audio.dart.

   One completion, in milliseconds after the tap is released:
     0     the board answers at once, as build 49 does on the tap's frame: the card squashes (90 + 90) and turns
           done, a featured card keeps its size but drops its quiet exits and its plate turns to QUEST COMPLETE,
           the list takes the app's order (the latest win stays, older finished quests sink), any other featured
           card becomes a row, and on the last of the three "Enough for today" pops in at the top (700,
           easeOutBack). Then the ring closes and the check draws (460, with the 460 ms completion sound), Today's
           three counts it (its orbit closes over 520), and the XP thread leaves the ring for the XP number (880).
           A combo inside 15 s, or a dreaded quest, adds a burst of rising embers
   240   the receipt rises (320) at the foot of the column, or at the foot of the screen when the column runs past
         it, as the app's rises above its dock; its chips arrive every 85 ms, each with its own sound
   520   XP, Glimmers and the stat are applied: the XP number rolls (650, easeInQuad) and the bar steps to its new
         length, the stat swells and counts up (420); swipe to undo is armed, and a featured card that resolved in
         place becomes its compact row in one step, as build 49's does when its undo wrapper arrives
   720   last of the three only: an ember wash and the streak sound
   then  the receipt leaves after 3000 + 85 per chip + 700 ms (its last 430 ms fade it out); a level-up, if XP
         crossed the line, takes over once it has gone. Nothing scrolls the page during the reward.

   Markup: <div class="rod-board" data-quest data-variant="home|case">, filled by this script. Element API:
   el._board = { engine, reset(), nextDay(), skipDay(), nearLevel(), on(fn) }. After every beat the element
   dispatches "mb:quest" with detail { type, beat, bundle } (type: complete, undo, reset, day, levelup). */
(function () {
  "use strict";
  var MB = window.MB;
  if (!MB || !MB.QuestEngine) return;
  var QE = MB.QuestEngine;
  var PI = Math.PI, TAU = PI * 2;

  /* ---------------------------------------------------------------- Flutter's curves (cubic beziers as Flutter defines them) */
  function bezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function x(u) { return ((ax * u + bx) * u + cx) * u; }
    return function (t) {
      if (t <= 0) return 0; if (t >= 1) return 1;
      var lo = 0, hi = 1, u = t;
      for (var i = 0; i < 22; i++) { var v = x(u); if (Math.abs(v - t) < 1e-5) break; if (v < t) lo = u; else hi = u; u = (lo + hi) / 2; }
      return ((ay * u + by) * u + cy) * u;
    };
  }
  var easeOutCubic = bezier(0.215, 0.61, 0.355, 1), easeInOutCubic = bezier(0.645, 0.045, 0.355, 1);
  var easeOutBack = bezier(0.175, 0.885, 0.32, 1.275), easeInQuad = bezier(0.55, 0.085, 0.68, 0.53);
  var easeOut = bezier(0, 0, 0.58, 1);
  function elasticOut(t) { if (t <= 0) return 0; if (t >= 1) return 1; var p = 0.4; return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * TAU / p) + 1; }
  function interval(t, a, b, curve) { return curve(MB.clamp((t - a) / (b - a), 0, 1)); }

  /* ---------------------------------------------------------------- Material Icons by Google (CC BY 4.0, assets/licenses/MaterialIcons-CC-BY-4.0.txt),
     traced from the font Flutter bundles, 24 x 24 */
  var IC = {
    favorite_outline: "M16.5 3C14.7 3 13 3.7 12 5.1C10.9 3.7 9.2 3 7.5 3C4.4 3 2 5.4 2 8.4C2 12.2 5.3 15.3 10.5 20L12 21.3L13.4 20C18.6 15.3 21.9 12.2 21.9 8.4C21.9 5.4 19.5 3 16.5 3ZM12 18.5 12 18.6 11.9 18.5C7.1 14.2 3.9 11.3 3.9 8.4C3.9 6.5 5.4 5 7.5 5C9 5 10.5 6 11 7.3H12.9C13.4 6 14.9 5 16.5 5C18.5 5 20 6.5 20 8.4C20 11.3 16.8 14.2 12 18.5Z",
    eco_outlined: "M6 8C3.3 10.7 3.3 15.2 6 17.9C7.4 19.3 9.1 20 11 20C12.7 20 14.5 19.3 15.9 17.9C19.4 14.4 20 3.9 20 3.9C20 3.9 9.5 4.5 6 8ZM14.5 16.5C13.5 17.4 12.3 18 11 18C10.1 18 9.2 17.7 8.5 17.2C9.4 14.4 11.1 11.9 13.4 9.9C10.7 11.3 8.5 13.4 7 15.9C5.5 14 5.6 11.2 7.4 9.4C9.1 7.7 14 6.6 17.8 6.1C17.3 9.9 16.2 14.8 14.5 16.5Z",
    visibility_outlined: "M12 6C15.7 6 19.1 8.1 20.8 11.4C19.1 14.8 15.7 17 12 17C8.2 17 4.8 14.8 3.1 11.4C4.8 8.1 8.2 6 12 6ZM12 3.9C6.9 3.9 2.7 7.1 0.9 11.4C2.7 15.8 6.9 18.9 12 18.9C17 18.9 21.2 15.8 23 11.4C21.2 7.1 17 3.9 12 3.9ZM12 9C13.3 9 14.4 10.1 14.4 11.4C14.4 12.8 13.3 14 12 14C10.6 14 9.5 12.8 9.5 11.4C9.5 10.1 10.6 9 12 9ZM12 6.9C9.5 6.9 7.5 9 7.5 11.4C7.5 13.9 9.5 15.9 12 15.9C14.4 15.9 16.5 13.9 16.5 11.4C16.5 9 14.4 6.9 12 6.9Z",
    handyman_rounded: "M21.6 18.1 16.9 13.4C16.4 12.9 15.9 12.8 15.3 12.8L12.8 15.4C12.8 15.9 12.9 16.5 13.4 16.9L18.1 21.7C18.5 22 19.1 22 19.5 21.7L21.6 19.5C22 19.2 22 18.5 21.6 18.1ZM16.6 9.4C17 9.8 17.6 9.8 18 9.4L18.7 8.7L20.8 10.9C22 9.7 22 7.8 20.8 6.6L18 3.8C17.6 3.4 17 3.4 16.6 3.8L15.9 4.5V2C15.9 1.3 15.1 1 14.7 1.5L12.1 4C11.7 4.5 12 5.2 12.6 5.2H15.1L14.4 5.9C14.1 6.3 14.1 6.9 14.4 7.3L14.8 7.7L11.9 10.5L7.8 6.4V5.4C7.8 5.2 7.7 4.9 7.5 4.7L5.5 2.7C5.1 2.3 4.5 2.3 4.1 2.7L2.7 4.1C2.2 4.5 2.2 5.2 2.7 5.5L4.7 7.5C4.9 7.7 5.1 7.8 5.4 7.8H6.4L10.5 12L9.7 12.8H8.4C7.8 12.8 7.3 13 7 13.4L2.2 18.1C1.9 18.5 1.9 19.2 2.2 19.5L4.4 21.7C4.7 22 5.4 22 5.8 21.7L10.5 16.9C10.9 16.5 11.1 16.1 11.1 15.5V14.2L16.2 9.1L16.6 9.4Z",
    people_alt_rounded: "M16.6 13.1C18 14 18.9 15.3 18.9 17V20H21.9C22.5 20 23 19.5 23 18.9V17C23 14.8 19.4 13.5 16.6 13.1ZM5 8C5 5.8 6.7 3.9 9 3.9C11.2 3.9 12.9 5.8 12.9 8C12.9 10.2 11.2 12 9 12C6.7 12 5 10.2 5 8ZM15 12C17.2 12 18.9 10.2 18.9 8C18.9 5.8 17.2 3.9 15 3.9C14.5 3.9 14.1 4 13.6 4.2C14.4 5.2 15 6.5 15 8C15 9.4 14.4 10.7 13.6 11.7C14.1 11.9 14.5 12 15 12ZM9 12.9C6.3 12.9 0.9 14.3 0.9 17V18.9C0.9 19.5 1.4 20 2 20H15.9C16.5 20 17 19.5 17 18.9V17C17 14.3 11.6 12.9 9 12.9Z",
    home_rounded: "M9.9 18.9V14H14V18.9C14 19.5 14.4 20 15 20H18C18.5 20 18.9 19.5 18.9 18.9V12H20.7C21.1 12 21.3 11.4 21 11.1L12.6 3.6C12.2 3.2 11.7 3.2 11.3 3.6L2.9 11.1C2.6 11.4 2.8 12 3.2 12H5V18.9C5 19.5 5.4 20 6 20H9C9.5 20 9.9 19.5 9.9 18.9Z",
    chevron_right_rounded: "M9.2 6.7C8.9 7 8.9 7.7 9.2 8.1L13.1 12L9.2 15.8C8.9 16.2 8.9 16.9 9.2 17.2C9.7 17.6 10.3 17.6 10.6 17.2L15.2 12.7C15.7 12.3 15.7 11.6 15.2 11.2L10.6 6.7C10.3 6.3 9.7 6.3 9.2 6.7Z",
    star_rounded: "M12 17.2 16.1 19.7C16.9 20.2 17.8 19.5 17.6 18.7L16.5 13.9L20.2 10.7C20.8 10.2 20.5 9.1 19.6 9L14.8 8.6L12.9 4.1C12.5 3.3 11.4 3.3 11 4.1L9.1 8.6L4.3 9C3.4 9 3.1 10.2 3.7 10.7L7.4 13.9L6.3 18.7C6.1 19.5 7 20.2 7.8 19.7L12 17.2Z",
    thunderstorm_rounded: "M17.9 7C17.4 4.1 14.9 2 12 2C9.7 2 7.8 3.1 6.7 5C4 5.3 2 7.7 2 10.5C2 13.5 4.4 15.9 7.5 15.9H17.4C19.9 15.9 21.9 13.9 21.9 11.4C21.9 9.1 20.2 7.2 17.9 7ZM15.9 20.1 15 19.6 16 18.6C16.3 18.2 16.3 17.6 15.9 17.2C15.5 16.8 14.8 16.9 14.5 17.3L12.7 19.3C12.5 19.5 12.4 19.8 12.5 20.2C12.6 20.4 12.7 20.7 13 20.9L13.9 21.3L12.9 22.3C12.6 22.7 12.7 23.3 13 23.7C13.2 23.9 13.5 24 13.7 24C14 24 14.2 23.8 14.4 23.6L16.2 21.6C16.4 21.4 16.5 21 16.5 20.8C16.4 20.4 16.2 20.2 15.9 20.1ZM9.9 20.1 9 19.6 9.9 18.6C10.3 18.2 10.3 17.5 9.8 17.2C9.4 16.8 8.8 16.9 8.4 17.3L6.7 19.3C6.5 19.5 6.4 19.8 6.5 20.2C6.5 20.4 6.7 20.7 7 20.8L7.8 21.2L6.9 22.3C6.6 22.7 6.7 23.3 7 23.7C7.2 23.9 7.5 24 7.7 24C8 24 8.2 23.8 8.4 23.6L10.2 21.6C10.4 21.4 10.5 21 10.5 20.8C10.4 20.4 10.2 20.2 9.9 20.1Z",
    bolt: "M11 21H9.9L11 14H7.5C6.9 14 6.9 13.6 7.1 13.3C7.3 12.9 7.1 13.2 7.1 13.2C8.4 10.9 10.4 7.5 12.9 3H14L12.9 9.9H16.5C16.9 9.9 17 10.3 16.9 10.5L16.9 10.6C12.9 17.5 11 21 11 21Z",
    bolt_rounded: "M10.6 21C10.3 21 10 20.6 10 20.3L11 14H7.5C6.6 14 7.1 13.2 7.1 13.2C8.4 10.9 10.3 7.6 12.8 3.2C12.9 3 13.1 3 13.3 3C13.6 3 13.9 3.3 13.9 3.6L13 9.9H16.5C16.9 9.9 17.1 10.1 16.9 10.6C13.6 16.4 11.7 19.7 11.1 20.7C11 20.9 10.8 21 10.6 21Z",
    trending_up: "M15.9 6 18.2 8.2 13.4 13.1 9.4 9.1 2 16.5 3.4 18 9.4 12 13.4 15.9 19.6 9.7 21.9 12V6H15.9Z",
    link_rounded: "M17 6.9H14C13.4 6.9 12.9 7.4 12.9 8C12.9 8.5 13.4 9 14 9H17C18.6 9 20 10.3 20 12C20 13.6 18.6 15 17 15H14C13.4 15 12.9 15.4 12.9 15.9C12.9 16.5 13.4 17 14 17H17C19.7 17 21.9 14.7 21.9 12C21.9 9.2 19.7 6.9 17 6.9ZM8 12C8 12.5 8.4 12.9 9 12.9H15C15.5 12.9 15.9 12.5 15.9 12C15.9 11.4 15.5 11 15 11H9C8.4 11 8 11.4 8 12ZM9.9 15H6.9C5.3 15 3.9 13.6 3.9 12C3.9 10.3 5.3 9 6.9 9H9.9C10.5 9 11 8.5 11 8C11 7.4 10.5 6.9 9.9 6.9H6.9C4.2 6.9 2 9.2 2 12C2 14.7 4.2 17 6.9 17H9.9C10.5 17 11 16.5 11 15.9C11 15.4 10.5 15 9.9 15Z",
    upgrade_rounded: "M15.9 18.9C15.9 19.5 15.5 20 15 20H9C8.4 20 8 19.5 8 18.9C8 18.4 8.4 18 9 18H15C15.5 18 15.9 18.4 15.9 18.9ZM11 7.9V15C11 15.5 11.4 15.9 12 15.9C12.5 15.9 12.9 15.5 12.9 15V7.9H14.8C15.2 7.9 15.4 7.4 15.1 7.1L12.3 4.3C12.1 4.1 11.8 4.1 11.6 4.3L8.8 7.1C8.5 7.4 8.7 7.9 9.1 7.9H11Z",
    wb_twilight_rounded: "M19 9.3 19.7 8.6C20.1 8.2 20.1 7.6 19.7 7.2C19.4 6.8 18.7 6.8 18.3 7.2L17.6 7.9C17.2 8.3 17.2 9 17.6 9.3C18 9.7 18.7 9.7 19 9.3ZM21 18H3C2.4 18 2 18.4 2 18.9C2 19.5 2.4 20 3 20H21C21.5 20 21.9 19.5 21.9 18.9C21.9 18.4 21.5 18 21 18ZM12 6.9C12.5 6.9 12.9 6.5 12.9 6V5C12.9 4.4 12.5 3.9 12 3.9C11.4 3.9 11 4.4 11 5V6C11 6.5 11.4 6.9 12 6.9ZM4.9 9.3C5.3 9.7 6 9.7 6.3 9.3C6.7 8.9 6.7 8.2 6.3 7.9L5.6 7.2C5.2 6.8 4.6 6.8 4.2 7.2C3.8 7.5 3.8 8.2 4.2 8.6L4.9 9.3ZM18.9 15.9C18.9 12.1 15.8 9 12 9C8.1 9 5 12.1 5 15.9H18.9Z",
    replay_rounded: "M12 5V2.2C12 1.7 11.4 1.5 11.1 1.8L7.3 5.6C7.1 5.8 7.1 6.1 7.3 6.3L11.1 10.1C11.4 10.4 12 10.2 12 9.7V6.9C15.7 6.9 18.7 10.4 17.8 14.2C17.3 16.5 15.5 18.3 13.3 18.8C9.7 19.5 6.5 17.1 6 13.8C6 13.3 5.5 12.9 5 12.9C4.5 12.9 3.9 13.5 4 14.1C4.6 18.5 8.8 21.7 13.5 20.8C16.7 20.2 19.2 17.7 19.8 14.6C20.8 9.4 16.9 5 12 5Z",
    ac_unit_rounded: "M21 11H17.8L20.3 8.4C20.7 8 20.7 7.4 20.3 7C19.9 6.6 19.3 6.6 18.9 7L15 11H12.9V9L16.9 5C17.3 4.6 17.3 4 16.9 3.6C16.5 3.2 15.9 3.2 15.5 3.6L12.9 6.1V3C12.9 2.4 12.5 2 12 2C11.4 2 11 2.4 11 3V6.1L8.4 3.6C8 3.2 7.4 3.2 7 3.6C6.6 4 6.6 4.6 7 5L11 9V11H9L5 7C4.6 6.6 4 6.6 3.6 7C3.2 7.4 3.2 8 3.6 8.4L6.1 11H3C2.4 11 2 11.4 2 12C2 12.5 2.4 12.9 3 12.9H6.1L3.6 15.5C3.2 15.9 3.2 16.5 3.6 16.9C4 17.3 4.6 17.3 5 16.9L9 12.9H11V15L7 18.9C6.6 19.3 6.6 19.9 7 20.3C7.4 20.7 8 20.7 8.4 20.3L11 17.8V21C11 21.5 11.4 21.9 12 21.9C12.5 21.9 12.9 21.5 12.9 21V17.8L15.5 20.3C15.9 20.7 16.5 20.7 16.9 20.3C17.3 19.9 17.3 19.3 16.9 18.9L12.9 15V12.9H15L18.9 16.9C19.3 17.3 19.9 17.3 20.3 16.9C20.7 16.5 20.7 15.9 20.3 15.5L17.8 12.9H21C21.5 12.9 21.9 12.5 21.9 12C21.9 11.4 21.5 11 21 11Z",
    done_rounded: "M9 16.2 5.4 12.7C5.1 12.3 4.5 12.3 4 12.7C3.7 13 3.7 13.6 4 14.1L8.2 18.2C8.6 18.7 9.3 18.7 9.7 18.2L20.2 7.6C20.6 7.3 20.6 6.7 20.2 6.2C19.9 5.9 19.3 5.9 18.8 6.2L9 16.2Z",
    history_edu_rounded: "M9 5V5.3C8.1 5 7.2 4.8 6.3 4.8C4.9 4.8 3.5 5.2 2.3 6.1C1.8 6.5 1.7 7.2 2.2 7.6L4.7 10.2H5.9V11.3C6.7 12.2 7.8 12.7 9 12.7V15H6.9C6.4 15 6 15.4 6 15.9V18C6 19 6.8 20 8 20H18C19.6 20 21 18.6 21 17V5C21 4.4 20.5 3.9 20 3.9H9.9C9.4 3.9 9 4.4 9 5ZM7.8 10.4V8.2H5.6L4.5 7.2C5.1 6.9 5.7 6.8 6.3 6.8C7.7 6.8 9 7.4 9.9 8.3L11.3 9.7L11.1 9.9C10.6 10.4 9.9 10.7 9.2 10.7C8.7 10.7 8.2 10.6 7.8 10.4ZM18.9 17C18.9 17.5 18.5 18 18 18C17.4 18 17 17.5 17 17V15.9C17 15.4 16.5 15 15.9 15H11V12.4C11.5 12.1 12 11.8 12.5 11.3L12.7 11.2L15.6 14H17V12.6L11 6.6V6H18.9V17Z",
    bookmark_added_rounded: "M5 5C5 3.8 5.9 3 6.9 3H14C13.3 3.8 12.9 4.8 12.9 6C12.9 8.7 15.2 11 18 11C18.3 11 18.7 10.9 18.9 10.9V19.5C18.9 20.2 18.2 20.6 17.6 20.3L12 18L6.3 20.3C5.7 20.6 5 20.2 5 19.5V5ZM22 3.3C22.4 3.7 22.4 4.3 22 4.7L18.5 8.2C18.1 8.6 17.5 8.6 17.1 8.2L15.7 6.8C15.3 6.4 15.3 5.8 15.7 5.4C16 5 16.7 5 17.1 5.4L17.8 6.1L20.6 3.3C21 2.9 21.7 2.9 22 3.3Z",
    auto_awesome: "M18.9 9 20.2 6.2 23 5 20.2 3.7 18.9 0.9 17.7 3.7 15 5 17.7 6.2 18.9 9ZM11.4 9.5 9 3.9 6.5 9.5 0.9 12 6.5 14.4 9 20 11.4 14.4 17 12 11.4 9.5ZM18.9 15 17.7 17.7 15 18.9 17.7 20.2 18.9 23 20.2 20.2 23 18.9 20.2 17.7 18.9 15Z",
    auto_awesome_rounded: "M19.4 8 20.2 6.2 21.9 5.4C22.4 5.2 22.4 4.7 21.9 4.5L20.2 3.7L19.4 2C19.2 1.5 18.7 1.5 18.5 2L17.7 3.7L15.9 4.5C15.6 4.7 15.6 5.2 15.9 5.4L17.7 6.2L18.5 8C18.7 8.3 19.2 8.3 19.4 8ZM11.4 9.5 9.8 6C9.5 5.2 8.4 5.2 8.1 6L6.5 9.5L3 11.1C2.2 11.4 2.2 12.5 3 12.8L6.5 14.4L8.1 18C8.4 18.7 9.5 18.7 9.8 18L11.4 14.4L15 12.8C15.7 12.5 15.7 11.4 15 11.1L11.4 9.5ZM18.5 15.9 17.7 17.7 15.9 18.5C15.6 18.7 15.6 19.2 15.9 19.4L17.7 20.2L18.5 21.9C18.7 22.4 19.2 22.4 19.4 21.9L20.2 20.2L21.9 19.4C22.4 19.2 22.4 18.7 21.9 18.5L20.2 17.7L19.4 15.9C19.2 15.6 18.7 15.6 18.5 15.9Z",
    nightlight_outlined: "M14 3.9C14.3 3.9 14.6 4 15 4C13 6.2 12 9 12 12C12 14.9 13 17.7 15 19.9C14.6 19.9 14.3 20 14 20C9.6 20 6 16.4 6 12C6 7.5 9.6 3.9 14 3.9ZM14 2C8.4 2 3.9 6.4 3.9 12C3.9 17.5 8.4 21.9 14 21.9C15.7 21.9 17.5 21.5 18.9 20.6C16 18.9 14 15.7 14 12C14 8.2 16 5 18.9 3.3C17.5 2.4 15.7 2 14 2Z",
    undo: "M12.5 8C9.8 8 7.4 9 5.5 10.5L2 6.9V15.9H11L7.3 12.3C8.7 11.2 10.5 10.5 12.5 10.5C16 10.5 19 12.7 20.1 15.9L22.4 15.2C21 11 17.1 8 12.5 8Z",
    route_rounded: "M18.9 15.1V6.9C18.9 4.7 17.2 3 15 3C12.7 3 11 4.7 11 6.9V17C11 18 10 18.9 9 18.9C7.9 18.9 6.9 18 6.9 17V8.8C8.1 8.3 9 7.3 9 6C9 4.3 7.6 3 6 3C4.3 3 3 4.3 3 6C3 7.3 3.8 8.3 5 8.8V17C5 19.2 6.7 21 9 21C11.2 21 12.9 19.2 12.9 17V6.9C12.9 5.9 13.9 5 15 5C16 5 17 5.9 17 6.9V15.1C15.8 15.6 15 16.6 15 18C15 19.6 16.3 21 18 21C19.6 21 21 19.6 21 18C21 16.6 20.1 15.6 18.9 15.1Z",
    add_rounded: "M18 12.9H12.9V18C12.9 18.5 12.5 18.9 12 18.9C11.4 18.9 11 18.5 11 18V12.9H6C5.4 12.9 5 12.5 5 12C5 11.4 5.4 11 6 11H11V6C11 5.4 11.4 5 12 5C12.5 5 12.9 5.4 12.9 6V11H18C18.5 11 18.9 11.4 18.9 12C18.9 12.5 18.5 12.9 18 12.9Z",
    close_rounded: "M18.2 5.7C17.9 5.2 17.2 5.2 16.8 5.7L12 10.5L7.1 5.7C6.7 5.2 6 5.2 5.7 5.7C5.2 6 5.2 6.7 5.7 7.1L10.5 12L5.7 16.8C5.2 17.2 5.2 17.9 5.7 18.2C6 18.7 6.7 18.7 7.1 18.2L12 13.4L16.8 18.2C17.2 18.7 17.9 18.7 18.2 18.2C18.7 17.9 18.7 17.2 18.2 16.8L13.4 12L18.2 7.1C18.7 6.7 18.7 6 18.2 5.7Z",
    bookmark_add_outlined: "M17 11V17.9L12 15.8L6.9 17.9V5H12.9V3H6.9C5.9 3 5 3.8 5 5V21L12 18L18.9 21V11H17ZM21 6.9H18.9V9H17V6.9H15V5H17V3H18.9V5H21V6.9Z",
    history_rounded: "M13.2 3C8.1 2.8 3.9 6.9 3.9 12H2.2C1.7 12 1.5 12.5 1.8 12.8L4.6 15.6C4.8 15.8 5.1 15.8 5.3 15.6L8.1 12.8C8.4 12.5 8.2 12 7.7 12H6C6 8.1 9.1 4.9 13 5C16.8 5 19.9 8.2 20 11.9C20 15.7 16.9 18.9 12.9 18.9C11.3 18.9 9.8 18.4 8.7 17.5C8.2 17.2 7.7 17.2 7.4 17.5C6.9 18 7 18.7 7.5 19C9 20.2 10.9 21 12.9 21C18 21 22.1 16.8 21.9 11.7C21.8 7 17.9 3.1 13.2 3ZM12.7 8C12.3 8 12 8.3 12 8.7V12.4C12 12.7 12.1 13.1 12.4 13.3L15.6 15.1C15.9 15.3 16.4 15.2 16.6 14.8C16.8 14.5 16.7 14 16.3 13.8L13.5 12.1V8.7C13.5 8.3 13.1 8 12.7 8Z",
    center_focus_weak: "M5 15H3V18.9C3 20.1 3.8 21 5 21H9V18.9H5V15ZM5 5H9V3H5C3.8 3 3 3.8 3 5V9H5V5ZM18.9 3H15V5H18.9V9H21V5C21 3.8 20.1 3 18.9 3ZM18.9 18.9H15V21H18.9C20.1 21 21 20.1 21 18.9V15H18.9V18.9ZM12 8C9.7 8 8 9.7 8 12C8 14.2 9.7 15.9 12 15.9C14.2 15.9 15.9 14.2 15.9 12C15.9 9.7 14.2 8 12 8ZM12 14C10.9 14 9.9 13 9.9 12C9.9 10.9 10.9 9.9 12 9.9C13 9.9 14 10.9 14 12C14 13 13 14 12 14Z",
    support_outlined: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm7.46 7.12-2.78 1.15c-.51-1.36-1.58-2.44-2.95-2.94l1.15-2.78c2.1.8 3.77 2.47 4.58 4.57zM12 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zM9.13 4.54l1.17 2.78c-1.38.5-2.47 1.59-2.98 2.97L4.54 9.13c.81-2.11 2.48-3.78 4.59-4.59zM4.54 14.87l2.78-1.15c.51 1.38 1.59 2.46 2.97 2.96l-1.17 2.78c-2.1-.81-3.77-2.48-4.58-4.59zm10.34 4.59-1.15-2.78c1.37-.51 2.45-1.59 2.95-2.97l2.78 1.17c-.81 2.1-2.48 3.77-4.58 4.58z",
    tune_rounded: "M3 18c0 .55.45 1 1 1h5v-2H4c-.55 0-1 .45-1 1zM3 6c0 .55.45 1 1 1h9V5H4c-.55 0-1 .45-1 1zm10 14v-1h7c.55 0 1-.45 1-1s-.45-1-1-1h-7v-1c0-.55-.45-1-1-1s-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1zM7 10v1H4c-.55 0-1 .45-1 1s.45 1 1 1h3v1c0 .55.45 1 1 1s1-.45 1-1v-4c0-.55-.45-1-1-1s-1 .45-1 1zm14 2c0-.55-.45-1-1-1h-9v2h9c.55 0 1-.45 1-1zm-5-3c.55 0 1-.45 1-1V7h3c.55 0 1-.45 1-1s-.45-1-1-1h-3V4c0-.55-.45-1-1-1s-1 .45-1 1v4c0 .55.45 1 1 1z",
    ios_share: "M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"
  };
  function icon(name, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + IC[name] + '"/></svg>'; }

  /* ---------------------------------------------------------------- tokens (lib/tokens.dart) */
  var C = { xp: "#e0a865", xpLight: "#f2cd93", streak: "#e8915a", success: "#9cbc88", unlock: "#c9a3dc", info: "#8fbab6", cream: "#fff4d9", warmShadow: "rgba(20,12,6,.35)" };
  var STAT = {
    Body: { color: "#e0908a", icon: "favorite_outline", i: 0 }, Care: { color: "#9cbc88", icon: "eco_outlined", i: 1 },
    Mind: { color: "#8aafc6", icon: "visibility_outlined", i: 2 }, Craft: { color: "#ae9ac4", icon: "handyman_rounded", i: 3 },
    People: { color: "#dd9a72", icon: "people_alt_rounded", i: 4 }, Home: { color: "#c79355", icon: "home_rounded", i: 5 }
  };
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }
  function argb(v) { return "rgba(" + (v >>> 16 & 255) + "," + (v >>> 8 & 255) + "," + (v & 255) + "," + ((v >>> 24 & 255) / 255).toFixed(3) + ")"; }
  var reduced = function () { return MB.reduced(); };
  /* frame captures only (build/tests): ?rbslow=10 stretches every duration of the sequence tenfold, so a capture
     tool can photograph each beat at its time; CSS transitions are slowed by the capture tool itself */
  var TS = (function () { var m = /[?&]rbslow=(\d+(?:\.\d+)?)/.exec(location.search); return m ? Math.max(1, +m[1]) : 1; })();
  function D(ms) { return ms * TS; }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function difficultyWord(d) { return d <= 2 ? "easy" : d <= 4 ? "solid" : d <= 6 ? "tough" : "epic"; }
  function countWord(n) { return ["NO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"][n] || String(n); }

  /* ---------------------------------------------------------------- sound (lib/audio.dart): the app's files, played at 1.0 */
  var SFX = { complete: "audio/world/rod-completion.wav", streak: "audio/world/rod-streak.wav", boing: "audio/world/rod-boing.wav",
    levelup: "audio/world/rod-levelup.wav", stat_0: "audio/world/rod-stat-0.wav", stat_1: "audio/world/rod-stat-1.wav",
    stat_2: "audio/world/rod-stat-2.wav", stat_3: "audio/world/rod-stat-3.wav", stat_4: "audio/world/rod-stat-4.wav", stat_5: "audio/world/rod-stat-5.wav" };
  /* The voices are fetched once each and decoded ahead of the tap: when sound is already on (a returning visitor),
     as the board comes into view or the pointer or focus enters it; otherwise the moment sound is turned on. An
     OfflineAudioContext decodes them, so nothing asks to play before a gesture. Each sound is timed to a beat, so a
     voice whose buffer is not ready within 80 ms of its beat is skipped rather than played late. */
  var sfx = (function () {
    var actx = null, dec = null, buf = {}, pending = {}, els = {};
    var http = location.protocol !== "file:" && !!window.fetch;
    function src(n) { return MB.base + SFX[n]; }
    /* The AudioContext is made on the first gesture (browsers start it only then); the voices are already decoded
       by an OfflineAudioContext while the visitor approached the board, so the tap only creates and starts it. */
    function make() {
      if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) try { actx = new AC(); } catch (e) { actx = null; } }
      return actx;
    }
    function ctx() {
      make();
      if (actx && actx.state === "suspended" && actx.resume) actx.resume().catch(function () {});
      return actx;
    }
    function soon(fn) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 600 }); else setTimeout(fn, 60); }
    function decoder() {
      if (actx) return actx;
      if (!dec) { var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (OAC) try { dec = new OAC(1, 1, 48000); } catch (e) { dec = null; } }
      return dec;
    }
    function load(n) {
      if (!http || buf[n] || pending[n]) return pending[n];
      var d = decoder();
      if (!d) return null;
      pending[n] = fetch(src(n)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (a) {
        return new Promise(function (res, rej) { d.decodeAudioData(a, res, rej); });
      }).then(function (b) { buf[n] = b; delete pending[n]; return b; }, function () { delete pending[n]; return null; });
      return pending[n];
    }
    function start(c, b) { var s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); }
    return {
      /* sound is on and the board is near: fetch and decode now, so the first tap is answered on time */
      warm: function () { if (!MB.sound || !MB.sound.on || !http) return; soon(function () { Object.keys(SFX).forEach(load); }); },
      /* called from a user gesture: unlocks Web Audio */
      prime: function () { if (!MB.sound || !MB.sound.on) return; ctx(); Object.keys(SFX).forEach(load); },
      play: function (n) {
        if (!MB.sound || !MB.sound.on || !SFX[n]) return;
        try {
          if (!http) { /* opened from file://: fetch cannot read the files, so HTML audio plays them */
            var a = els[n] || (els[n] = new Audio(src(n)));
            a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {});
            return;
          }
          var c = ctx();
          if (!c) return;
          if (buf[n]) { start(c, buf[n]); return; }
          var t0 = performance.now(), wait = load(n);
          if (wait) wait.then(function (b) { if (b && performance.now() - t0 <= 80) start(c, b); });
        } catch (e) { /* sound is an enhancement */ }
      },
      /* the completion ducks music for its 460 ms (audio.dart) */
      duck: function (ms) {
        MB.$$("audio").forEach(function (a) {
          if (a.paused || a._rbDuck) return;
          var v = a.volume; a._rbDuck = true; a.volume = v * 0.35;
          setTimeout(function () { a.volume = v; a._rbDuck = false; }, ms);
        });
      }
    };
  })();

  /* ---------------------------------------------------------------- canvas helpers */
  function dpr() { return Math.min(3, window.devicePixelRatio || 1); }
  function fit(cv, w, h) {
    var d = dpr(), W = Math.max(1, Math.round(w * d)), H = Math.max(1, Math.round(h * d));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.width = w + "px"; cv.style.height = h + "px";
    var c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0); return c;
  }
  function conic(c, start, x, y, cols, fallback) {
    if (!c.createConicGradient) return fallback;
    var g = c.createConicGradient(start, x, y);
    cols.forEach(function (col, i) { g.addColorStop(i / (cols.length - 1), col); });
    return g;
  }
  /* Flutter's RadialGradient over a circle's box: centre by Alignment, radius as a share of the box's short side */
  function radial(c, cx, cy, r, ax, ay, rad, cols, stops) {
    var gx = cx + ax * r, gy = cy + ay * r, g = c.createRadialGradient(gx, gy, 0, gx, gy, rad * 2 * r);
    cols.forEach(function (col, i) { g.addColorStop(stops ? stops[i] : i / (cols.length - 1), col); });
    return g;
  }
  /* a disc blurred by sigma s (MaskFilter.blur), as a radial falloff */
  function softDisc(c, x, y, r, s, col, a) {
    var g = c.createRadialGradient(x, y, Math.max(0, r - 2 * s), x, y, r + 2 * s);
    g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r + 2 * s, 0, TAU); c.fill();
  }
  function polyPart(c, pts, f) {
    var lens = [], L = 0, i;
    for (i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); L += l; }
    var want = L * f; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length && want > 0; i++) {
      var k = Math.min(1, want / lens[i - 1]);
      c.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k);
      want -= lens[i - 1];
    }
  }

  /* ---------------------------------------------------------------- the check ring (quest_card.dart _CheckRingPainter) */
  function paintRing(cv, S, o) {
    var c = fit(cv, S, S), cx = S / 2, cy = S / 2, ready = o.ready && !o.done;
    var r = S * (o.ready ? 0.42 : 0.39);
    c.clearRect(0, 0, S, S); c.lineCap = "round"; c.lineJoin = "round";
    if (ready) {
      var gap = PI * 0.36, a0 = PI * 0.28 + gap / 2, sweep = TAU - gap;
      c.fillStyle = radial(c, cx, cy, r, -0.30 + o.lx * 0.10, -0.34 + o.ly * 0.08, 0.5, ["rgba(18,12,8,0)", "rgba(18,12,8,.2)", "rgba(12,8,6,.478)"], [0, 0.62, 1]);
      c.beginPath(); c.arc(cx, cy, r - S * 0.055, 0, TAU); c.fill();
      /* the wire's soft contact shadow (blur 2.2) */
      [[8.6, 0.07], [6.4, 0.11], [4.2, 0.13]].forEach(function (p) { c.strokeStyle = "rgba(0,0,0," + p[1] + ")"; c.lineWidth = p[0]; c.beginPath(); c.arc(cx, cy, r, a0, a0 + sweep); c.stroke(); });
      c.strokeStyle = conic(c, o.shine * TAU + o.lx * 0.16, cx, cy, ["#7a4c24", "#e3be7c", "#95602e", "#f0d69c", "#7a4c24"], "#c49a5e");
      c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r, a0, a0 + sweep); c.stroke();
      c.strokeStyle = "rgba(255,231,176,.302)"; c.lineWidth = 0.6; c.beginPath(); c.arc(cx, cy, r - 1.55, a0 + 0.06, a0 + sweep - 0.06); c.stroke();
    } else if (o.done) {
      var closure = easeOutCubic(MB.clamp(o.p, 0, 1));
      softDisc(c, cx, cy, r + 1.1, 2.4, "#9e6e36", 0.169);
      c.fillStyle = radial(c, cx, cy, r, -0.38, -0.46, 1.12, ["rgba(200,154,88,.094)", "rgba(27,19,14,.031)", "rgba(16,11,8,.122)"], [0, 0.58, 1]);
      c.beginPath(); c.arc(cx, cy, r - 2.2, 0, TAU); c.fill();
      c.strokeStyle = "rgba(10,7,5,.639)"; c.lineWidth = 3.4; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
      c.strokeStyle = "#6a4b2d"; c.lineWidth = 2.2; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
      if (closure > 0.001) {
        c.strokeStyle = conic(c, -0.48, cx, cy, ["#7b542c", "#e0bd78", "#9b6b38", "#f0d8a0", "#7b542c"], "#c9a065");
        c.lineWidth = 1.8; c.beginPath(); c.arc(cx, cy, r, -PI / 2, -PI / 2 + TAU * closure); c.stroke();
      }
      c.strokeStyle = "rgba(240,215,161,.302)"; c.lineWidth = 0.5; c.beginPath(); c.arc(cx, cy, r - 2, 0, TAU); c.stroke();
    }
    if (!o.done && !o.ready) return;
    var pts = ready ? [[0.672, 0.706], [0.752, 0.856], [0.942, 0.590]] : [[0.29, 0.51], [0.44, 0.65], [0.72, 0.35]];
    pts = pts.map(function (p) { return [p[0] * S, p[1] * S]; });
    var f = o.done ? MB.clamp(easeOutBack(MB.clamp(o.p, 0, 1)), 0, 1) : 1;
    if (f <= 0.001) return;
    c.strokeStyle = o.done ? "rgba(10,7,5,.82)" : "rgba(35,18,7,.702)"; c.lineWidth = S * (ready ? 0.062 : 0.068);
    polyPart(c, pts, f); c.stroke();
    c.strokeStyle = o.done ? "#e5c98f" : "#dcb477"; c.lineWidth = S * (ready ? 0.038 : 0.034);
    polyPart(c, pts, f); c.stroke();
  }

  /* ---------------------------------------------------------------- Today's three pips (quests.dart _ThreePipPainter) */
  function paintPip(cv, kind, closure, glow) {
    var S = 16, c = fit(cv, S, S), cx = 8, cy = 8, r = S * 0.36;
    c.clearRect(0, 0, S, S); c.lineCap = "round";
    if (kind === "kept") {
      if (glow) softDisc(c, cx, cy, r + 2.4, 3.2, "#e0a865", 0.30);
      c.strokeStyle = "#5a3f25"; c.lineWidth = 1.9; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
      if (closure > 0.001) {
        c.strokeStyle = conic(c, -0.48, cx, cy, ["#9b6b38", "#f0d8a0", "#b9853f", "#ffe7b6", "#9b6b38"], "#d4a868");
        c.beginPath(); c.arc(cx, cy, r, -PI / 2, -PI / 2 + TAU * closure); c.stroke();
        c.fillStyle = "#e9c58a"; c.beginPath(); c.arc(cx, cy, r * 0.34 * closure, 0, TAU); c.fill();
      }
    } else if (kind === "open") {
      var gap = PI * 0.42, a0 = PI * 0.28 + gap / 2;
      c.strokeStyle = conic(c, -0.6, cx, cy, ["#7a4c24", "#e3be7c", "#95602e", "#f0d69c", "#7a4c24"], "#c49a5e");
      c.lineWidth = 1.7; c.beginPath(); c.arc(cx, cy, r, a0, a0 + TAU - gap); c.stroke();
    } else {
      c.fillStyle = "rgba(148,136,122,.549)";
      for (var i = 0; i < 12; i++) { var a = i * TAU / 12; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.75, 0, TAU); c.fill(); }
    }
  }

  /* ---------------------------------------------------------------- effects drawn on the board's overlay canvas */
  /* the XP thread (quest_desk.dart _CompletionStitchPainter) */
  function Stitch(from, to, xp, color, still) {
    var dur = D(still ? 240 : 880), t0 = performance.now(), pts = [], N = 96, lens = [0];
    var c1 = [from[0] + (to[0] - from[0]) * 0.34, from[1] - 168], c2 = [to[0] - (to[0] - from[0]) * 0.26, to[1] + 154];
    for (var i = 0; i <= N; i++) {
      var u = i / N, m = 1 - u;
      pts.push([m * m * m * from[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * to[0], m * m * m * from[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * to[1]]);
      if (i) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    var L = lens[N];
    function at(d) { for (var i = 1; i <= N; i++) if (lens[i] >= d) { var k = (d - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; } return pts[N]; }
    function path(c, d) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i <= N && lens[i - 1] < d; i++) { var p = lens[i] <= d ? pts[i] : at(d); c.lineTo(p[0], p[1]); } }
    this.draw = function (c, now, W) {
      var p = MB.clamp((now - t0) / dur, 0, 1), travel = still ? 1 : easeInOutCubic(p), d = L * travel;
      c.lineCap = "round"; c.lineJoin = "round";
      if (d > 0.5) {
        var ga = 0.22 * (1 - p);
        [[18, 0.18], [12, 0.34], [8, 0.42]].forEach(function (s) { c.strokeStyle = hexA(C.xpLight, ga * s[1]); c.lineWidth = s[0]; path(c, d); c.stroke(); });
        var g = c.createLinearGradient(from[0], from[1], to[0], to[1]);
        g.addColorStop(0, color); g.addColorStop(0.22, C.xpLight); g.addColorStop(1, C.xp);
        c.strokeStyle = g; c.lineWidth = 1.55; path(c, d); c.stroke();
      }
      if (p < 0.94) { var h = at(d); softDisc(c, h[0], h[1], 2.4 + 2 * (1 - p), 2, C.xpLight, 1); }
      if (!still && p < 0.48) {
        var rip = easeOut(MB.clamp(p / 0.48, 0, 1));
        for (var i = 0; i < 3; i++) {
          var dl = MB.clamp(rip - i * 0.12, 0, 1);
          if (dl <= 0) continue;
          c.strokeStyle = hexA(color, 0.22 * (1 - dl)); c.lineWidth = 1.2;
          c.beginPath(); c.arc(from[0], from[1], 21 + dl * (23 + i * 6), 0, TAU); c.stroke();
        }
      }
      var la = p < 0.16 ? p / 0.16 : p > 0.72 ? (1 - p) / 0.28 : 1;
      if (la > 0.004) {
        var lx = MB.clamp(from[0] + 145, 70, W - 70), ly = from[1] - 45;
        c.save(); c.font = "700 17px Fraunces, Georgia, serif"; c.textAlign = "center"; c.textBaseline = "alphabetic";
        c.shadowColor = C.warmShadow; c.shadowBlur = 10; c.fillStyle = hexA(C.xpLight, la);
        c.fillText("+" + xp + " XP", lx, ly - 9 - 5); c.restore();
      }
      if (p > 0.72) {
        /* the arrival mark: the painter's own ramp (1 - settle), faded in over its first 86 ms, which is how the
           rendered app shows it (nothing at 640 ms, the mark by 720) */
        var st = (p - 0.72) / 0.28, rr = 3 + st * 5, aa = (1 - st) * MB.clamp((p - 0.72) / 0.098, 0, 1);
        c.strokeStyle = hexA(C.xpLight, aa); c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(to[0], to[1] - rr); c.lineTo(to[0] + rr, to[1]); c.lineTo(to[0], to[1] + rr); c.lineTo(to[0] - rr, to[1]); c.closePath(); c.stroke();
        c.fillStyle = hexA(C.xpLight, aa); c.beginPath(); c.arc(to[0], to[1], 1.6 + st * 1.2, 0, TAU); c.fill();
      }
      return p < 1;
    };
  }
  /* rising embers (particles.dart ParticleBurst): one 850 ms system, never falling confetti. clip = [x, y, w, h]
     keeps a burst inside the board (the end-of-day wash). Under reduced motion the board never adds one. */
  function Burst(origin, colors, count, vibrancy, spread, still, clip) {
    var t0 = performance.now(), n = still ? 4 : count, ps = [];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var sp = still ? (0.1 + Math.random() * 0.15) * spread : (0.4 + Math.random()) * spread * (0.7 + vibrancy);
      ps.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * 1.2 * sp, col: colors[Math.floor(Math.random() * colors.length)],
        size: (2 + Math.random() * 3.5) * (0.7 + 0.5 * vibrancy), drag: 0.85 + Math.random() * 0.1, spin: still ? 0 : (Math.random() - 0.5) * 6 });
    }
    this.draw = function (c, now) {
      var t = MB.clamp((now - t0) / D(850), 0, 1), fade = 1 - t, travel = 1 - Math.pow(1 - t, 3);
      var al = fade * MB.clamp(0.6 + 0.4 * vibrancy, 0, 1);
      if (clip) { c.save(); c.beginPath(); c.rect(clip[0], clip[1], clip[2], clip[3]); c.clip(); }
      ps.forEach(function (p) {
        var x = origin[0] + p.vx * travel * p.drag + Math.sin(t * 7 + p.spin) * 4 * t, y = origin[1] + p.vy * travel * p.drag - 72 * travel;
        if (p.size > 4) {
          c.save(); c.translate(x, y); c.rotate(p.spin * t); c.fillStyle = hexA(p.col, al);
          c.fillRect(-p.size / 2, -p.size * 0.2, p.size, p.size * 0.4); c.restore();
        } else softDisc(c, x, y, p.size * (0.6 + 0.6 * fade), 1.6, p.col, al);
      });
      if (clip) c.restore();
      return t < 1;
    };
  }

  /* ---------------------------------------------------------------- satin fibers for the gold (gold_surface.dart: 44 long, faint lines) */
  var GOLD_FIBERS = (function () {
    var s = 41, rnd = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }, lines = "";
    for (var i = 0; i < 44; i++) {
      var x = rnd() * 300, y = (0.08 + rnd() * 0.84) * 48, len = 300 * (0.018 + rnd() * 0.075), w = (0.26 + rnd() * 0.18).toFixed(2);
      lines += '<line x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + Math.min(300, x + len).toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + (i % 2 ? "rgba(94,61,36,.06)" : "rgba(243,220,176,.08)") + '" stroke-width="' + w + '"/>';
    }
    return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 48" preserveAspectRatio="none">' + lines + "</svg>") + '")';
  })();
  function gold(label, ic) {
    return '<span class="rb-gold-wrap"><span class="rb-gold rb-facet"><i class="lip"></i><i class="base"></i><span class="rb-gold-label">' + (ic ? icon(ic) : "") + esc(label) + "</span></span></span>";
  }

  /* ---------------------------------------------------------------- the board */
  var uid = 0;
  function Board(root) {
    var self = this, id = "rb" + (++uid);
    var variant = root.getAttribute("data-variant") || "home";
    var eng = QE.create();
    var listeners = [];
    var selected = null;          /* the last quest the keeper activated (quests.dart _selectedQuest) */
    var pinned = null;            /* the latest win stays where it is; older finished quests sink (quests.dart _pinnedDoneTitle) */
    var combo = 0, lastAt = -1e9; /* back-to-back clears inside 15 s */
    var clearedDay = null;        /* the wash plays once per day */
    var undoMemo = null;          /* what an undo gives back besides the engine's state: the pin and the combo */
    var timers = [], fx = [], receipt = null, sheet = null, levelPending = false, undoQuest = null, lastFocus = null;
    root.style.setProperty("--gold-fibers", GOLD_FIBERS);

    /* ---------- markup */
    var stats = QE.STATS.map(function (k) {
      return '<li><span class="rb-stat" data-rb-stat="' + k + '" style="--sc:' + STAT[k].color + '"><span class="rb-stat-top">' + icon(STAT[k].icon) +
        '<b data-v>0</b></span><span class="rb-stat-lbl">' + QE.ABBR[k] + "</span></span></li>";
    }).join("");
    var cards = eng.quests.map(function (q) {
      return '<li class="rb-item" data-q="' + q.id + '"><div class="rb-card' + (q === eng.quests[0] ? " is-hero" : "") + '" data-card tabindex="-1">' +
        '<button class="rb-undo" type="button" tabindex="-1">' + icon("undo") + "UNDO</button>" +
        '<div class="rb-slide"><button class="rb-hit" type="button"></button><div class="rb-squash"><div class="rb-press">' +
        '<div class="rb-card-shadow"></div><div class="rb-under rb-facet"></div>' +
        '<div class="rb-face rb-facet"><i class="rb-edge e-open"></i><i class="rb-edge e-hero"></i><i class="rb-edge e-done"></i>' +
        '<i class="rb-fill f-open rb-facet"></i><i class="rb-fill f-hero rb-facet"></i><i class="rb-fill f-done rb-facet"></i>' +
        (q.stat === "Mind" ? '<span class="rb-vignette"><img src="' + MB.base + 'assets/room-of-days/rod-quest-mind.webp" alt="" width="480" height="240" decoding="async"></span>' : "") +
        '<i class="rb-sheen"></i><i class="rb-gleam"></i><i class="rb-lip"></i><i class="rb-foot-line"></i>' +
        '<div class="rb-body"><div class="rb-row"><span class="rb-ring"><canvas></canvas></span>' +
        '<div class="rb-titles"><p class="rb-title">' + esc(q.title) + '<span class="sr-only" data-done-sr></span></p>' +
        '<p class="rb-meta"><span class="rb-chip">' + icon("star_rounded") + 'MAIN</span><span class="rb-meta-xp" data-xp></span></p>' +
        '<p class="rb-companion" data-companion></p></div>' +
        (q.dread ? icon("thunderstorm_rounded", "rb-dread") : "") + '<span class="rb-xpchip" data-xp></span></div>' +
        '<div class="rb-plate-slot"><div class="rb-plate"><button class="rb-plate-btn" type="button">' + gold("MARK COMPLETE") + "</button></div>" +
        '<div class="rb-resolved" aria-hidden="true"><i class="rb-resolved-shadow"></i><span class="rb-resolved-face rb-facet"></span><span>QUEST COMPLETE</span></div></div>' +
        /* the featured card's quiet exits (quest_card.dart _QuestFooterActions), drawn for the card's proportions only */
        '<div class="rb-exits" aria-hidden="true"><span class="rb-exit rb-exit-help">' + icon("support_outlined") + 'Help, plans &amp; writing</span><span class="rb-exit">' + icon("tune_rounded") + "Manage</span></div>" +
        "</div></div></div></div></div></div></li>";
    });
    root.innerHTML =
      '<div class="rb-head"><p class="kicker" id="' + id + '-k">' + esc(root.getAttribute("data-kicker") || "Try Today’s three") + "</p>" +
      '<div class="rb-head-tools"><button class="rb-reset" type="button" hidden data-rb-reset>Start over</button>' +
      /* sound stays off until asked (the site's rule), so the board's toggle says what turning it on gives */
      '<button class="sound-toggle rb-sound" type="button" aria-pressed="false" aria-label="The app’s sounds" data-sound-toggle><svg viewBox="0 0 20 20" aria-hidden="true"><path class="spk" d="M3 8h3l4-3.5v11L6 12H3z"/><path class="wv" d="M13 7.5c1.2 1.4 1.2 3.6 0 5M15.2 5.5c2.3 2.6 2.3 6.4 0 9"/><path class="mt" d="M13 7.5l5 5M18 7.5l-5 5"/></svg><span data-sound-label data-label-off="Turn on sound" data-label-on="Sound on">Turn on sound</span></button></div></div>' +
      '<div class="rb-phone"><div class="rb-col">' +
      '<section class="rb-hud" aria-label="Level, XP and life stats"><div class="rb-hud-shadow"></div><div class="rb-hud-face rb-facet">' +
      '<div class="rb-hud-top"><span class="rb-desk rb-facet" aria-hidden="true"><span>' + icon("auto_awesome_rounded") + "<b>DESK</b></span></span>" +
      '<div class="rb-level"><div class="rb-level-row"><p class="rb-lvl"><span>LEVEL </span><b data-rb-level></b></p>' +
      '<p class="rb-xpnum"><span data-rb-xp></span> / <span data-rb-next></span> XP</p></div>' +
      '<div class="rb-rail rb-facet" role="progressbar" aria-label="XP toward the next level" aria-valuemin="0"><i class="rb-facet"></i></div></div></div>' +
      '<hr class="rb-hr"><ul class="rb-stats" aria-label="Life stats">' + stats + '</ul><hr class="rb-hr">' +
      '<div class="rb-day"><div class="rb-three"><span class="rb-pips" aria-hidden="true"><canvas></canvas><canvas></canvas><canvas></canvas></span>' +
      '<span class="rb-three-txt"><b>Today’s three</b><span data-rb-kept></span></span>' + icon("chevron_right_rounded") + "</div>" +
      '<div class="rb-tools" aria-hidden="true"><span class="rb-tool">' + icon("center_focus_weak") + 'FOCUS</span><i></i><span class="rb-tool">' + icon("add_rounded") + "ADD</span></div></div>" +
      "</div></section>" +
      '<ol class="rb-list" aria-label="Today’s three quests"><li class="rb-enough" data-rb-enough><div class="rb-enough-pop"><div class="rb-glass rb-facet"><i class="rb-glass-fill"></i><i class="rb-glass-low"></i>' +
      icon("auto_awesome", "spark") + '<h3>Enough for today</h3><p class="body">What you chose for today is kept. The side quests stay open if the day has room.</p>' +
      /* the app's own line for a day with no side quests open, which is this board's day */
      '<p class="sub">nothing else needs carrying</p><button class="rb-honey" type="button" data-rb-close>' + gold("CLOSE THE DAY", "nightlight_outlined") + "</button>" +
      '<p class="rb-more" aria-hidden="true">' + icon("bolt") + "take one more step</p>" +
      "</div></div></li>" + "</ol>" +
      '<div class="rb-rail-box"><div class="rb-sheet" hidden role="dialog" aria-modal="true"></div></div><div class="rb-foot"><p class="rb-foot-l" data-rb-reserve></p><button class="rb-door-day" type="button" data-rb-closeday>' + icon("nightlight_outlined") + "CLOSE DAY</button></div>" +
      "</div>" +
      '<canvas class="rb-fx" aria-hidden="true"></canvas><div class="rb-combo" aria-hidden="true"></div>' +
      '<div class="rb-levelup" hidden role="dialog" aria-modal="true" tabindex="-1"></div>' +
      '</div><p class="sr-only" aria-live="polite" data-rb-status></p>';

    if (!root.hasAttribute("aria-label")) root.setAttribute("aria-labelledby", id + "-k");
    var $ = function (s, r) { return MB.$(s, r || root); };
    var ui = {
      phone: $(".rb-phone"), col: $(".rb-col"), level: $("[data-rb-level]"), xp: $("[data-rb-xp]"), next: $("[data-rb-next]"), rail: $(".rb-rail"),
      kept: $("[data-rb-kept]"), pips: MB.$$(".rb-pips canvas", root), enough: $("[data-rb-enough]"), list: $(".rb-list"),
      rail2: $(".rb-rail-box"), fx: $(".rb-fx"), combo: $(".rb-combo"), sheet: $(".rb-sheet"), lu: $(".rb-levelup"), status: $("[data-rb-status]"),
      reset: $("[data-rb-reset]"), reserve: $("[data-rb-reserve]"), closeDay: $("[data-rb-closeday]"), close: $("[data-rb-close]"), stats: {}
    };
    MB.$$("[data-rb-stat]", root).forEach(function (s) { ui.stats[s.getAttribute("data-rb-stat")] = { el: s, v: MB.$("[data-v]", s) }; });
    /* the cards go in one task after the instrument (see the end of Board), so no single task builds the whole board */
    var cardOf = {}, ready = false;
    function linkCards() {
      MB.$$(".rb-item", root).forEach(function (li) {
        var q = li.getAttribute("data-q");
        var sq = MB.$(".rb-squash", li);
        sq.addEventListener("animationend", function () { sq.classList.remove("is-squash"); });
        cardOf[q] = { li: li, card: MB.$("[data-card]", li), slide: MB.$(".rb-slide", li), squash: sq, ring: MB.$(".rb-ring canvas", li),
          ringBox: MB.$(".rb-ring", li), hit: MB.$(".rb-hit", li), plate: MB.$(".rb-plate-btn", li), undo: MB.$(".rb-undo", li),
          xp: MB.$$("[data-xp]", li), companion: MB.$("[data-companion]", li), doneSr: MB.$("[data-done-sr]", li), anim: null };
      });
    }
    if (MB.sound) MB.sound.set(MB.sound.on); /* paint the new toggle's state */
    MB.$("[data-sound-toggle]", root).addEventListener("click", function () { MB.sound.set(!MB.sound.on); if (MB.sound.on) { sfx.prime(); MB.sound.play("tap"); } });
    root.addEventListener("pointerdown", function () { sfx.prime(); }, { passive: true });
    root.addEventListener("keydown", function () { sfx.prime(); });
    /* the board's sounds load when the visitor approaches it (hover or focus), never on scroll alone */
    root.addEventListener("pointerenter", function () { sfx.warm(); }, { passive: true });
    root.addEventListener("focusin", function () { sfx.warm(); });

    function emit(type, beat, b) {
      var detail = { type: type, beat: beat || "", bundle: b || null };
      var ev;
      try { ev = new CustomEvent("mb:quest", { detail: detail }); } catch (e) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent("mb:quest", false, false, detail); }
      root.dispatchEvent(ev);
      listeners.forEach(function (fn) { try { fn(detail); } catch (e) { /* a listener's error stays its own */ } });
    }
    /* one frame loop for the board's moving pieces (the overlay canvas, the receipt's clock); a piece leaves it by
       returning false, and the loop stops when none is left */
    var tickers = [], ticking = false;
    function addTicker(fn) { if (tickers.indexOf(fn) < 0) tickers.push(fn); if (!ticking) { ticking = true; requestAnimationFrame(tickStep); } }
    function tickStep() {
      tickers = tickers.filter(function (fn) { try { return fn() === true; } catch (e) { return false; } });
      if (tickers.length) requestAnimationFrame(tickStep); else ticking = false;
    }
    function later(fn, ms) { var t = setTimeout(function () { timers.splice(timers.indexOf(t), 1); fn(); }, D(ms)); timers.push(t); return t; }
    function cancelAll() { timers.forEach(clearTimeout); timers = []; pendingStamp = null; }
    function setStatus(t) { ui.status.textContent = ""; if (t) setTimeout(function () { ui.status.textContent = t; }, 30); }

    /* ---------- the light the gold and the ring answer to: scroll and pointer, never a clock (gold_surface.dart) */
    var light = { x: 0, y: 0 };
    function lightPhase() {
      var raw = 0.22 + MB.scrollY * 0.00092 + light.x * 0.110 - light.y * 0.040;
      var w = raw % 1; return w < 0 ? w + 1 : w;
    }
    function lightSweep() { var v = (0.32 + light.x * 0.10 - light.y * 0.035 + MB.scrollY * 0.00032) % 1; return v < 0 ? v + 1 : v; }

    /* ---------- painting the cards */
    function featuredId() {
      if (selected) return eng.isDone(selected) ? null : selected;
      for (var i = 0; i < eng.quests.length; i++) if (!eng.isDone(eng.quests[i].id)) return eng.quests[i].id;
      return null;
    }
    function ringState(q, k) {
      var done = eng.isDone(q), size = k.card.classList.contains("is-hero") ? 48 : 40;
      return { size: size, o: { done: done, ready: !done, p: k.anim ? k.anim.p : 1, shine: k.card.classList.contains("is-hero") && !done ? lightPhase() : 0.22, lx: 0, ly: 0 } };
    }
    function drawRing(q) { var k = cardOf[q], st = ringState(q, k); paintRing(k.ring, st.size, st.o); }
    function drawPips(animIndex, closure) {
      var kept = eng.quests.length - eng.remaining(), all = kept === eng.quests.length;
      ui.pips.forEach(function (cv, i) { paintPip(cv, i < kept ? "kept" : "open", i === animIndex ? closure : 1, all); });
      ui.kept.textContent = all ? "all kept" : kept + " of " + eng.quests.length + " kept";
      ui.kept.classList.toggle("is-all", all);
    }

    function renderHud(opts) {
      var s = eng.state, next = QE.xpNeeded(s.level + 1);
      ui.level.textContent = s.level;
      if (!(opts && opts.keepNumbers)) {
        ui.xp.textContent = Math.min(s.xp, next); ui.xp.setAttribute("data-value", Math.min(s.xp, next));
        ui.next.textContent = next;
        setFill(Math.min(1, s.xp / next), false);
        QE.STATS.forEach(function (k) { ui.stats[k].v.textContent = s.stats[k]; ui.stats[k].v.setAttribute("data-value", s.stats[k]); });
      }
      ui.rail.setAttribute("aria-valuemax", next); ui.rail.setAttribute("aria-valuenow", Math.min(s.xp, next));
      ui.rail.setAttribute("aria-valuetext", Math.min(s.xp, next) + " of " + next + " XP");
      /* the freeze reserve and the streak (streak_freeze_status.dart); after a gap no freeze can hold, the best run is what it keeps */
      var sit = eng.situation(), stale = sit.gap && !sit.covered;
      ui.reserve.classList.toggle("is-stale", stale);
      ui.reserve.innerHTML = icon(stale ? "history_rounded" : "ac_unit_rounded") + "<span>" + (stale ? s.freezes + " READY · BEST " + Math.max(s.best, s.streak) + " KEPT" : s.freezes + " READY · " + s.streak + " DAY STREAK") + "</span>";
      ui.reserve.setAttribute("aria-label", s.freezes + (s.freezes === 1 ? " freeze" : " freezes") + " ready. " + (stale ? "Best streak " + Math.max(s.best, s.streak) + " kept." : s.streak + " day streak."));
    }
    function setFill(v, animate) {
      ui.rail.classList.toggle("is-filling", !!animate && !reduced());
      ui.rail.style.setProperty("--fill", v.toFixed(4));
    }
    function renderCards() {
      var feat = featuredId(), comp = eng.companion();
      eng.quests.forEach(function (q) {
        var k = cardOf[q.id], done = eng.isDone(q.id), hero = (q.id === feat) || k.holdHero;
        k.card.classList.toggle("is-hero", !!hero);
        k.card.classList.toggle("is-done", done);
        var xp = eng.preview(q.id);
        k.xp.forEach(function (n) { n.textContent = "+" + xp + " XP"; });
        if (k.companion) k.companion.textContent = comp;
        k.doneSr.textContent = done ? ", completed" : "";
        k.card.setAttribute("aria-label", q.title + (done ? ", completed" + (eng.canUndo && undoQuest === q.id ? ". Undo is the next control." : "") : ""));
        k.hit.setAttribute("aria-label", q.title + ", mark complete, " + difficultyWord(q.difficulty) + ", " + xp + " XP");
        k.hit.disabled = done || hero;
        k.plate.setAttribute("aria-label", "Mark complete: " + q.title + ", " + xp + " XP");
        /* a featured card held open while another quest completes keeps its look but not its action */
        k.plate.disabled = done || (!!k.holdHero && q.id !== feat);
        var canUndo = done && eng.canUndo && undoQuest === q.id;
        k.card.classList.toggle("can-undo", canUndo);
        k.undo.tabIndex = canUndo ? 0 : -1;
        k.undo.setAttribute("aria-label", "Undo " + q.title);
        drawRing(q.id);
      });
      var allKept = eng.remaining() === 0;
      ui.enough.classList.toggle("is-on", allKept);
      root.classList.toggle("is-all-kept", allKept);
      if (ui.close) ui.close.disabled = !allKept;
      ui.reset.hidden = !(eng.state.completions > 0 || eng.state.day > 0 || eng.canUndo);
    }
    /* the list's order (quests.dart, the board's sort): open quests and the latest win keep their places, older
       finished quests sink below them. Applied on the tap's frame, as build 49 sorts in the same setState that
       marks the quest done, and at a reset or a new day. The rows jump, as in the app. */
    function listOrder() {
      var banked = function (q) { return eng.isDone(q.id) && q.id !== pinned; };
      return eng.quests.filter(function (q) { return !banked(q); }).concat(eng.quests.filter(banked));
    }
    function applyOrder() {
      if (!ready) return;
      var want = listOrder().map(function (q) { return cardOf[q.id].li; });
      var have = MB.$$(".rb-item", ui.list);
      if (want.every(function (li, i) { return have[i] === li; })) return;
      var focus = document.activeElement, inList = focus && ui.list.contains(focus);
      want.forEach(function (li) { ui.list.appendChild(li); });
      if (inList && focus.isConnected && document.activeElement !== focus) focus.focus({ preventScroll: true });
    }
    function renderAll() { if (!ready) return; renderHud(); renderCards(); applyOrder(); drawPips(-1, 1); holdHeight(); }
    /* The receipt rises from one place, as the app's rises from the foot of the screen above its dock: the foot of
       the column, over the footer rail. The column keeps the larger of two heights however the list settles: the
       board at rest (the HUD, the featured card, two rows and the footer), and the settled list of three rows with
       a receipt under it, so the rows stay clear of the receipt once the featured card has banked. */
    var heroH = 254, rowH = 72, receiptH = 198, enoughH = 0;
    /* while a receipt is up the column keeps the height it had when the receipt rose, so the receipt's anchor (the
       column's foot) never moves under it as the list settles */
    var colHold = 0;
    function outerH(el) { if (!el) return 0; var cs = getComputedStyle(el); return el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0); }
    function holdHeight() {
      if (!ready) return;
      eng.quests.forEach(function (q) {
        var c = cardOf[q.id].card;
        if (c.classList.contains("is-hero") && !c.classList.contains("is-done")) heroH = c.offsetHeight || heroH;
        else if (!c.classList.contains("is-hero")) rowH = c.offsetHeight || rowH;
      });
      var hud = $(".rb-hud").offsetHeight, foot = outerH($(".rb-foot")), top = parseFloat(getComputedStyle(ui.list).marginTop) || 0, gap = 8;
      var rest = hud + top + heroH + 2 * (rowH + gap) + foot;
      var settled = hud + top + 3 * rowH + 2 * gap + gap + receiptH;
      /* where the board sits in the page's flow, it also keeps room for the day's end ("Enough for today" over the
         three rows), so nothing below it moves when the day is kept */
      var inFlow = getComputedStyle(root).position !== "absolute";
      var kept = inFlow && enoughH ? hud + top + enoughH + gap + 3 * rowH + 2 * gap + foot : 0;
      ui.col.style.minHeight = Math.ceil(Math.max(rest, settled, kept, colHold)) + "px";
    }

    /* ---------- the moving parts of one completion */
    function animate(dur, step, done) {
      var t0 = performance.now(), live = true;
      function frame() {
        if (!live) return;
        var p = MB.clamp((performance.now() - t0) / dur, 0, 1); step(p);
        if (p < 1) requestAnimationFrame(frame); else if (done) done();
      }
      requestAnimationFrame(frame);
      return { stop: function () { live = false; } };
    }
    var running = [];
    function run(dur, step, done) { var a = animate(D(dur), step, done); running.push(a); return a; }
    function stopRunning() { running.forEach(function (a) { a.stop(); }); running = []; }

    function rollNumber(node, to, ms, fmt) {
      var from = parseFloat(node.getAttribute("data-value")) || 0;
      node.setAttribute("data-value", to);
      if (reduced() || from === to) { node.textContent = fmt ? fmt(to) : to; return; }
      run(ms, function (p) { var v = from + (to - from) * easeInQuad(p); node.textContent = fmt ? fmt(Math.round(v)) : Math.round(v); });
    }
    function statPulse(k, to) {
      var st = ui.stats[k], from = parseFloat(st.v.getAttribute("data-value")) || 0;
      st.v.setAttribute("data-value", to);
      if (reduced()) { st.v.textContent = to; return; }
      st.el.classList.add("is-pulsing");
      run(420, function (p) {
        var wave = easeOutBack(1 - Math.abs(p - 0.5) * 2);
        st.el.style.transform = "scale(" + (1 + 0.08 * wave).toFixed(4) + ")";
        st.v.textContent = Math.round(from + (to - from) * p);
      }, function () { st.el.style.transform = ""; st.el.classList.remove("is-pulsing"); });
    }

    /* the overlay canvas covers the column with room for the label, the thread's curve and the embers */
    /* sideways it never reaches past the page's edge, so a phone gets no horizontal scroll */
    var PAD = 64, PADL = 64, fxCtx = null, fxSize = [0, 0];
    function fxBox() {
      var w = ui.phone.offsetWidth, h = ui.phone.offsetHeight, r = ui.phone.getBoundingClientRect();
      var vw = document.documentElement.clientWidth;
      PADL = Math.round(MB.clamp(r.left, 0, PAD)); var padR = Math.round(MB.clamp(vw - r.right, 0, PAD));
      ui.fx.style.left = -PADL + "px"; ui.fx.style.top = -PAD - 40 + "px";
      var W = w + PADL + padR, H = h + 2 * PAD + 40;
      if (W !== fxSize[0] || H !== fxSize[1] || !fxCtx) { fxSize = [W, H]; fxCtx = fit(ui.fx, W, H); }
      return fxCtx;
    }
    function fxPoint(el, ax, ay) {
      var r = el.getBoundingClientRect(), p = ui.phone.getBoundingClientRect();
      return [r.left - p.left + r.width * ax + PADL, r.top - p.top + r.height * ay + PAD + 40];
    }
    function addFx(e) { fx.push(e); addTicker(fxFrame); }
    function fxFrame() {
      var now = performance.now(), c = fxBox(); c.clearRect(0, 0, fxSize[0], fxSize[1]);
      fx = fx.filter(function (e) { return e.draw(c, now, fxSize[0]); });
      if (!fx.length) { c.clearRect(0, 0, fxSize[0], fxSize[1]); return false; }
      return true;
    }
    function clearFx() { fx = []; if (fxCtx) fxCtx.clearRect(0, 0, fxSize[0], fxSize[1]); }

    function comboPill(n) {
      var word = n >= 5 ? "UNSTOPPABLE" : n === 4 ? "LOCKED IN" : n === 3 ? "IN FLOW" : "ON A ROLL";
      /* the app floats the pill over the room just above its HUD; here that band is the board's own head row, which
         steps aside while the pill holds it */
      var head = $(".rb-head"), hb = head.getBoundingClientRect(), pb = ui.phone.getBoundingClientRect();
      ui.combo.style.top = Math.round(hb.top - pb.top + hb.height / 2 - 18) + "px";
      ui.combo.innerHTML = '<span class="rb-combo-pill rb-facet"><i class="rb-combo-glow"></i>' + icon("bolt_rounded") + word + " · ×" + n + "</span>";
      var pill = ui.combo.firstChild, still = reduced();
      root.classList.add("rb-head-away");
      run(1300, function (p) {
        var inP = (still ? easeOut : easeOutBack)(MB.clamp(p / 0.22, 0, 1)), out = MB.clamp((p - 0.72) / 0.28, 0, 1);
        pill.style.opacity = (still ? MB.clamp(p / 0.12, 0, 1) * (1 - out) : 1 - out).toFixed(3);
        if (!still) pill.style.transform = "translateY(" + (-out * 0.06 * 200).toFixed(1) + "px) scale(" + (0.7 + 0.3 * inP).toFixed(4) + ")";
        if (out > 0.2 && ui.lu.hidden) root.classList.remove("rb-head-away");
      }, function () { ui.combo.innerHTML = ""; if (ui.lu.hidden) root.classList.remove("rb-head-away"); });
    }

    /* ---------- the receipt (reward_receipt.dart) */
    function bubblesFor(b) {
      var out = [];
      if (b.firstOfDay) out.push({ t: "FIRST WIN TODAY", ic: "wb_twilight_rounded", c: C.streak, snd: "streak" });
      out.push({ t: "+" + b.xp + " XP" + (b.glimmers > 0 ? " · +" + b.glimmers + " Glimmers" : ""), ic: "bolt", c: C.xp, hero: true });
      out.push({ t: "+" + b.statGain + " " + b.abbr + (b.hasEvidence ? " · WHY" : ""), ic: "trending_up", c: STAT[b.stat].color, snd: "stat_" + STAT[b.stat].i, why: b.hasEvidence });
      if (b.streakMult != null) out.push({ t: "STREAK ×" + b.streakMult.toFixed(1), ic: "link_rounded", c: C.streak, snd: "streak" });
      if (b.comebackMult != null) out.push({ t: "WELCOME BACK ×" + b.comebackMult.toFixed(1), ic: "replay_rounded", c: C.streak, snd: "streak" });
      if (b.shieldHeld) out.push({ t: "STREAK FROZEN · " + b.freezesUsed + (b.freezesUsed === 1 ? " DAY" : " DAYS") + " HELD", ic: "ac_unit_rounded", c: C.info, snd: "streak" });
      if (b.freezeEarned) out.push({ t: "FREEZE BANKED · " + b.freezeBalanceAfter + " READY", ic: "ac_unit_rounded", c: C.info, snd: "streak" });
      out.push({ t: b.levelProgress, ic: "upgrade_rounded", c: C.xpLight });
      out.push({ t: b.message, wide: true });
      return out;
    }
    function receiptHTML(b, bub) {
      var hero = bub.filter(function (x) { return x.hero; })[0], compact = bub.filter(function (x) { return !x.hero && !x.wide; }).slice(0, 5);
      var goal = b.goalAfter ? "GOAL · " + b.goalTitle + " · " + b.goalAfter.progress + "/" + b.goalAfter.target : null;
      return '<div class="rb-glass rb-facet"><i class="rb-glass-fill"></i><i class="rb-glass-low"></i><div class="rb-r-head"><span class="rb-medal rb-facet">' + icon("done_rounded") + '</span>' +
        '<span class="rb-r-titles"><span class="rb-r-kick">QUEST COMPLETE</span><span class="rb-r-hero">' + esc(hero.t) + "</span></span>" +
        '<button class="rb-r-undo" type="button" aria-label="Swipe to undo">SWIPE TO UNDO</button></div>' +
        (goal ? '<p class="rb-r-goal">' + icon("route_rounded") + "<span>" + esc(goal) + "</span></p>" : "") +
        '<div class="rb-chips">' + compact.map(function (x) {
          var tag = x.why ? "button" : "span";
          return "<" + tag + ' class="rb-rchip rb-facet"' + (x.why ? ' type="button" aria-label="' + esc(x.t.replace(" · WHY", "")) + ', why this works"' : "") + ' style="--cc:' + x.c + '" data-i="' + bub.indexOf(x) + '">' +
            (x.why ? '<i class="rb-hit44" aria-hidden="true"></i>' : "") + icon(x.ic) + esc(x.t) + "</" + tag + ">";
        }).join("") + "</div>" +
        '<p class="rb-r-msg">' + esc(bub[bub.length - 1].t) + "</p>" +
        '<button class="rb-door rb-facet" type="button">' + icon("history_edu_rounded") + '<span class="grow">KEEP ONE LINE  ·  OPTIONAL</span>' + icon("chevron_right_rounded", "chev") + "</button></div>";
    }
    function openReceipt(b) {
      if (receipt) receipt.remove(true);
      var bub = bubblesFor(b), life = D(3000 + 85 * bub.length + 700), start = performance.now(), held = false, kept = false, heldAt = 0, focusPause = 0, gone = false;
      var el = document.createElement("div");
      el.className = "rb-receipt" + (reduced() ? "" : " is-in");
      el.innerHTML = receiptHTML(b, bub);
      el.querySelectorAll(".rb-rchip").forEach(function (ch) { if (+ch.getAttribute("data-i") > 0) ch.hidden = true; });
      /* the medallion's warm glow sits behind it, inside the glass */
      var medal = MB.$(".rb-medal", el); medal.insertAdjacentHTML("beforebegin", '<i class="rb-medal-glow"></i>');
      colHold = Math.max(colHold, ui.col.offsetHeight); holdHeight();
      ui.rail2.appendChild(el);
      /* the receipt takes the footer rail's place, as the app's covers the rail at the list's foot */
      root.classList.add("rb-receipt-up");
      var chipEls = MB.$$(".rb-rchip", el), undoBtn = MB.$(".rb-r-undo", el), door = MB.$(".rb-door", el);
      /* sounds and chips on each bubble's 85 ms beat */
      bub.forEach(function (x, i) {
        if (i === 0) return;
        later(function () {
          if (!receipt || receipt.el !== el) return;
          chipEls.forEach(function (ch) { if (+ch.getAttribute("data-i") <= i) ch.hidden = false; });
          if (x.snd) sfx.play(x.snd);
          emit("complete", "chip", b);
        }, reduced() ? 0 : 85 * i);
      });
      if (bub[0].snd) sfx.play(bub[0].snd);
      if (reduced()) chipEls.forEach(function (ch) { ch.hidden = false; });
      undoBtn.addEventListener("click", function () { if (!kept) doUndo(); });
      door.addEventListener("click", function () { if (!kept) openReflection(b); });
      chipEls.forEach(function (ch) { if (ch.tagName === "BUTTON") ch.addEventListener("click", function () { openWhy(b, ch); }); });
      el.addEventListener("focusin", function () { if (!focusPause) focusPause = performance.now(); });
      el.addEventListener("focusout", function (e) { if (focusPause && !el.contains(e.relatedTarget)) { start += performance.now() - focusPause; focusPause = 0; } });
      var r = {
        el: el, bundle: b,
        hold: function () { if (held) return; held = true; heldAt = performance.now(); el.classList.add("is-held"); },
        resume: function () { if (!held) return; held = false; start += performance.now() - heldAt; el.classList.remove("is-held"); },
        /* the board left the screen: the receipt takes its exit now instead of floating over the page */
        finish: function () { if (held || focusPause || gone) return; start = Math.min(start, performance.now() - (life - D(430))); },
        settle: function () { kept = true; undoBtn.textContent = "QUEST SETTLED"; undoBtn.disabled = true; door.classList.add("is-kept"); door.disabled = true;
          door.innerHTML = icon("bookmark_added_rounded") + '<span class="grow">ONE LINE KEPT IN JOURNAL</span>'; },
        remove: function (now) {
          gone = true;
          if (receipt === r) { receipt = null; root.classList.remove("rb-receipt-up"); colHold = 0; holdHeight(); }
          if (now || reduced()) { el.remove(); return; }
          el.classList.remove("is-in"); el.classList.add("is-out");
          setTimeout(function () { el.remove(); }, 440);
        }
      };
      receipt = r;
      function tick() {
        var now = performance.now();
        if (gone || receipt !== r) return false;
        if (held || focusPause) return true;
        var e = now - start;
        if (e >= life - D(430) && !el.classList.contains("is-out")) {
          if (!reduced()) { el.classList.remove("is-in"); el.classList.add("is-out"); }
          root.classList.remove("rb-receipt-up");
          emit("complete", "receipt-out", b);
        }
        if (e >= life) { r.remove(true); afterReceipt(b); return false; }
        return true;
      }
      addTicker(tick);
      return r;
    }
    /* The receipt and the sheets rise from one anchor at the foot of the column (.rb-rail-box, rod-board.css), which is
       sticky: it sits at the column's foot, or 12 px above the screen's foot when the column runs past the screen, as
       the app's receipt rises above its dock. Nothing scrolls the page for it: build 49 measures its featured card at
       the receipt, finds none (the finished quest is no longer featured) and leaves the list where it is. The anchor
       stays inside the board, so the receipt's controls follow the cards in the tab order. */
    /* after the receipt: a level-up, if the XP crossed the line (quests.dart _afterReceipt) */
    function afterReceipt() {
      if (!levelPending) return;
      levelPending = false;
      var res = eng.levelUp();
      if (res) showLevelUp(res);
    }

    /* ---------- a completion (quests.dart _runCompletion) */
    /* what the receipt says, for a screen reader, in the order the chips arrive */
    function announce(b) {
      var r = [];
      if (b.firstOfDay) r.push("first win today");
      r.push("+" + b.xp + " XP" + (b.glimmers > 0 ? ", +" + b.glimmers + " Glimmers" : ""));
      r.push("+" + b.statGain + " " + b.stat);
      if (b.streakMult != null) r.push("streak ×" + b.streakMult.toFixed(1));
      if (b.comebackMult != null) r.push("welcome back ×" + b.comebackMult.toFixed(1));
      if (b.shieldHeld) r.push("a streak freeze held " + b.freezesUsed + (b.freezesUsed === 1 ? " day" : " days"));
      if (b.freezeEarned) r.push("a freeze banked, " + b.freezeBalanceAfter + " ready");
      if (b.levelProgress) r.push(/READY/.test(b.levelProgress) ? b.levelProgress.replace(/LEVEL (\d+) READY/, "level $1 ready") : b.levelProgress.replace(" · LEVEL ", " to level "));
      return b.title + " complete. " + r.join(", ") + ". " + b.message;
    }
    function complete(qid) {
      if (!ready || eng.isDone(qid) || sheet || !ui.lu.hidden) return;
      warmed = "done"; /* a real completion needs no rehearsal */
      flushCommit();
      var k = cardOf[qid];
      var hadFocus = document.activeElement === k.plate || document.activeElement === k.hit;
      var wasHero = k.card.classList.contains("is-hero");
      var memo = { pinned: pinned, combo: combo, lastAt: lastAt, selected: selected };
      selected = qid;
      var b = eng.roll(qid);
      if (!b) return;
      undoMemo = memo;
      var still = reduced(), now = performance.now();
      combo = now - lastAt < 15000 ? combo + 1 : 1; lastAt = now;
      undoQuest = null;
      pinned = qid;
      sfx.play("complete"); sfx.duck(460);
      /* the board answers on the tap's frame, as build 49's setState does: the tapped featured card resolves in place
         (QuestCard _holdResolvedFeature: its size, its QUEST COMPLETE plate, no exits) until the commit; any other
         featured card becomes a row (the finished quest is the selection now, so nothing is featured); the list
         takes its order; the last of the three opens "Enough for today" */
      k.holdHero = wasHero;
      k.anim = { p: still ? 1 : 0 };
      var lastOfThree = eng.remaining() === 0;
      renderCards();
      applyOrder();
      if (lastOfThree) popEnough(still);
      /* the pressed control goes away with the open state; focus stays on the card it finished */
      if (hadFocus) k.card.focus({ preventScroll: true });
      /* the squash restarts without reading layout in this task (the class leaves on animationend; only a repeat inside
         its 180 ms forces the restart) */
      if (!still) { if (k.squash.classList.contains("is-squash")) { k.squash.classList.remove("is-squash"); void k.squash.offsetWidth; } k.squash.classList.add("is-squash"); }
      if (!still) run(460, function (p) { k.anim.p = p; drawRing(qid); }, function () { k.anim = null; drawRing(qid); });
      else { k.anim = null; drawRing(qid); }
      var keptIndex = eng.quests.length - eng.remaining() - 1;
      if (!still) run(520, function (p) { drawPips(keptIndex, easeOutCubic(p)); }); else drawPips(-1, 1);
      emit("complete", "tap", b);
      /* the thread and the embers leave from where the ring is once the board has answered (the app's tapPos is
         measured a frame earlier, so a row that moved left its thread behind on a neighbour's ring). They are placed in
         the next frame, whose layout the board needs anyway, so the tap's own task never waits on a layout. Under
         reduced motion the thread shows at once and fades (QuestCompletionStitch reduceMotion). */
      var runCombo = combo, stamp = pendingStamp = {};
      requestAnimationFrame(function () {
        if (pendingStamp !== stamp) return;
        fxBox();
        var from = fxPoint(k.ringBox, 0.5, 0.5), to = fxPoint(ui.xp.parentNode, 0.5, 1);
        addFx(new Stitch(from, to, b.xp, STAT[b.stat].color, still));
        if ((runCombo >= 2 || b.dread) && !still) {
          var boost = Math.min(runCombo - 1, 5);
          addFx(new Burst(from, [STAT[b.stat].color, C.xp, C.xpLight], Math.round(5 + 12 * b.magnitude) + boost * 3, 0.38 + b.magnitude + boost * 0.08, 90, false));
        }
        if (runCombo >= 2) comboPill(runCombo);
      });
      setStatus(announce(b));
      later(function () { openReceipt(b); emit("complete", "receipt", b); }, still ? 0 : 240);
      pendingCommit = { b: b, timer: later(flushCommit, still ? 0 : 520) };
      if (lastOfThree && clearedDay !== eng.state.day) {
        clearedDay = eng.state.day;
        later(function () {
          if (eng.remaining() !== 0) return;
          sfx.play("streak");
          var w = ui.phone.offsetWidth, h = ui.phone.offsetHeight;
          /* the wash stays over the board, as the app's stays over its own */
          if (!still) addFx(new Burst([w / 2 + PADL, h * 0.3 + PAD + 40], [C.xpLight, C.xp, C.streak], 34, 0.6, w * 0.85, false, [PADL, PAD + 40, w, h]));
          emit("complete", "wash", b);
        }, still ? 0 : 720);
      }
      ui.reset.hidden = false;
    }
    var pendingCommit = null, pendingStamp = null;
    /* XP, Glimmers, the stat and the streak are applied; the number rolls and the bar steps (quests.dart _flushCommit:
       the HUD's rail takes its new length on the commit's frame, and the number rolls up to it) */
    function flushCommit() {
      if (!pendingCommit) return;
      var pc = pendingCommit; pendingCommit = null;
      clearTimeout(pc.timer);
      var b = pc.b, s = eng.state;
      eng.commit(b);
      var next = QE.xpNeeded(s.level + 1), shown = Math.min(s.xp, next);
      rollNumber(ui.xp, shown, 650);
      setFill(Math.min(1, s.xp / next), false);
      statPulse(b.stat, s.stats[b.stat]);
      if (s.xp >= next) levelPending = true;
      undoQuest = b.quest;
      renderHud({ keepNumbers: true });
      emit("complete", "commit", b);
      settleBoard();
    }
    /* The commit (build 49's _offerUndo wraps the finished card for swipe-to-undo, which rebuilds it): a featured card
       that resolved in place becomes its compact done row in one step, and the rows below it come up with it. No
       frame ever shows the row's contents inside the featured card's box. */
    function settleBoard() {
      var held = eng.quests.filter(function (q) { return cardOf[q.id].holdHero; });
      held.forEach(function (q) { cardOf[q.id].holdHero = false; });
      renderCards();
      applyOrder();
      if (held.length) emit("complete", "settle", null);
    }
    /* "Enough for today" arrives at its full height and pops in (quests.dart: TweenAnimationBuilder, Motion.takeover
       700 ms, easeOutBack, opacity and scale .9 to 1), so the rows below take their places at once */
    function popEnough(still) {
      var li = ui.enough;
      if (still) { li.classList.remove("is-pop"); return; }
      /* it was hidden until now, so the animation starts as it first shows; only a repeat needs a restart */
      if (li.classList.contains("is-pop")) { li.classList.remove("is-pop"); void li.offsetWidth; }
      li.classList.add("is-pop");
    }

    /* ---------- undo: the full state from before the tap comes back (quests.dart _undoLast) */
    function doUndo() {
      if (!eng.canUndo) return;
      flushCommit();
      sfx.play("boing");
      cancelAll(); stopRunning(); clearFx();
      ui.combo.innerHTML = "";
      if (receipt) receipt.remove(false);
      closeSheet(true);
      var q = undoQuest;
      eng.undo(); undoQuest = null; levelPending = false; pendingCommit = null;
      clearMotion();
      if (q) selected = q;
      /* the pin and the run of clears go back too, so redoing a quest you undid is not praised as a new streak */
      if (undoMemo) { pinned = undoMemo.pinned; combo = undoMemo.combo; lastAt = undoMemo.lastAt; undoMemo = null; }
      if (eng.remaining() > 0 && clearedDay === eng.state.day) clearedDay = null;
      renderAll();
      var k = q && cardOf[q];
      if (k) (k.card.classList.contains("is-hero") ? k.plate : k.hit).focus({ preventScroll: true });
      setStatus("Undone. " + (q ? cardOf[q].li.querySelector(".rb-title").firstChild.textContent : "") + " is open again.");
      emit("undo", "", null);
    }

    /* swipe the just-finished card left past 42% of its width (Dismissible, dismissThresholds 0.42) */
    function bindCards() { eng.quests.forEach(function (q) {
      var k = cardOf[q.id], drag = null;
      k.card.addEventListener("pointerdown", function (e) {
        if (!k.card.classList.contains("can-undo") || e.button) return;
        drag = { x: e.clientX, y: e.clientY, dx: 0, h: null, id: e.pointerId };
      });
      k.card.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (drag.h === null) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.h = true; try { k.card.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ } k.card.classList.add("is-sliding"); }
          else if (Math.abs(dy) > 8) { drag = null; return; }
          else return;
        }
        drag.dx = dx < 0 ? dx : dx * 0.2;
        k.slide.style.transform = "translateX(" + drag.dx.toFixed(1) + "px)";
      });
      function end() {
        if (!drag) return;
        var d = drag; drag = null;
        k.card.classList.remove("is-sliding");
        k.slide.style.transform = "";
        if (d.h && -d.dx > k.card.offsetWidth * 0.42) doUndo();
      }
      k.card.addEventListener("pointerup", end);
      k.card.addEventListener("pointercancel", function () { drag = null; k.card.classList.remove("is-sliding"); k.slide.style.transform = ""; });
      k.undo.addEventListener("click", doUndo);
      k.undo.addEventListener("focus", function () { if (k.undo.matches(":focus-visible")) k.card.classList.add("is-reveal"); });
      k.undo.addEventListener("blur", function () { k.card.classList.remove("is-reveal"); });
      /* press: the plate drops 3 px under the finger; a compact row drops 4 (pressable.dart) */
      [[k.plate, "is-down"], [k.hit, null]].forEach(function (pair) {
        var btn = pair[0];
        btn.addEventListener("pointerdown", function (e) {
          if (e.button || btn.disabled) return;
          (pair[1] ? btn : k.card).classList.add("is-down");
        });
        var up = function () { btn.classList.remove("is-down"); k.card.classList.remove("is-down"); };
        btn.addEventListener("pointerup", up); btn.addEventListener("pointerleave", up); btn.addEventListener("pointercancel", up);
        btn.addEventListener("click", function () { up(); complete(q.id); });
      });
    }); }

    /* ---------- sheets in the column: WHY THIS WORKS, one line for the Journal, the night ledger */
    function openSheet(html, onOpen, onClose) {
      closeSheet(true);
      lastFocus = document.activeElement;
      ui.sheet.innerHTML = '<div class="rb-glass rb-facet"><i class="rb-glass-fill"></i><i class="rb-glass-low"></i>' + html + "</div>";
      ui.sheet.hidden = false;
      ui.sheet.classList.remove("is-in"); if (!reduced()) { void ui.sheet.offsetWidth; ui.sheet.classList.add("is-in"); }
      sheet = { onClose: onClose };
      if (onOpen) onOpen(ui.sheet);
    }
    function closeSheet(quiet) {
      if (!sheet) return;
      var s = sheet; sheet = null;
      ui.sheet.hidden = true; ui.sheet.innerHTML = "";
      if (s.onClose) s.onClose(quiet);
      if (!quiet && lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    }
    ui.sheet.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); closeSheet(false); return; }
      if (e.key !== "Tab") return;
      var f = MB.$$("button:not([disabled]), textarea", ui.sheet);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });

    function openWhy(b, chip) {
      var card = eng.evidence(b.stat);
      if (!card || !receipt) return;
      eng.markSeen(b.stat);
      var r = receipt; r.hold();
      openSheet('<p class="rb-sheet-kick">WHY THIS WORKS</p><h3 id="' + id + '-why">' + esc(card.title) + '</h3><p class="txt">' + esc(card.text) + "</p>" +
        '<p class="src">' + esc(card.source) + '</p><div class="rb-sheet-act"><button class="rb-textbtn" type="button" data-ok>GOT IT</button></div>',
        function (el) { el.setAttribute("aria-labelledby", id + "-why"); var ok = MB.$("[data-ok]", el); ok.addEventListener("click", function () { closeSheet(false); }); ok.focus({ preventScroll: true }); },
        function () {
          if (chip && chip.isConnected) { chip.textContent = ""; chip.insertAdjacentHTML("beforeend", icon("trending_up") + esc("+" + b.statGain + " " + b.abbr)); }
          if (receipt === r) r.resume();
        });
    }
    function openReflection(b) {
      if (!receipt) return;
      var r = receipt; r.hold();
      openSheet('<div class="rb-r-head"><span class="rb-medal rb-facet">' + icon("history_edu_rounded") + '</span><span class="rb-r-titles"><span class="rb-r-kick">ONE LINE, IF YOU WANT</span>' +
        '<span class="rb-r-title" id="' + id + '-ref">What made this work?</span></span><button class="rb-x" type="button" aria-label="Not now" data-x>' + icon("close_rounded") + "</button></div>" +
        '<p class="rb-prompt">A trick, person, place, or mood you may want the next time this quest comes around.</p>' +
        '<p class="rb-attached rb-facet">' + icon("link_rounded") + "<span>" + esc(b.title) + "</span></p>" +
        '<div class="rb-field rb-facet"><textarea class="rb-facet" maxlength="180" rows="2" placeholder="What do you want to remember?" aria-labelledby="' + id + '-ref"></textarea></div>' +
        '<span class="rb-count" data-count>0/180</span><button class="rb-honey" type="button" disabled data-keep>' + gold("KEEP IN JOURNAL", "bookmark_add_outlined") + "</button>",
        function (el) {
          el.setAttribute("aria-labelledby", id + "-ref");
          var ta = MB.$("textarea", el), keep = MB.$("[data-keep]", el), count = MB.$("[data-count]", el);
          ta.addEventListener("input", function () { keep.disabled = !ta.value.trim(); count.textContent = ta.value.length + "/180"; });
          ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && ta.value.trim()) { e.preventDefault(); keep.click(); } });
          MB.$("[data-x]", el).addEventListener("click", function () { closeSheet(false); });
          keep.addEventListener("click", function () {
            if (!ta.value.trim()) return;
            /* a kept line settles the completion: undo goes away (quests.dart _keepQuestReflection) */
            flushCommit(); eng.settle(); undoQuest = null; renderCards();
            r.settle(); sheet.saved = true;
            closeSheet(false);
            setStatus("One line kept in Journal. Quest settled.");
          });
          ta.focus({ preventScroll: true });
        },
        function () { if (receipt === r) r.resume(); });
    }

    /* the night: Close the ledger, then Goodnight and the next morning (routine_flows.dart, in one sheet) */
    function openNight() {
      if (sheet || !ui.lu.hidden) return;
      flushCommit();
      var s = eng.state, today = eng.quests.filter(function (q) { return eng.isDone(q.id); });
      var xp = s.todayXp, gains = Object.keys(s.todayStats).map(function (k) { return [k, s.todayStats[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
      openSheet('<p class="rb-sheet-kick" style="color:#f3ddae;opacity:.76">WHAT MOVED</p><h3 id="' + id + '-night">Close the ledger</h3>' +
        '<p class="rb-ledger-xp">+<span data-n>0</span> XP</p>' + (gains.length ? '<p class="rb-ledger-gains">' + gains.map(function (g) { return '<span style="color:' + STAT[g[0]].color + '">+' + g[1] + " " + QE.ABBR[g[0]] + "</span>"; }).join("") + "</p>" : '<p class="rb-ledger-quiet">the quiet days still count</p>') +
        '<p class="rb-sheet-kick" style="color:var(--lo)">' + countWord(today.length) + " THREAD" + (today.length === 1 ? "" : "S") + " FINISHED</p>" +
        '<ul class="rb-ledger-list">' + today.map(function (q) { return "<li>" + esc(q.title) + "</li>"; }).join("") + "</ul>" +
        '<button class="rb-honey" type="button" data-close>' + gold("CLOSE THE DAY", "nightlight_outlined") + '</button><div class="rb-sheet-act"><button class="rb-textbtn" type="button" data-x>NOT YET</button></div>',
        function (el) {
          el.setAttribute("aria-labelledby", id + "-night");
          var n = MB.$("[data-n]", el);
          if (reduced()) n.textContent = xp; else run(1050, function (p) { n.textContent = Math.round(xp * easeOutCubic(p)); });
          MB.$("[data-x]", el).addEventListener("click", function () { closeSheet(false); });
          var btn = MB.$("[data-close]", el); btn.focus({ preventScroll: true });
          btn.addEventListener("click", function () { eng.closeDay(); undoQuest = null; renderCards(); goodnight(); });
        });
    }
    function goodnight() {
      var line = eng.night();
      openSheet('<p class="rb-sheet-kick" style="color:#f3ddae;opacity:.76">THE DAY IS KEPT</p><h3 id="' + id + '-gn">Goodnight, Alex</h3><p class="txt"><em>' + esc(line) + "</em></p>" +
        '<button class="rb-honey" type="button" data-open>' + gold("OPEN THE DAY") + "</button>",
        function (el) {
          el.setAttribute("aria-labelledby", id + "-gn");
          var btn = MB.$("[data-open]", el); btn.focus({ preventScroll: true });
          btn.addEventListener("click", function () { closeSheet(true); self.nextDay(); var k = cardOf[featuredId()]; if (k) k.plate.focus({ preventScroll: true }); });
        });
    }
    if (ui.close) ui.close.addEventListener("click", openNight);
    ui.closeDay.addEventListener("click", openNight);

    /* ---------- the level-up takeover (levelup_overlay.dart): 1400 ms, then it waits for a tap */
    function showLevelUp(res) {
      var lu = ui.lu, still = reduced();
      lastFocus = document.activeElement;
      lu.setAttribute("aria-label", "Level " + res.level + " reached" + (res.unlock ? ". " + res.unlock + " unlocked" : "") + ". Activate to continue.");
      /* levelup_overlay.dart: the evidence line ("N quests since level L"), the unlock, NEXT, then SHARE THIS MOMENT
         and onward. Sharing is the app's; here it is drawn, not offered. */
      var since = res.questsSince != null && res.questsSince > 0 ? (res.questsSince === 1 ? "one quest" : res.questsSince + " quests") + " since level " + res.previousLevel : "";
      lu.innerHTML = '<div class="rb-lu-dim"></div><div class="rb-lu-in"><p class="rb-lu-kick">LEVEL UP</p><p class="rb-lu-yes">YOU DID IT.</p>' +
        '<div class="rb-lu-num"><span class="rb-lu-halo"></span><span class="rb-lu-diamond"></span><b>' + res.level + "</b></div>" +
        (since ? '<p class="rb-lu-since">' + esc(since) + "</p>" : "") +
        (res.unlock ? '<div class="rb-lu-unlock"><p><i></i><span>UNLOCKED</span><i></i></p><h4>' + esc(res.unlock) + "</h4></div>" : "") +
        (res.nextUnlock ? '<p class="rb-lu-next">NEXT · ' + esc(res.nextUnlock) + "</p>" : "") +
        '<p class="rb-lu-share" aria-hidden="true">' + icon("ios_share") + "SHARE THIS MOMENT</p>" +
        '<p class="rb-lu-onward">onward →</p></div>';
      lu.hidden = false;
      root.classList.add("rb-head-away");
      sfx.play("levelup");
      var dim = MB.$(".rb-lu-dim", lu), kick = MB.$(".rb-lu-kick", lu), yes = MB.$(".rb-lu-yes", lu), num = MB.$(".rb-lu-num", lu), halo = MB.$(".rb-lu-halo", lu);
      var late = MB.$$(".rb-lu-since, .rb-lu-unlock, .rb-lu-next, .rb-lu-share, .rb-lu-onward", lu);
      function frame(t) {
        var d = still ? 1 : interval(t, 0, 0.15, easeOut), slam = still ? 1 : interval(t, 0.1, 0.55, elasticOut);
        var enc = still ? 1 : interval(t, 0.08, 0.48, elasticOut), un = still ? 1 : interval(t, 0.55, 0.8, easeOutCubic);
        dim.style.opacity = d.toFixed(3); kick.style.opacity = d.toFixed(3);
        yes.style.opacity = MB.clamp(enc, 0, 1).toFixed(3); yes.style.transform = "scale(" + (0.58 + 0.42 * enc).toFixed(4) + ")";
        num.style.opacity = MB.clamp(slam, 0, 1).toFixed(3); num.style.transform = "scale(" + (0.4 + 0.6 * slam).toFixed(4) + ")";
        halo.style.opacity = MB.clamp(slam, 0, 1).toFixed(3);
        late.forEach(function (n) { n.style.opacity = un.toFixed(3); if (n.classList.contains("rb-lu-unlock")) n.style.transform = "translateY(" + (16 * (1 - un)).toFixed(1) + "px)"; });
      }
      frame(still ? 1 : 0);
      if (!still) {
        run(1400, frame);
        later(function () {
          /* the storm fires as the numeral lands, from the top of the diamond (the app's 40% of the screen sits there) */
          /* the numeral scales about its centre, so its centre is where the diamond will rest; its top point is 73 px up */
          var m = res.level % 5 === 0, o = fxPoint(num, 0.5, 0.5);
          /* the storm stays inside the takeover, which is the board's own box here, never over the page around it */
          var lr = lu.getBoundingClientRect(), pr = ui.phone.getBoundingClientRect();
          addFx(new Burst([o[0], o[1] - 66], [C.xpLight, C.cream, C.unlock], m ? 90 : 46, m ? 1 : 0.7, 160, false,
            [lr.left - pr.left + PADL, lr.top - pr.top + PAD + 40, lr.width, lr.height]));
        }, 380);
      }
      lu.focus({ preventScroll: true });
      setStatus("Level " + res.level + ". You did it.");
      emit("levelup", "", res);
    }
    function dismissLevelUp() {
      if (ui.lu.hidden) return;
      ui.lu.hidden = true; ui.lu.innerHTML = "";
      root.classList.remove("rb-head-away");
      var s = eng.state, next = QE.xpNeeded(s.level + 1);
      ui.level.textContent = s.level; ui.next.textContent = next;
      /* the bar refills with the overflow; the number rolls down to it (B03 in the reference renders) */
      setFill(0, false); void ui.rail.offsetWidth; setFill(Math.min(1, s.xp / next), true);
      rollNumber(ui.xp, Math.min(s.xp, next), 650);
      renderHud({ keepNumbers: true });
      if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    }
    ui.lu.addEventListener("click", dismissLevelUp);
    /* the takeover is modal: focus stays on it until it is dismissed */
    ui.lu.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); dismissLevelUp(); }
      else if (e.key === "Tab") { e.preventDefault(); ui.lu.focus({ preventScroll: true }); }
    });

    /* ---------- reactive light: the plate's reflection and the ready ring's bright point follow scroll and the pointer */
    var lastSweep = -1;
    function lightFrame() {
      if (!ready) return false;
      var r = MB.rect(ui.phone);
      if (r.bottom < 0 || r.top > MB.vh) return false;
      if (MB.pointer.active && !reduced()) {
        light.x = MB.clamp((MB.pointer.x - (r.left + r.width / 2)) / (MB.vw * 0.5), -1, 1);
        light.y = MB.clamp((MB.pointer.y - (r.top + r.height / 2)) / (MB.vh * 0.5), -1, 1);
      }
      var sw = reduced() ? 0.32 : lightSweep();
      if (Math.abs(sw - lastSweep) > 0.002) {
        lastSweep = sw;
        /* only the featured card's gold and its edge sheen take the light: a property on the board root would restyle
           every element under it on every frame */
        var f = featuredId();
        if (f) {
          var k = cardOf[f];
          if (!k.gold) { k.gold = MB.$(".rb-gold", k.li); k.gleam = MB.$(".rb-gleam", k.li); }
          k.gold.style.setProperty("--sweep", sw.toFixed(3));
          k.gleam.style.setProperty("--ph", (reduced() ? 0.22 : lightPhase()).toFixed(3));
          if (!k.anim) drawRing(f);
        }
      }
      return false;
    }
    MB.loop.add(lightFrame);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting && receipt) receipt.finish(); });
    }).observe(ui.phone);
    MB.onLayout(function () { fxBox(); holdHeight(); });

    /* ---------- the public face */
    /* everything in flight on the board goes back to rest: a held card, the popping panel */
    function clearMotion() {
      eng.quests.forEach(function (x) { var c = cardOf[x.id]; c.holdHero = false; c.anim = null; });
      ui.enough.classList.remove("is-pop");
      root.classList.remove("rb-head-away");
    }
    function hardReset(to) {
      cancelAll(); stopRunning(); clearFx(); closeSheet(true);
      if (receipt) receipt.remove(true);
      if (!ui.lu.hidden) { ui.lu.hidden = true; ui.lu.innerHTML = ""; }
      ui.combo.innerHTML = ""; pendingCommit = null; levelPending = false; undoQuest = null; selected = null; combo = 0; lastAt = -1e9; clearedDay = null;
      pinned = null; undoMemo = null;
      clearMotion();
      if (to !== undefined) eng.reset(to);
      renderAll();
    }
    ui.reset.addEventListener("click", function () {
      hardReset(null); eng.reset();
      renderAll();
      var k = cardOf[featuredId()]; if (k) k.plate.focus({ preventScroll: true });
      setStatus("Back to the account in the App Store screenshots.");
      emit("reset", "", null);
    });
    self.engine = eng;
    self.on = function (fn) { listeners.push(fn); };
    self.reset = function () { hardReset(null); eng.reset(); renderAll(); emit("reset", "", null); };
    self.nearLevel = function () { hardReset(null); eng.reset(QE.nearLevel()); renderAll(); emit("reset", "near", null); };
    /* opts.quiet: the page announces the day itself (the case page's day note), so the board stays silent */
    self.nextDay = function (opts) { hardReset(); eng.nextDay(); renderAll(); if (!(opts && opts.quiet)) setStatus("A new day. Today’s three are open again."); emit("day", "next", null); };
    self.skipDay = function (opts) { hardReset(); eng.skipDay(); renderAll(); if (!(opts && opts.quiet)) setStatus(eng.situation().covered ? "A quiet day. A streak freeze will hold it." : "A quiet stretch. Your return pays a welcome back."); emit("day", "skip", null); };
    self.complete = complete;
    self.undo = doUndo;
    root._board = self;
    /* the first paint of the numbers, canvases and measured heights runs in the next task, so building the board never
       makes one long task on a slow phone */
    /* each step lays itself out in its own short task (so the work never lands, all at once, in a scroll event) */
    var painted = false, wantShow = false;
    function firstPaint() {
      if (painted || !ready) return; painted = true; holdHeight(); fxBox(); if (wantShow) show();
      /* the warm-up has to be drawn to count, so it waits until the board is on screen (the case page builds its board
         below the fold), then for a quiet second: no pointer, wheel, touch, key or scroll, so it never lands on a frame
         the visitor is driving */
      var go = function () { whenQuiet(prewarm); };
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); } });
        io.observe(ui.phone);
      } else go();
    }
    /* The first completion on a fresh page used to stall for 125 to 175 ms just after the tap, the moment the check
       draws: the GPU meeting the finished card, the receipt and the canvas strokes for the first time. Once the board
       is idle, an invisible copy of each (1% opacity, behind the board, inert) is drawn for a few frames and removed,
       so the real first completion is answered at full speed. The copy also measures the receipt the column makes
       room for. */
    var warmed = false, lastInput = performance.now();
    ["pointermove", "pointerdown", "wheel", "touchstart", "keydown", "scroll"].forEach(function (n) {
      addEventListener(n, function () { lastInput = performance.now(); }, { passive: true, capture: true });
    });
    var idleCb = window.requestIdleCallback || function (f) { return setTimeout(function () { f({ timeRemaining: function () { return 8; } }); }, 60); };
    function whenQuiet(fn) {
      (function check() {
        var wait = 1000 - (performance.now() - lastInput);
        if (wait > 0) { setTimeout(check, wait + 30); return; }
        idleCb(function (d) { if (performance.now() - lastInput < 1000 || (d && d.timeRemaining && d.timeRemaining() < 6)) check(); else fn(); }, { timeout: 2000 });
      })();
    }
    function warmBox(full) {
      var q = eng.quests[0], base = { quest: q.id, title: q.title, xp: 26, glimmers: 8, statGain: 6, abbr: QE.ABBR[q.stat], stat: q.stat,
        hasEvidence: true, streakMult: 1.6, levelProgress: "560 XP · LEVEL 19", message: "Pages add up. Readers are dangerous people." };
      var goal = {}; Object.keys(base).forEach(function (n) { goal[n] = base[n]; });
      goal.goalAfter = { progress: 12, target: 25 }; goal.goalTitle = "Make the apartment feel calm";
      var box = document.createElement("div");
      box.className = "rb-warm"; box.setAttribute("aria-hidden", "true"); box.inert = true;
      box.innerHTML = (full ? '<ol class="rb-list">' + cards[0].replace(/ data-q="[^"]*"/, "") + "</ol>" : "") + '<div class="rb-receipt" data-w="a">' + receiptHTML(base, bubblesFor(base)) +
        '</div><div class="rb-receipt" data-w="b">' + receiptHTML(goal, bubblesFor(goal)) + "</div>" +
        '<div class="rb-enough is-on' + (full ? " is-pop" : "") + '">' + ui.enough.innerHTML + "</div>" +
        (full ? '<span class="rb-combo-pill rb-facet"><i class="rb-combo-glow"></i>' + icon("bolt_rounded") + "IN FLOW · ×3</span>" : "");
      MB.$$(".rb-medal", box).forEach(function (m) { m.insertAdjacentHTML("beforebegin", '<i class="rb-medal-glow"></i>'); });
      ui.phone.appendChild(box);
      return box;
    }
    /* the receipt and the day's end, measured once in the board's own build step, so the column's height is set
       before the board is first shown and never changes after */
    function measure() {
      var box = warmBox(false);
      var ra = MB.$('[data-w="a"]', box).offsetHeight, rb = MB.$('[data-w="b"]', box).offsetHeight, en = MB.$(".rb-enough", box).offsetHeight;
      if (ra > 100) receiptH = Math.max(ra, rb);
      if (en > 100) enoughH = en;
      box.remove();
    }
    function prewarm() {
      if (warmed || !ready || !painted) return;
      warmed = true;
      var q = eng.quests[0], box = warmBox(true);
      var card = MB.$(".rb-card", box), cv = MB.$(".rb-ring canvas", box), sq = MB.$(".rb-squash", box);
      /* the canvases share one GPU context: drawing every state once, at full strength on canvases nobody sees,
         is what readies it (a near-transparent stroke on the real overlay takes other paths) */
      var mk = function (cls) { var e = document.createElement("canvas"); e.className = cls; box.appendChild(e); return e; };
      var row = mk("rb-warm-c"), pipK = mk("rb-warm-c"), pipO = mk("rb-warm-c"), wfx = mk("rb-warm-c");
      fxBox();
      var wc = fit(wfx, fxSize[0], fxSize[1]), W = fxSize[0];
      var st = new Stitch([90, 330], [300, 90], 26, STAT[q.stat].color, false), s0 = performance.now();
      var bu = new Burst([90, 330], [STAT[q.stat].color, C.xp, C.xpLight, C.cream, C.unlock], 40, 1, 120, false), b0 = performance.now();
      var bw = new Burst([180, 200], [C.xpLight, C.xp, C.streak], 34, 0.6, 300, false, [20, 20, W - 40, 500]);
      var P = [0.02, 0.12, 0.3, 0.5, 0.7, 0.86, 1], i = 0;
      card.classList.add("is-hero");
      paintRing(cv, 48, { done: false, ready: true, p: 1, shine: 0.22, lx: 0, ly: 0 });
      paintRing(row, 40, { done: false, ready: true, p: 1, shine: 0.22, lx: 0, ly: 0 });
      function step() {
        var p = P[i];
        if (i === 1) { card.classList.add("is-done"); sq.classList.add("is-squash"); }
        paintRing(cv, 48, { done: true, ready: false, p: p, shine: 0.22, lx: 0, ly: 0 });
        paintRing(row, 40, { done: true, ready: false, p: p, shine: 0.22, lx: 0, ly: 0 });
        paintPip(pipK, "kept", p, i === P.length - 1); paintPip(pipO, "open", 1, false);
        wc.clearRect(0, 0, W, fxSize[1]);
        st.draw(wc, s0 + p * D(880), W); bu.draw(wc, b0 + p * D(850)); bw.draw(wc, b0 + p * D(850));
        if (++i >= P.length) { setTimeout(function () { box.remove(); }, 420); return; }
        /* the visitor moved (or a real completion began): the copy goes at once, and the rehearsal starts over at the
           next quiet second, so nothing of it lingers or animates while the page is being used */
        if (performance.now() - lastInput < 1000 || warmed === "done") {
          box.remove();
          if (warmed !== "done") { warmed = false; whenQuiet(prewarm); }
          return;
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(function () { requestAnimationFrame(step); });
    }
    /* the instrument waits undisplayed (no layout at all) until the first step shows it, one row per task */
    var hudParts = MB.$$(".rb-hud-top, .rb-hud .rb-hr, .rb-stats, .rb-day, .rb-foot", root);
    hudParts.forEach(function (n) { n.classList.add("rb-wait"); });
    function reveal(sel) { MB.$$(sel, root).forEach(function (n) { n.classList.remove("rb-wait"); }); void root.offsetHeight; }
    var steps = [
      function () { reveal(".rb-hud-top"); },
      function () { reveal(".rb-hud .rb-hr, .rb-stats"); },
      function () { reveal(".rb-day"); }
    ].concat(cards.map(function (html) {
      return function () { ui.list.insertAdjacentHTML("beforeend", html); void ui.list.offsetHeight; };
    }), [
      function () { linkCards(); bindCards(); ready = true; renderHud(); drawPips(-1, 1); void root.offsetHeight; },
      function () { renderCards(); void root.offsetHeight; },
      function () { reveal(".rb-foot"); },
      function () { if (ready) measure(); },
      firstPaint
    ]);
    function next() { var f = steps.shift(); if (!f) return; f(); setTimeout(next, 0); }
    /* the faces load first (at most 700 ms), so the board is laid out once, in its own fonts, and its numerals never swap
       in front of the visitor; the canvas thread's "+N XP" needs Fraunces too. The board fades in when built. */
    var started = false, start = function () { if (started) return; started = true; wantShow = true; setTimeout(next, 0); };
    var shown = false, show = function () { if (shown) return; if (!painted) { wantShow = true; return; } shown = true; root.classList.add("rb-ready"); };
    if (document.fonts && document.fonts.load) {
      Promise.all(['700 17px "Fraunces"', '600 15px "Fraunces"', '600 11px "JetBrains Mono"', '400 18px "EB Garamond"', 'italic 500 12px "Inter"'].map(function (f) { return document.fonts.load(f); })).then(start, start);
      setTimeout(start, 700);
    } else start();
  }

  MB.QuestBoard = { init: function (el) { return new Board(el); }, slow: function (n) { TS = Math.max(1, +n || 1); } };
  /* a board whose script arrived as it neared the screen (core.js [data-load-js], the homepage) is built in the next task,
     so evaluating this file and building the board never make one long task; a board loaded with the page (the case
     page, whose script reads el._board) is built at once */
  MB.$$("[data-quest]").forEach(function (el) {
    if (el.hasAttribute("data-load-js")) setTimeout(function () { MB.QuestBoard.init(el); }, 0);
    else MB.QuestBoard.init(el);
  });
})();
