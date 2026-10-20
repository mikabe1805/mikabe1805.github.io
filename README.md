# Mika Be: portfolio

The static site behind mikabe1805.github.io. It has no build step, no framework, no analytics and no requests to
other hosts: fonts are self-hosted and every script is a plain file.

The homepage is a hall with four doors. Each project is a room with its own light and material: Room of Days is
the app's firelit room, Kuiper TTS sits on daylit paper, Room Notes on slate grid paper under a cool lamp, and the
Knowsy Breadboard Lab on a breadboard bench at night. One glass material and one light system run through all of
them. Each room has a working piece of the project in it, and each project has a case page that goes further. The
hall's door lights arrive once on load, and the page ends back in the hall, at the four door sills.

## Preview

Serve the folder with any static server that supports HTTP Range requests, then open the printed address.

```sh
npx serve -l 8765 .
```

Range support matters for the audio: without it Chromium treats every clip as unseekable. `python -m http.server`
ignores Range, so there a seek plays the clip from the start; everything else works. The pages also open straight from the
file system, because no script is a module and nothing is fetched (only the font preloads and `404.html`, which uses
root-relative paths, need a server). Opened from `file://`, each page logs two CORS errors for the font
preloads; they are expected, and the fonts still load through `@font-face`.

## Structure

| Path | What it is |
|---|---|
| `index.html` | the homepage: the hall, then one room per project, then About and Contact |
| `projects/room-of-days.html`, `kuiper-tts.html`, `room-notes.html`, `knowsy.html` | the four case pages, each ending with the next room and a contact line |
| `404.html` | the hall again, with the four doors, for any missing URL |
| `assets/css/site.css` | tokens, the four worlds, type, glass and matte, controls, nav and every shared component |
| `assets/css/home.css` | the homepage composition (also loaded by `404.html` for the hall) |
| `assets/css/case-*.css` | one file per case page |
| `assets/css/noscript.css` | the fallback without JavaScript: a still of the room, native audio controls, all devices shown |
| `assets/js/core.js` | the shared layer: one animation scheduler, world light, reveals, the zoom dialog, the audio manager, the sound preference, content flags |
| `assets/js/depth-room.js`, `quest-engine.js`, `quest-ui.js`, `listen.js`, `notes.js`, `probe.js` | the components (below); `assets/css/rod-board.css` styles the Quest board |
| `assets/js/case-*.js` | one file per case page |
| `assets/js/data.js`, `data-kuiper-tts.js` | inlined data: waveform peaks, word timings, the Kuiper phrase cuts, the content flags |
| `assets/world/` | the room art, captures and App Store frames the homepage uses |
| `assets/room-of-days/`, `assets/room-notes/` | assets only those case pages use; Knowsy's are the `assets/knowsy-*.webp` files |
| `assets/social-preview.jpg`, `assets/social/` | link previews (1200 x 630) for the homepage and each case page |
| `assets/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | the icon; the ICO (16, 32 and 48 px) and the 180 px touch icon are rendered from the SVG |
| `audio/world/` | every clip the pages play: opt-in, never autoplayed, `preload="none"` until hover, focus or play |
| `audio/gaussian-v3.wav`, `mika_be_resume3.html` | kept so older links keep working (the résumé page uses its own two fonts in `assets/`) |
| `Mika-Be_Resume.pdf`, `kuiper-tts-paper.pdf` | the résumé, and the authors' manuscript of the Kuiper TTS paper |

Only `transform` and `opacity` animate. Light reacts to the pointer, scroll or tilt and never loops; the hearth fire
is the one loop, and it pauses offscreen and freezes under reduced motion. Reduced motion and reduced transparency
are both honored, and the site works with storage blocked.

## What each interaction is, and what it is not

### Room of Days

- **The room.** The app's own four depth planes and three fire frames, moved by the coefficients from the app's
  depth-room code, with its 900 ms hearth ignition and its fire crossfade. On a phone it can follow tilt after
  iOS asks for permission. It is a browser rebuild of the app's room, not the app and not a video.
- **Today's three.** The app's Quest board rebuilt for the browser: the HUD, three real quests from the account in the
  App Store screenshots (level 18, a 12-day streak, 3 streak freezes), and the app's completion sequence at its own
  timings. The ring closes with the app's completion sound, a gold thread carries the XP to the bar, a receipt lists
  what changed, the stat swells, and a swipe undoes it. The receipt's reward line ("+41 XP · +13 Glimmers" at its
  longest) reads in full at every width, from 320 px up. Its count of the day's wins covers only the board's own
  three quests, so on the first day the receipt for "Message someone I miss" carries the app's People line, and no
  receipt claims a fourth win. Keeping all three brings "Enough for today"; closing the day opens the next morning,
  and enough mornings reach a level-up. The numbers come from a JavaScript port of the app's reward formula, without
  critical hits or loot. The lines are the app's own; where its copy sweep in the 1.0.5 TestFlight builds reworded
  one, the board uses the new wording. It is not connected to any account and forgets everything on reload.
- **The case page** puts the same board under a slice of the room, with the beats of one completion lit as they play,
  controls to pass a day or skip one (a streak freeze holds it), a run one quest from level 19, the history sky ported
  from the app's history view, the six rooms with the app's fire set in each hearth, the App Store frames, the
  soundtrack "Lamp left on" and the app's tap and completion sounds. Sounds are off until asked for. "How it's built",
  linked from the top of the page, adds two engineering stories: four tests that failed only in the cloud (three under
  UTC, one layout check on a Mac), and a backup size check that counted UTF-16 code units where Firestore counts UTF-8
  bytes.

### Kuiper TTS

- **Two readings of the same equation.** Saved recordings of the pipeline's literal narration and of the rewritten
  narration, both read by the public Piper voice `en_US-lessac-medium` (not Mika's voice). Words light at their
  start times, transcribed locally with faster-whisper, and the phrases the rewrite changed are underlined. Nothing
  is synthesized in the browser.
- **A voice trained on his own recordings.** Saved clips from versions 3 and 5 of his trained voice.
- **The case page** has four equations instead of three, and sets "Two readings" as a printed page: the two readings
  in two columns under small-caps heads, each waveform a numbered figure captioned with its length and render date,
  and the play controls as marks in the margin. The equation follows the voice, and each "Hear both" row plays the
  literal phrase and then the rewritten one, cut from the same two recordings. The pitch sketch is a labeled,
  exaggerated illustration, and the caching study shows the study's own nine test sentences.

### Room Notes

- **One page on three devices.** Renders of the code of TestFlight build 33, all from one page state, with sample
  content and scripted pen input; each capture is cropped to what its caption names. One device leads at a readable
  size (the iPad by default, the phone below 700 px) and the other two wait beside it. The tabs, or a click on a
  device beside the lead, bring another forward, and only the lead opens full size. Below 700 px only the lead
  shows; without JavaScript all three do. On the case page, pointing at the page on one device marks the same spot
  on the other two, using page rectangles measured from the captures and carried through the crops.
- **The pen-freeze pad.** A browser replay of a measured bug. On the homepage it shares one lit instrument with the
  erase grid, behind two tabs. In Build 30 mode, a stroke that starts after a pause
  of about two seconds (1.8 to 2.6 s) is held for 1,479 ms, the measured median, then inked; in Now mode it inks in
  the same frame. Other pauses are marked as outside the measured case. It is not the app's code, and the timing
  was measured in a desktop test of the app's real sync code against a simulated Firestore, not on an iPad. The
  code measured as Now is in TestFlight build 33.
- **The erase grid.** 2,000 dots, one per stroke of the test page, lit when a single erase re-records them: about
  1,000 in Build 30, about 30 now. The case page adds the 40 hard process kills with no acknowledged save lost.
- **The case page** also draws the save and sync loop as a diagram (one SQLite transaction, append-only operations,
  the echo, then the catalog merge, the step where Build 30's freeze sat), with a wide and a tall version so its
  labels stay readable. Its build 33 section shows three captures of what that build added (a typed equation's
  graph, an RC and op-amp circuit placed from the Components tray, the tray itself), with a note on how graphs and
  the new gates fit the existing block format without a migration.

### Knowsy Breadboard Lab

- **The probe.** A small sketch of the lab engine's net rule (four levels, strong and weak drivers) applied to the
  Lab 1 circuit, built for this site. Its meter readings (5.00, 0.00, 1.60 and 2.50 V) follow the lab's own
  probe. It is not the lab's solver, and no build of the lab is embedded.
- **The captures** come from the lab itself, loaded through its share links, with the Knowsy navbar cropped off.
  On the case page the probe bench leads with a capture of the real Lab 1 board for the current state: eight
  captures, one per probe state, each taken through a share link with only the switch, the pull-up and the stray
  wire changed. The capture crossfades as the toggles change, a ring marks the part that changed, and the caption,
  alt text and full-size view follow it; the sketch sits under it as an inset. The case page also adds spotlights on
  the Lab 1 capture, the list of all eight probe states, and one dot per auto-checked step across the 8 guided labs,
  counted from the lab's guide data.

## Where the assets come from

All art, captures and audio were copied or converted from Mika's own project folders, which were only read.
`assets/PROVENANCE.md` lists every file with its source path, size and the hash of its source; it stays out of the
repository (see `.gitignore`) because it names local paths.

- **Room of Days.** The room art (depth planes, fire frames, room plates) was made with an image model under
  Mika's art direction; the soundtrack and the interaction sounds were synthesized in code built to his brief.
  The App Store frames are the app's own production UI captures from build 1.0.4+39, converted to WebP; frame
  03 is left out.
- **Kuiper TTS.** The before-and-after clips were rendered with Mika's tex2tts tool and the public Piper voice
  `en_US-lessac-medium`; their text comes from the pipeline's manifests and the equations from the Friis paper's
  LaTeX. The voice clips are Mika's trained voices (versions 3 and 5). Waveform peaks and word timings were computed
  locally and are inlined in the data files.
- **Room Notes.** The lineup, the phone markup and Add material captures and the three build 33 captures are renders
  of the code of TestFlight build 33, with sample content and scripted pen input. The library and the half-adder
  notebook are renders from late September, and the half-adder review captures had their "LOCAL REVIEW" banner
  cropped.
- **Knowsy.** Captures of the local build of the lab, loaded through share links, including one per state of the
  case page's probe.
- **Icons.** `favicon.ico` and `apple-touch-icon.png` are rendered from `assets/favicon.svg`.
- **Fonts.** EB Garamond, Inter and JetBrains Mono for the site, and Instrument Serif and DM Sans for the older
  résumé page, all self-hosted under the SIL Open Font License (`assets/licenses/`).

## Checks

Before publishing, every page is checked with Playwright in Chromium and WebKit: behavior, reduced motion and
transparency, keyboard order and focus, overflow from 320 to 1920 px, page weight, long tasks under CPU throttling,
and link and file hygiene. Those suites, and the tools that rebuild the link previews, page metadata and provenance
table, live with the build outside this folder.
