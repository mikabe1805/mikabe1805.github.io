# Mika Be: portfolio

The static site behind mikabe1805.github.io. It has no build step, no framework, no analytics and no requests to
other hosts: fonts are self-hosted and every script is a plain file.

The homepage is a hall with four doors. Each project is a room with its own light and material: Room of Days is
the app's firelit room, Kuiper TTS sits on daylit paper, Room Notes on slate grid paper under a cool lamp, and the
Knowsy Breadboard Lab on a breadboard bench at night. One glass material and one light system run through all of
them. Each room has a working piece of the project in it, and each project has a case page that goes further.

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
| `projects/room-of-days.html`, `kuiper-tts.html`, `room-notes.html`, `knowsy.html` | the four case pages |
| `404.html` | the hall again, with the four doors, for any missing URL |
| `assets/css/site.css` | tokens, the four worlds, type, glass and matte, controls, nav and every shared component |
| `assets/css/home.css` | the homepage composition (also loaded by `404.html` for the hall) |
| `assets/css/case-*.css` | one file per case page |
| `assets/css/noscript.css` | the fallback without JavaScript: a still of the room, native audio controls, all devices shown |
| `assets/js/core.js` | the shared layer: one animation scheduler, world light, reveals, the zoom dialog, the audio manager, the sound preference, content flags |
| `assets/js/depth-room.js`, `quest-engine.js`, `quest-ui.js`, `listen.js`, `notes.js`, `probe.js` | the components (below) |
| `assets/js/case-*.js` | one file per case page |
| `assets/js/data.js`, `data-kuiper-tts.js` | inlined data: waveform peaks, word timings, the Kuiper phrase cuts, the content flags |
| `assets/world/` | the room art, captures and App Store frames the homepage uses |
| `assets/room-of-days/`, `assets/room-notes/` | assets only those case pages use; Knowsy's are the `assets/knowsy-*.webp` files |
| `assets/social-preview.jpg`, `assets/social/` | link previews (1200 x 630) for the homepage and each case page |
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
- **The Quest.** A JavaScript port of the app's reward formula, starting from the account in the App Store
  screenshots (level 18, a 12-day streak, 3 streak freezes, Mind 116). Completing the same Quest four times in a
  day pays 26, 13, 7 and 3 XP, and skipping a day shows a streak freeze at work. It leaves out critical hits and
  loot, is not connected to any account, and forgets everything on reload.
- **The case page** adds the engine's full state (level, the six stats with the app's rank names, streak, freezes,
  the last five passes), the history sky ported from the app's history view, the six rooms with the app's fire set
  in each hearth, the App Store frames, the soundtrack "Lamp left on" and the app's tap and completion sounds.
  Sounds are off until asked for.

### Kuiper TTS

- **Two readings of the same equation.** Saved recordings of the pipeline's literal narration and of the rewritten
  narration, both read by the public Piper voice `en_US-lessac-medium` (not Mika's voice). Words light at their
  start times, transcribed locally with faster-whisper, and the phrases the rewrite changed are underlined. Nothing
  is synthesized in the browser.
- **A voice trained on his own recordings.** Saved clips from versions 3 and 5 of his trained voice.
- **The case page** has five equations instead of three. The equation follows the voice, and each "Hear both" row
  plays the literal phrase and then the rewritten one, cut from the same two recordings. The pitch sketch is a
  labeled, exaggerated illustration, and the caching study shows the study's own nine test sentences.

### Room Notes

- **One page on three devices.** Renders from the current app with sample content and scripted pen input. On the
  case page, pointing at the page on one device marks the same spot on the other two, using page rectangles
  measured from the captures.
- **The pen-freeze pad.** A browser replay of a measured bug. On the homepage it shares one lit instrument with the
  erase grid, behind two tabs. In Build 30 mode, a stroke that starts after a pause
  of about two seconds (1.8 to 2.6 s) is held for 1,479 ms, the measured median, then inked; in Now mode it inks in
  the same frame. Other pauses are marked as outside the measured case. It is not the app's code, and the timing
  was measured in a desktop test of the app's real sync code against a simulated Firestore, not on an iPad.
- **The erase grid.** 2,000 dots, one per stroke of the test page, lit when a single erase re-records them: about
  1,000 in Build 30, about 30 now. The case page adds the 40 hard process kills with no acknowledged save lost.

### Knowsy Breadboard Lab

- **The probe.** A small sketch of the lab engine's net rule (four levels, strong and weak drivers) applied to the
  Lab 1 circuit, written for this site. Its meter readings (5.00, 0.00, 1.60 and 2.50 V) follow the lab's own
  probe. It is not the lab's solver, and no build of the lab is embedded.
- **The captures** come from the lab itself, loaded through its share links, with the Knowsy navbar cropped off.
  The case page adds spotlights on the Lab 1 capture, all eight
  probe states, and one dot per auto-checked step across the 8 guided labs, counted from the lab's guide data.

## Where the assets come from

All art, captures and audio were copied or converted from Mika's own project folders, which were only read.
`assets/PROVENANCE.md` lists every file with its source path, size and the hash of its source; it stays out of the
repository (see `.gitignore`) because it names local paths.

- **Room of Days.** The room art (depth planes, fire frames, room plates) was made with an image model under
  Mika's art direction; the soundtrack and the interaction sounds were synthesized in code written to his brief.
  The App Store frames are the app's own production UI captures from build 1.0.4+39, converted to WebP; frame
  03 is left out.
- **Kuiper TTS.** The before-and-after clips were rendered with Mika's tex2tts tool and the public Piper voice
  `en_US-lessac-medium`; their text comes from the pipeline's manifests and the equations from the Friis paper's
  LaTeX. The voice clips are Mika's trained voices (versions 3 and 5). Waveform peaks and word timings were computed
  locally and are inlined in the data files.
- **Room Notes.** Renders of the current app with sample content; the review captures had their "LOCAL REVIEW"
  banner cropped.
- **Knowsy.** Captures of the local build of the lab, loaded through share links.
- **Fonts.** EB Garamond, Inter and JetBrains Mono for the site, and Instrument Serif and DM Sans for the older
  résumé page, all self-hosted under the SIL Open Font License (`assets/licenses/`).

## Checks

Before publishing, every page is checked with Playwright in Chromium and WebKit: behavior, reduced motion and
transparency, keyboard order and focus, overflow from 320 to 1920 px, page weight, long tasks under CPU throttling,
and link and file hygiene. Those suites, and the tools that rebuild the link previews, page metadata and provenance
table, live with the build outside this folder.
