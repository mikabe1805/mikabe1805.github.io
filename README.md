# Mika Be — portfolio

A static portfolio for applied AI, software systems, and computer engineering internships.

## Preview

Serve the repository with any static web server. For example:

```sh
python -m http.server 8765
```

Then open `http://localhost:8765`. No build, API key, account, or model service is needed.

## Structure

- `index.html`: homepage and selected work
- `projects/`: four project case studies
- `assets/site.css` and `assets/site.js`: responsive styles and small interactive behaviors
- `assets/project-demos.css` and `assets/project-demos.js`: the notebook, Quest, and voltage-divider examples
- `assets/`: project renders, paper preview, self-hosted fonts, favicon, and social preview
- `audio/gaussian-v3.wav`: saved Kuiper custom-voice example; not live inference
- `kuiper-tts-paper.pdf`: co-authored research paper
- `Mika-Be_Resume.pdf`: one-page, text-selectable résumé for applied AI, software systems, and computer engineering roles, built from `resume-src/`
- `Mika-Be_AI-Project-Portfolio.pdf`: four-page evidence packet for AI internship applications
- `mika_be_resume3.html`: semantic, mobile-friendly web résumé that preserves the previous URL

## Editing and deployment

The pages use relative paths and work on GitHub Pages. Check desktop and mobile layouts after changing content, especially long project titles, navigation, and the visual showcases. Preserve reduced-motion behavior and keyboard access to the mobile menu and equation examples.

Before publishing, review personal copy and the selected voice sample, then verify the deployed résumé, project pages, images, and audio. Keep research-paper claims separate from continued custom voice development. Do not add unverified usage, performance, or model-quality figures.

## Résumé

`resume-src/resume.html` is the print source for `Mika-Be_Resume.pdf`. Edit it, then rebuild:

```sh
node resume-src/build.mjs
```

The script uses Playwright's Chromium and warns if the content runs past one page. Add
`--focus simulation --out <file>.pdf` for a variant that leads with the circuit simulator and
simulation skills; open `resume-src/resume.html?focus=simulation` to preview it. The PDF embeds
static DM Sans instances (same OFL license) from `resume-src/fonts/` because Chromium writes variable fonts as
Type 3 glyphs, which some applicant tracking systems cannot read. Keep `mika_be_resume3.html`
in step with any content change.

## Assets

Project screens contain sample content. Instrument Serif and DM Sans are self-hosted under the SIL Open Font License; license notices are in `assets/licenses/`. The paper and its recognition are credited in the Kuiper TTS case study. The site has no analytics or external font requests.

## Homepage and captures

`assets/homepage.css` styles the introduction and project showcases. The homepage opens with
a compact evidence ledger, puts each project contribution beside its description, and links to
the fuller case study.

The Room Notes images were freshly rendered from the local app on September 7, 2026.
They show desktop text editing, an iPad ink page, phone import choices, and supplementary
editor states. Sample content is staged in the app; the iPad ink was drawn through scripted
stylus input. These images do not measure physical Pencil performance or camera hardware.

`assets/PROVENANCE.md` identifies each exact source, capture dimensions, and file hash.
The gallery supports keyboard navigation and full-size viewing; the image links also work
without JavaScript.

## Interactive spotlights

Room Notes has an editable note and a drawing area with ink colors, undo, and reset.
Room of Days demonstrates completing a sample Quest and undoing all of its rewards together.
Knowsy includes a 5 V voltage divider with adjustable resistors, computed output and current,
and a matching netlist. All three also appear on their respective case pages.

Real product captures are the default homepage state. The browser illustrations remain available
as optional, clearly labeled studies.

These are small browser illustrations, clearly labeled separately from the actual app
captures. They use temporary page state; they do not save notes, connect to user accounts,
or invoke the apps' backends. Switching between an example and its captures preserves the
example's state until the page reloads. The notebook supports pointer input and a keyboard
alternative for adding a curve. Tabs, reward controls, and circuit sliders support keyboard
operation. Motion respects reduced-motion settings.

The Quest uses a fixed reward example, not a prediction of the app's variable rewards.
The circuit solves the displayed resistor divider, not the full breadboard simulator.
Neither scripted touch input nor these examples establishes physical Pencil or hardware feel.
