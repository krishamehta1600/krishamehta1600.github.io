# Into the Mind — the handbook

**Live: https://krishamehta1600.github.io/**

One document for the whole project, written 8 September 2026. It folds together
`README.md` (3 Sep), `PROJECT.md` (3 Sep) and `OVERVIEW.md` (5 Sep), and adds
the roaming ground that arrived today. Where any of the four disagree, **this
file is right**. The other three are kept for now and what each still uniquely
holds is listed at [the bottom](#the-three-older-documents).

---

## Contents

- [What it is](#what-it-is)
- [Run it](#run-it)
- [Layout](#layout)
- [The journey](#the-journey--indexhtml)
- [The treasures page](#the-treasures-page)
- [Phones held upright — roaming the ground](#phones-held-upright--roaming-the-ground)
- [The case studies](#the-case-studies)
- [Meet the Mind](#meet-the-mind--meet-the-mindhtml)
- [The resume, and the way back out of it](#the-resume-and-the-way-back-out-of-it)
- [The soundtrack](#the-soundtrack)
- [The two cursors](#the-two-cursors)
- [Weight](#weight)
- [Changing things](#changing-things)
- [Open items](#open-items)
- [The three older documents](#the-three-older-documents)

---

## What it is

A portfolio in three documents and no framework.

An astronaut walks through the mind to a field of ten treasures, one per
project. It is a single video played in scroll-gated segments; when the last
segment ends the film hands over to a live page showing that same final scene,
with ten clickable hotspots on it, each opening a case study. A second page —
*Meet the Mind* — is the about page, a lit room with an illustrated character in
it who changes what she is doing while you read. A third — `resume.html` — is a
viewer around the CV.

No build step, no dependencies, no bundler, no `package.json`. Each HTML file
carries its own markup, CSS and JavaScript; the shared JS is four plain scripts
in `assets/`. The only external request any page makes is to Google Fonts.

## Run it

```bash
python3 tools/serve.py
```

`http.server` is fine for looking at the site, but it does not answer `Range`
requests, and the rewind is nothing but seeks — on it, scrolling back snaps the
film to frame one instead of walking it. `tools/serve.py` is the same thing with
range support, which is what GitHub Pages does.

Then <http://localhost:8433>. `.claude/launch.json` runs that same command so
the editor can open it in a browser pane; nothing in the site depends on it and
GitHub Pages ignores it.

**One gotcha that will waste an afternoon:** `python3 -m http.server` has no
HTTP range support, so **video seeking silently fails** — `currentTime` resets
to 0. The player never seeks by design (segments are contiguous, playback just
resumes), so this does not bite in normal use. It will bite the moment anyone
adds a skip control. Use a range-capable server (`npx http-server`) for that.
GitHub Pages does support ranges.

## Layout

| Path | What |
| --- | --- |
| `index.html` | The journey, the treasures page, and all ten case studies — 2,977 lines |
| `meet-the-mind.html` | The about page — 1,056 lines, self-contained |
| `resume.html` | The CV viewer — 85 lines, and the only page that offers a way back |
| `assets/main.mp4` | The journey film — 5.8 MB, 1920×1080, 23.976 fps, 14.31 s |
| `assets/poster.jpg` | The film's own first frame, so the poster is not a placeholder |
| `assets/bg/project.jpg` | The wide treasures plate — 1920×1080, 727 KB |
| `assets/ui/explore-invite.png` | The instruction, desktop wording — 640×132 |
| `assets/ui/explore-invite-mobile.png` | The same, phone wording — 640×161, cropped from a 1536×1024 export |
| `assets/proj/<id>.webp` | The ten treasure silhouettes, used as **masks**, not imagery |
| `assets/case/<id>/` | Each case study's imagery, plus one video for amarula |
| `assets/meet/` | The room plate, the four poses, and the design's orbs and sparkles |
| `assets/resume.pdf` | The CV itself — 460 KB on a Letter page |
| `assets/resume-fallback.jpg` | The CV as an image, shown only where a PDF will not render inline |
| `assets/atmosphere.js` | The journey's particle field, scroll- and film-reactive |
| `assets/score.js` | The soundtrack — three cues off one piece of music, on the film's clock |
| `assets/audio/*.m4a` | The three cues — 436 KB of AAC in total |
| `assets/splash-cursor.js` | The fluid cursor, shared by the treasures page and Meet the Mind |
| `assets/firefly-cursor.js` | The firefly cursor, the case studies' own |
| `assets/ui/` | The explore instruction (two framings), Say hello, and the two retired scroll-prompt PNGs |
| `tools/treasures.py` | Rebuilds the wide plate; needs Pillow, NumPy and OpenCV |
| `tools/score.py` | Cuts the three audio cues out of the source track; macOS `afconvert` only |
| `tools/lastframe*.png` | The pipeline's source frames, kept out of the video's way |
| `index-parallax-backup.html` | Superseded image-parallax version, kept for reference |

Working tree ≈ 75 MB, of which `assets/case` is 41 MB. `.git` is another 141 MB,
mostly the history of the film before it was compressed.

---

## The journey — `index.html`

### The film and its stops

- `FPS = 24000 / 1001` **must match the file**. A previous cut was exactly 24 fps
  and this constant changed with it.
- Boundaries are absolute timecodes into this exact file, written as `at(s, f)`
  — four stops at **00:04:10 · 00:07:06 · 00:08:16 · 00:11:03**, ending on
  `PROJECT_FRAME = at(14, 3)`.
- `at()` replaced an earlier `tc()` that read a timecode as `s + f/FPS`. That is
  not what a timecode means: it counts 24 frames to the second even on a 23.976
  timeline, so every boundary fell a frame short. `at()` also adds the half-frame
  that puts each boundary inside its own frame's display interval.
- Scroll is ignored while a segment plays. Between segments it goes both ways:
  down to the next stop, up to the previous one, and up off the treasures page
  back into the film — see *Walking it back* below.
- Autoplay runs muted, per browser policy — and stays muted for good. The film's
  own audio track is 2.2 kbit/s of encoded silence, so there was never anything
  to unmute; the Sound button switches [the score](#the-soundtrack) instead.

### Walking it back

The journey used to run one way. It runs both ways now: at any stop, a scroll
up walks the film back to the previous stop and holds there, and doing it again
keeps going, stop by stop, to frame one — where the opening prompt comes back
and the next scroll down replays the first segment rather than skipping it
(`atStart`).

- **A `<video>` has no reverse gear.** `playbackRate` will not go negative in
  any shipping browser, so the film is paused and its clock is written backwards
  from `render()`: `stepRewind(dt)` walks a clock of its own down at 1.5x and
  seeks the element to it.
- **The clock is the rewind's own, not the element's.** A seek takes as long as
  it takes; stepping from `currentTime` would let a slow one drag the whole
  rewind out and a coalesced one stall it dead. Stepping from wall time means a
  busy moment costs dropped frames instead of a stuck film.
- **Seeks are rationed two ways.** Only one is in flight at a time
  (`journey.seeking`), and only one per film frame (`soughtFrame`) — this file
  carries a keyframe every two seconds, so every backward seek costs a decode
  from the keyframe in front of it and the cheapest one is the one not asked for.
- **`seg` does not move until the walk lands.** So a scroll *down* mid-rewind is
  just a change of mind: the film starts playing forward again and
  `checkBoundary()` catches it at the boundary it was walking back from.
- **The treasures are a destination, so leaving them asks for more.** Inside the
  film any upward scroll goes back; off the treasures page it takes a deliberate
  100px throw (`leavingBackwards`), gathered while the gesture is still running,
  so a grazed trackpad cannot pull the page out from under somebody reading it.
  On a phone that gesture is not available at all — a downward drag there is how
  the ground is roamed — so a phone leaves by the name in the corner.
- **The picture on that page is the film's last frame by construction**, however
  the visitor got there, so the walk back starts from `PROJECT_FRAME` rather
  than from `currentTime`. A `#treasures` deep link arrives with the video
  parked on frame one, and reading its clock would start the walk from the wrong
  end of the film. That link's hash is dropped on the way out, too.
- **The score's cues only fire forward** — each is entered when the film reaches
  the second it was cut for, and nothing un-enters one. `score.rewound(t)` is
  called once, where the walk lands, and stands the run down only if the film is
  now behind the cue that opened the phase it is in; `update()` then finds
  `idle` and rejoins at the second the film actually landed on, exactly as
  switching the score on part-way through already does. Rewinding *within* a
  phase resets nothing: that music is still the music for that second.
- **A rewind cancels the fast track.** Going back is a decision to walk it, so
  `fast` is cleared and the picture comes off double speed.

### If the film never arrives

Every route into this portfolio runs through those fourteen seconds, so a video
that fails takes the whole site with it — a black page, no prompt, nothing to
click, no way to the work. Three defences:

1. **It errors, or fifteen seconds pass with nothing decodable.** The first frame
   needs only the head of the file, so that long without one means it is not
   coming. `rescueToTreasures()` abandons the journey and opens the treasures
   directly. Better to lose the entrance than the building.
2. **It loads but will not start** — autoplay refused, a tab restored in the
   background, a browser wanting a gesture. The film is asked again every two
   seconds while it sits still, and the first input of any kind is taken as
   permission. Wired from the start rather than once trouble is detected: it
   costs nothing, and the input that would have rescued the page is often the
   very first one.
3. **Still sitting there after six seconds with the file ready.** The scroll
   prompt goes up — it is the one thing on screen that asks for an input, and
   any input starts the film.

The `ended` listener is a backstop for a starved rAF, which is not hypothetical:
a backgrounded tab keeps a muted video playing while rAF is throttled to nothing.

### The fast track

A return visit offers to run the rest of the film at double speed and hand the
visitor straight to the treasures. Nothing is cut — every frame still plays,
nothing is seeked past, the counter keeps stepping.

- The flag (`km.journey.seen` in `localStorage`) is written **only where the
  journey actually ends**, so it records having been through the film rather than
  having been on the site. A deep link to `#treasures` never sets it.
- It is read once at load, not at each stop, or the offer could appear in the
  final moments of the very journey that earns it.
- The offer is on at the first two stops and gone from the third
  (`FAST_LAST_STOP = 1`): somebody still walking three stops in has chosen the
  walk, and a shortcut offered that late only asks them to reconsider.
- Storage that throws (private windows, blocked site data) simply yields the
  first-visit experience every time.

---

## The treasures page

### The handover

The treasures page is **not** a frame of the video. `assets/bg/project.jpg` is a
separately composed 1920×1080 plate carrying the ten treasures at full detail —
the same shot from the same camera, re-rendered, not re-framed. That it is the
same camera was measured, not assumed: each cutout template-matches into the
plate at 0.82–0.93 normalised cross-correlation, within a few pixels of where the
same box sits in the video, so the `HOTSPOTS` boxes carry over unchanged.

The background still differs from the nearest video frame by 24.7/255 even after
per-channel grade matching — a higher-detail render, not a compression artefact.
That is why the handover is a **~400 ms dissolve** rather than the near-cut it
once was: the same shot resolving into detail, which is what it is.

It is drawn in the same 1920×1080 world and cover-fit the same way, so nothing
rescales or reframes across the handover.

### The world, and how it is fitted

Everything on this page lives in a fixed-size `.world`, centred in `#stage` and
scaled by JS to fit the viewport. The world's own size is written once, as two
custom properties:

```css
.world { --ww: 1920px; --wh: 1080px; width: var(--ww); height: var(--wh); }
```

The plate and the fit maths both read those. There is one framing on every
screen; a phone [roams it](#phones-held-upright--roaming-the-ground) rather than
being handed a different one.

Hotspots are absolutely positioned divs in world-pixel coordinates, appended into
the **parallax layer** rather than the frame, so they never drift from the art
when it moves. `#stage` is `pointer-events: none` and the hotspots opt back in,
so only they are clickable.

### What `assets/proj/*.webp` is actually for

The ten WebP files are **not drawn as imagery** — and, contrary to the older
notes, they are **not unreferenced either**. Each is loaded as a CSS `mask-image`:
a `.treasure` div re-draws the plate, cut to that one treasure's silhouette and
pinned so its pixels land exactly where the plate's own already are. That is what
lets one treasure brighten on hover while the rest of the scene dims
(`.proj-dim`).

The mask is unpadded (`MASK_PAD = 1`) on purpose. Padding seemed safer against a
pixel of misalignment, but the padding is background, the overlay sits above the
dim, and the overlay is brightened — so the pad came back as a bright rectangular
halo around every treasure. Unpadded, a misalignment costs a sliver of the
original's rim instead.

### The two boxes on a hotspot

`HOTSPOTS` entries carry two boxes, and neither is redundant:

| Key | Space | What it is |
| --- | --- | --- |
| `art` | 1920×1080 | Where the treasure actually sits. Drives the mask geometry and the centre the case-study zoom flies into |
| `box` | 1920×1080 | The click target — `art` inset 4% either side, so neighbours do not fight over the gaps |

There was a third, `mbox`, for a portrait-only plate. Both are gone; see
[roaming the ground](#phones-held-upright--roaming-the-ground).

### Opening a case study

`openCase()` scales the whole page up to 2.7× from a `transform-origin` computed
as the hotspot's centre expressed as a percentage of the world:

```js
const b = h.box;
const cx = (b[0] + b[2]) / 2 / WORLD_W * 100;
const cy = (b[1] + b[3]) / 2 / WORLD_H * 100;
```

The pan does not enter into it: `transform-origin` is resolved against the
element, and the pan rides on `#world` above it, so the zoom flies into the
treasure wherever the walk has left it on screen.

That is why the case studies live inside `index.html` — the transition keeps
zooming past the treasures page into the artifact, which only works if both are
in the same document.

---

## Phones held upright — roaming the ground

**The problem.** The wide plate is 16:9 and cover-fit. On a portrait phone that
crops the world to roughly the middle quarter of its width: PhonePe and Youlry,
the two treasures holding the outer edges, are not on screen at all, and there is
no way to reach them.

**The first fix, and why it was withdrawn.** A portrait phone was given a second
plate — `assets/bg/project-mobile.jpg`, the same scene recomposed at 941×1672
with the ten treasures rearranged into a column, contain-fit so all of it showed
at once. It solved the reach and broke the handover. **The treasures page is the
film's last frame**; that is the whole basis of the transition, which fades the
page up in place over the parked video and has nothing to reconcile because the
two pictures are the same picture. Arriving instead on a different composition
turned that into a cut, and it read as a glitch. The plate is still on disk and
referenced nowhere.

**The fix that stands.** One plate on every screen, cover-fit, exactly as the
desktop has it — and a phone reaches the rest of the frame by **dragging the
ground under it**. The handover is seamless again because the framing never
changes, and nothing is off limits because the world moves.

```js
const WORLD_W = 1920, WORLD_H = 1080;
const ROAM_QUERY = "(max-width: 1024px) and (pointer: coarse)";
let panX = 0, panY = 0, panMaxX = 0, panMaxY = 0;
```

`fitWorld()` computes the cover scale, derives how far the world overhangs the
screen on each axis, clamps the pan to that overhang, and writes both into one
transform:

```js
panMaxX = Math.max(0, (WORLD_W * s - innerWidth) / 2);
world.style.transform =
  `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${s})`;
```

At 375×812 that is a cover scale of `0.751852`, a world 1444 px wide, and
`panMaxX = 534` — about four screens of ground, and every one of the ten
treasures reachable inside the clamp.

Things about it that are easy to undo by accident:

1. **The pan rides in the same `translate` as the centring**, so it lands in the
   parent's pixels rather than the world's. A finger moving 10 px moves the
   ground 10 px, at any scale. Put it after the `scale` and it would be divided
   by it.
2. **The clamp is recomputed on every fit**, not once. A rotation changes the
   overhang and can otherwise strand the pan outside it.
3. **`#stage` only takes the gesture while the treasures are up.** It cannot be
   armed from load: `touch-action: none` on a full-screen fixed layer would
   swallow the scroll that walks the journey, and the world it panned would be
   the hidden one behind the film. The class is applied in the rAF loop, which
   already knows `onProject`.
4. **The stage needs `pointer-events: auto` for a drag to start on open sky.**
   That is safe because every control stacks above it — the navbar at `z-index:
   21`, the HUD at 20, a case study at 40 — and `#stage` has no `z-index` at all.
5. **`touch-action: none` is not optional.** Without it a sideways drag is a page
   scroll or the browser's own back-swipe, and the pan never sees a second move
   event.
6. **`fitWorld()` returns early on a zero-sized viewport.** A tab still being
   laid out reports `innerWidth === 0`, which would scale the world to nothing
   and leave a blank screen that only the next resize could undo.

**Tap versus drag.** They begin identically, so which one it was is decided on
the way out. Under `DRAG_SLOP = 8` pixels of travel it was a tap and the treasure
underneath opens; past that, the click the browser fires on release is swallowed
by a **capture-phase** listener on `#stage`, which runs before the hotspot's own
handler. The flag is cleared there rather than on `pointerup`, because the click
it exists to stop arrives after the release.

**The release throws.** `glide()` decays the velocity by 0.94 a frame and stops
under 0.2 px; if an axis hits the clamp it is zeroed rather than left grinding
against it for the rest of the throw.

**The query is `(max-width: 1024px) and (pointer: coarse)`** — small *and* touch.
A desktop window dragged narrow is still a desktop and keeps its hover; a tablet
is close enough to a phone to want the same gesture. Leaving roam resets the pan,
so the scene is not handed back to a large screen half walked off-centre.

**The instruction names the gesture.** A phone is told to drag, a desktop to
click, and `applyFraming()` swaps the picture *and* the alt text together:

```js
invite.src = roam ? "assets/ui/explore-invite-mobile.png"
                  : "assets/ui/explore-invite.png";
```

Neither `src` is written in the markup, the way neither plate's was, so each
screen fetches only the one it shows. This is also why `roam` starts as `null`
rather than `false`: a desktop starting at `false` would match on the first call,
skip the swap, and never be given its picture at all.

The phone artwork was cropped from a 1536×1024 export to the same proportional
framing the desktop one uses — body at 96.0% of image width, 79.8% of its height
— which put the crop at 1467×370, then downscaled to 640 wide. The downscale
averages **premultiplied** alpha; averaging straight RGBA darkens the glow's soft
edge where it fades out. The cropped full-res is kept beside the other sources as
`tools/explore-invite-mobile-source.png`.

**What came back.** The masked cutouts, the `.proj-dim` recede and the hover
lighting all work on a phone again, because they are measured against the wide
plate and the wide plate is what a phone now shows. Only the hover pill stays
off — a tap has no hover to hang it on. The astronaut's turn is still gated on
`(hover: hover) and (pointer: fine)` and so stays off on touch, as before.

**Verified at 375×812:** one plate fetched (`project.jpg`), cover scale
`0.751852`, all ten treasures panned into view, each tap hitting its own hotspot
and opening its own case study; a 200 px drag ending on a treasure opening
nothing; the throw clamping to exactly ±534. **Desktop at 1280×720 is untouched:**
`roam` false, no classes applied, `pointer-events: none`, `touch-action: auto`,
`panMaxX` 0, the hover pill still rendering.

---

## The case studies

All ten are built, each opened by clicking its artifact on the treasures page.
Each footer's "Step inside" points at the next, and phonepe points back at wipro,
so the chain is a closed loop.

| Artifact | Hash | Figma node | Title size |
| --- | --- | --- | --- |
| The office chair | `#wipro` | `2072-4` | 80 |
| The maroon YOULRY jewellery box | `#youlry` | `2093-4` | 96 |
| The WEWE UZURI magazine | `#wewe-uzuri` | `2108-4` | 96 |
| The pair of Stasis bottles | `#stasis` | `2142-4` | 96 |
| The carved TCS stone | `#tcs` | `2177-4` | 88 |
| The framed Godrej HOMES sign | `#godrej` | `2204-4` | 80 |
| The Royal Sundaram letter | `#royal-sundaram` | `2214-4` | 96 |
| The Knorr billboard | `#knorr` | `2230-4` | 96 |
| The Amarula bottle | `#amarula` | `2247-4` | 80 |
| The PhonePe handset | `#phonepe` | `2264-4` | 80 |

The title size differs per frame and is easy to miss — the shared `.cs-title`
rule *is* the 80px wipro case, and every other frame overrides it.

Each is one `<article class="cs cs-NAME" data-case="NAME" hidden>`; `openCase()`
unhides one and hides the rest. Every Figma frame is 1280 wide and shares the same
chrome, so the CSS states that once and each case restates only its own palette
(four custom properties) and the geometry of its own collages. The collages are
absolutely positioned in Figma but are plain grids once the offsets are read, so
they are grids here and collapse to one column under 900px.

Four of them have something specific worth knowing:

- **wewe-uzuri** is absolutely positioned throughout rather than stacked, so its
  section order comes from reading the `top` values. Between y=1395 and y=2914 its
  spreads form a two-column masonry — the right column a tight 11px stack of four,
  the left three taller items spaced to match. `justify-content: space-between` on
  a stretched flex column reproduces that stagger without hard-coding any offsets,
  and degrades to a normal stack when the columns collapse. Its figures carry
  their proportions inline as `--ar`.
- **phonepe** is the most collage-like: each row carries its own column widths
  *and* its own right-hand slack, so the rows hold the horizontal padding rather
  than the sections. Every grid is `.pp-grid` plus a row modifier, so one rule
  reflows them all.
- **knorr** uses an off-accent pill, and **stasis** has padding that goes negative
  on phones.
- **amarula** is the only case with a second background image, and the only one
  with **video**. That video is 9.3 MB, so it must not load with the landing page.
  Three things have to hold together for that, and each one broke on the way:
  `preload="none"` alone is not enough (an `autoplay` attribute makes the browser
  fetch anyway, even while the article is `hidden`), so there is no `autoplay` —
  `openCase()` starts playback and `closeCase()` pauses it; playback cannot be
  started with rAF, which never fires in a backgrounded tab, so it uses `load()`
  plus `canplay`; and `play()` is ignored while the element is still
  `display:none`, so both the cold path (`canplay`) and the warm path
  (`readyState >= 2`, via `setTimeout`) have to land after `openCase()`'s unhide
  loop returns.

---

## Meet the Mind — `meet-the-mind.html`

Figma node `2431-4`, a 1280-wide frame. Every measurement in the file is that
frame's, expressed as a percentage, so the page scales as one drawing.

Sections: the hero (shuffling title, speech bubble), a philosophy pair, a facts
list beside the two-cities story, and a call to action. Type is **Fraunces** for
display (with the design's SOFT and WONK axes driven from CSS rather than pinned
to instances) over Poppins for everything else.

### The two contact routes on the site

Two destinations, three buttons. Gmail's compose at the foot of *Meet the Mind*,
and *Say hello* -- WhatsApp -- twice: in the bottom-left corner of the treasures,
and beside that Gmail button, since the end of *Meet the Mind* is where the page
asks anyway. The case studies' "emailer" sections are layout, with no address in
them. It goes to Gmail's compose (`mail.google.com/mail/?view=cm&fs=1&to=`), in a
new tab, rather than the `mailto:` it used to be.

That is a deliberate trade, taken with its cost understood. A `mailto:` hands off
to whatever mail client the visitor's machine has registered, and where none is —
a laptop where Mail was never set up, a browser with no handler — it does nothing
whatsoever, silently, which is the worst way for a site's only contact route to
fail. The cost is that Gmail is now the destination for everyone. The address is
written on the face of the button either way, so it can always just be copied.

The treasures' button is the same idea in a different app. It is artwork
(`assets/ui/say-hello.png`, built by `tools/say-hello.py` from the source in
`tools/`) wrapped in an anchor to `wa.me`, which is WhatsApp's own click-to-chat
link: it hands off to the installed app where there is one and to
web.whatsapp.com where there is not. `whatsapp://` would have been the shorter
URL and the same silent nothing a `mailto:` is on a machine with no client. The
message opens with its first line already written, because the button sits at
the end of the work and can say where the visitor has just been better than they
can.

It is placed by the glass rather than by the file. The artwork carries its glow
as transparent margin — 4.8% of the width to the left of the pill, 16.5% of the
height below it — so the box is offset by exactly that much, which lands the
pill on the 36px/24px `#caseback` uses in the same corner -- the same place the
case studies' way back sits, and the Sound pill's own height off the foot of the
page before it leaves. It is switched on with the page like the nav is, so it is
absent from the film, from a case study (where `#caseback` wants that corner),
and from the walk back out.

On *Meet the Mind* the same button is in the flow rather than pinned to a corner:
that page scrolls, and a control fixed over a long read is in the way of the
reading. It sits in a `.cta-actions` row beside the mail button, sized so the two
pills are the same 70px tall, and the row's 28px gap is measured between the
glass rather than between the files -- the artwork's transparent glow is cropped
out of the layout box by negative margins, so the picture still paints in full
and the glow spills into the gap while the boxes line up. Below about 700px the
row wraps and they stack on the same left edge, 28px apart.

And a drag that *begins* on it is a drag: on a phone
the ground under it roams, and the treasures' own click suppressor lives on
`stage`, which never sees this anchor — so it carries its own, with the same
DRAG_SLOP.

### The character, and the rule that holds her together

The room is one plate (`assets/meet/hero-plate.jpg`, 934×1685) with the character
lifted out as four transparent PNGs layered over it: idle, wave, writing, reach.

**The anchor invariant** is the thing to understand before touching any of it.
Every pose is placed so that **her necklace lands on the same point in the room**,
and scaled so that the **crown-of-head → necklace distance is constant**. That is
what stops her jumping when she changes pose — not the canvas edges, which differ
per drawing. Placement lives in three CSS vars per pose: `--px` (left, % of cast
width), `--py` (top, % of cast **height**), `--pw` (width, % of cast width), on a
`.cast` of `aspect-ratio: 934 / 1685`.

**To add or replace a pose:** measure the two landmarks in the new art, then solve
for `--px/--py/--pw` that put them where the old pose had them. Do not eyeball it.
The rule was verified against all four existing poses and held to ±0.005 on
necklace X and ±0.008 on crown→necklace.

### Three things that move in lockstep with a pose

None of these throw an error if missed — they fail silently and visually.

1. **The JS pose table** repeats each pose's L/T/W as decimals. CSS and JS both
   need them.
2. **`REGION`** mirrors the `.morph` canvas box in cast-width units, and is **not
   derived from the CSS**. Left stale, the morph particles settle at the wrong
   scale. `h` = the CSS height × `CAST_AR` (1685/934 ≈ 1.804068).
3. **The `.desk` band.** The plate is re-drawn masked to a narrow strip and raised
   in front of any pose flagged `cut: true`, to hide a drawing that runs off its
   own canvas mid-arm. The band spans 0.512–0.568 in cast-width units — so it will
   also cover anything a pose legitimately holds down there. **No pose sets `cut`
   today**; both that once did were replaced with complete art.

### The particle morph

A hard swap between two drawings this different reads as a glitch, so a
`<canvas class="morph">` samples each pose into ~7,000 particles that fly between
poses on hover. Sampling adapts to the image (it counts opaque pixels first, then
picks a step that lands near the target count), so a larger PNG needs no code
change — but the canvas box does have to be big enough to hold the art plus
scatter margin, and `REGION` has to follow it.

A morph must always end: the browser parks rAF in a hidden tab, so there is a
guard that completes the transition rather than leaving her mid-flight.

---

## The resume, and the way back out of it

`resume.html` is a viewer wrapped around `assets/resume.pdf`: the site's own pill
top left for **Back**, a **Download PDF** beside it, Escape bound to the same
thing a case study binds it to, and the PDF below in the browser's native viewer
so its zoom, print and download all still work.

The PDF was rebuilt from the 1024×1536 artwork. The Photoshop export of the same
picture was 37 MB, flattened, with a page box of 1024×1536 **points**, so it
printed to nothing standard.

**It opens in the same tab, and that is the whole point.** The links used to be
`target="_blank"`, which is what made the resume a dead end: a tab opened that way
has no history, so the back button is inert in it, and `rel="noopener"` means the
page cannot call `window.close()` on itself either. The only exit was the tab's
own close button. Putting `target="_blank"` back on these links reintroduces
exactly that, and no amount of work inside `resume.html` can fix it from there.

### The `?from` contract

`history.back()` on its own is not enough, and the reason is easy to miss: **the
treasures page has no hash of its own.** `closeCase()` rewrites the URL to
`location.pathname`, and `toProject()` never adds one — so a visitor standing on
the treasures is at a bare `index.html`. Step back to that and the page has no
idea where they were, and replays all fourteen seconds of film to return them
somewhere they were already standing.

So the page that sends someone to the viewer names the way back, in `?from`:

| Where the link is | What `?from` carries | Set |
| --- | --- | --- |
| `#projnav`, on the treasures | `index.html#treasures` | at click, by JS |
| The ten case-study nav bars | `index.html#<case>` — the open one | at click, by JS |
| Meet the Mind's `#projnav` | `meet-the-mind.html` | in the markup |

The ten case bars and the treasures share one handler. It binds to
`a.resume-link` and rewrites the `href` **on click**, because which case is open
is only known then — it reads `openCaseId`, falling back to `treasures`. Meet the
Mind has no such states, so its link carries the value statically.

`resume.html` takes the first of three that applies:

1. a `?from` that passes validation — `location.replace()` to it;
2. otherwise `history.back()`, if there is any history to step through;
3. otherwise `index.html#treasures`.

What makes the returns land is the deep-link handling that already existed:
`initFromHash()` opens `#<case>` straight into that case study and `#treasures`
straight onto the treasures, pausing the journey rather than playing it. **`?from`
is only ever a hash that function already understands** — it adds no new routing,
and that is why it works.

### What a later change has to keep

- **Same tab.** See above. `target="_blank"` breaks the return outright.
- **The values stay hashes `initFromHash()` knows** — `#treasures`, or an id in
  `HOTSPOTS`. Invent a new one and Back lands on a page that ignores it.
- **The validation stays narrow.** `?from` is matched against
  `/^[\w.\-]+\.html(#[\w-]*)?$/` — a page on this site and nothing else. It is a
  URL from the query string being handed to `location.replace()`, so widening it
  to accept a scheme, a `//host`, or a path segment turns the viewer into an open
  redirect: a link could be dressed as this portfolio and bounce whoever clicked
  it somewhere else. Absolute URLs, protocol-relative ones, `javascript:` and
  `../` traversal are all rejected today, and each falls through to the safe
  default rather than failing.
- **`resume-link` is what the handler binds to.** A new Resume link without that
  class still opens the viewer; it just arrives with no `?from` and comes back by
  history instead, which on the treasures means the film.
- **The fallback stays inside the `<object>`.** It is there for iOS Safari, which
  will not render a PDF inline and would otherwise show a blank page; an
  `<object>` displays its children only when it cannot render its own data, so
  moving that image out shows it to everybody, always.

If the treasures page is ever given a real hash of its own, most of this collapses
to a plain `history.back()`. Until then, the naming is what carries it.

---

## The soundtrack

One piece of music — *Beneath the Abyss* — cut into three cues and scheduled
against `journey.currentTime`, never against a scroll position or a viewport test.
The page does not scroll, so the film's clock is the only clock there is; it is
also what lets a visitor stand at a stop for two minutes and hear the bed hold
rather than the score walk on without them.

| Cue | Out of the source | Lands on |
| --- | --- | --- |
| `landing.m4a` | 18.881 – 23.000 s | The riser and the low hit inside it. The hit is at 19.840 s in the source and 0.959 s into the clip, which is **frame 23**, the frame the astronaut's feet touch |
| `walk.m4a` | 30.450 – 42.690 s | The bed for the whole walk. Loops 1.80 → 12.24 s inside the clip; the 1.8 s before that is a one-shot lead-in, so the bed arrives rather than starts |
| `reveal.m4a` | 151.850 – 165.960 s | The bloom is 1.15 s into the clip and is put on **10.50 s**, where the tunnel gives way to the clouds. Loops 3.70 → 14.11 s, so the cloud world holds for as long as the visitor stands at the last stop |

The three cue points and the two visual ones were measured, not eyeballed. The
impact is where the source's sub-120 Hz band jumps from 2186 to 3899 RMS in one
30 ms window; the contact frame is the first frame carrying the landing flash
under the boots; the threshold is the frame the last tunnel arch leaves. Nothing
in the film was retimed for any of it — the picture is the master timeline and the
music was cut to fit it.

**Why the loops are whole phrases.** The track's phrase is ~10.43 s, found by
correlating three-band energy envelopes of a region against itself. Both looping
cues are one phrase long, and each carries a 0.70 s equal-power crossfade baked
into the end of its loop by `tools/score.py`: the last 0.70 s before the loop end
is a sin/cos blend of the material approaching the loop end with the material
approaching the loop start, which makes the sample before the wrap the sample
before the loop start. The join is continuous in the waveform, not just in the
phrasing.

**Why equal power everywhere.** Two uncorrelated passages crossfaded on linear
ramps dip about 3 dB in the middle, which is exactly the "three MP3s being
switched" sound this is meant not to have. Every handover — landing into bed, bed
into reveal, and the resolve onto the treasures page — is a sin/cos pair.

**Levels**, measured off the graph rather than guessed: the bed sits at about
−25 dBFS RMS, the impact at −21 and the reveal at −18, peaks no higher than −10.
An earlier pass had the bed at −29 behind a 3.4 kHz low-pass, which is atmospheric
to the point of being easy to miss on a laptop speaker — restrained is the brief,
inaudible is not. Scroll does not scrub the audio, it opens it — playing a segment
lifts the bed's gain and its low-pass a little (5.2 → 8 kHz), holding closes both,
travelling deeper adds a touch of each, all on 0.55 s chases. No pitch, no
playback rate, nothing that sounds like a timeline being dragged.

**Autoplay, and the thing that is easy to get wrong here.** A browser will only
take a short list of inputs as permission to play sound — `mousedown`,
`pointerdown`, `pointerup`, `touchend`, `keydown` — and **`wheel` is not on it**.
This journey is driven by the wheel, so a visitor on a trackpad can scroll the
whole way through without ever handing the page the one thing it needs. An unlock
that spends its single attempt on the first input therefore spends it on a scroll
and never comes back.

So `score.wake()` retries on *every* input rather than only the first, and
`firstInput` in `index.html` listens on six events rather than the film's four —
`pointerup` and `touchend` are there purely so the score has something it can use.
`arm()` is tried at load as well and works where the browser already trusts the
page (a return within the session, mostly); that is the path that gets the impact
on the contact frame, because by the time a first-time visitor scrolls, the film is
at 4.38 s and the astronaut landed three and a half seconds ago. In that case the
score opens on the bed and no thud is invented for a landing that has already
happened.

A refused `resume()` does not fail, it hangs -- Chrome leaves the promise pending
until the context is allowed to start -- so `asking`, which is cleared when the
promise settles, stays true from the first refusal for as long as the page is
open. Anything a browser counts as permission therefore **forces** past that
guard (`wake(activating)`, the `WAKERS_ACTIVATING` half of the list). Without
that, the first refusal swallowed every real gesture after it and the pill was
the only way in -- which is backwards, since the pill exists to turn the score
*off*.

None of which is a guarantee on a desktop trackpad, so **the Sound pill is the one
route that always works**, and it breathes (`#soundHud.waiting`, the scroll
prompt's own `hintPulse`) while the score is off and the journey is still running.

### The scroll prompt is typed, not drawn

It was artwork for a while — `scroll-hint-enter.png` and `scroll-hint-continue.png`,
a glass pill each — and the artwork was the problem. The prompt is an *instruction*,
not a control: the only clickable thing in that row is the fast track. Drawn as a
button it read as a second one competing with that, and it landed hard at the exact
moment the film stops dead, which made the stop feel like a jolt rather than the
scene going quiet.

So it is a line of tracked caps again (`.hint-line`), with the arrow drawn by a
`::before` so it cannot be selected or read out after the sentence that already
says it. Three things are load-bearing:

- **Two elements, not one whose text is rewritten.** The swap between "enter the
  mind" and "continue" happens while a fade is running, and rewriting
  `textContent` can be caught mid-word by it.
- **Two text-shadows**, for the reason the artwork carried two filters: the
  backdrop swings. The tight one keeps the lettering off a bright ground —
  0:11:03 stops on lit cloud, where pale pink on pale pink has almost nothing to
  separate it — and the wide one seats it over the dark tunnel stops.
- **The pulse floor is set by the worst ground it has to hold on**, which is that
  lit cloud, not the tunnel stops where anything would read. `.58` to `.9`: quiet
  enough to sit into the frame, awake enough to be noticed. The artwork breathed
  `.78` to `1`, because a button has to be seen; a line of type over a moving
  picture does not, and holding it that bright is what made it shout.

The row also arrives on a 7px rise rather than in place, so the prompt settles as
the film comes to rest instead of appearing on top of it. And it takes 370 KB of
PNG off the first load, which was being fetched before the film had a frame to
show. The two files are still in `assets/ui/`; nothing requests them.
It stops the moment there is sound, and it never reaches the treasures page at
all: the score is written against the film's timecodes and has resolved itself
to silence by the frame that page arrives on, so the pill would be an off switch
for something already off. It fades out with the film and comes back if the film
is walked back into. Its own
press is excluded from `wake()`: a press lands as a `pointerdown` before it lands
as a `click`, so without that guard the press would switch the score on and the
click would immediately switch it back off.

The preference lives in `sessionStorage` (`km.sound`): a soundtrack is a decision
about the next few minutes, not a setting, and it survives the reload the brand
link does without following anybody into tomorrow.

**The fast track** runs the picture at 2× and the music is not stretched to match,
so `update()` is handed `journey.playbackRate` and every crossfade length is
measured from the frame that fired it to the film second it has to be over by,
converted at that rate.

`?score=debug` logs what was scheduled and when; `score.inspect()` from the console
shows which cues decoded, where their first audible sample turned out to be, and
what is sounding. Both are silent otherwise.

**AAC priming.** Every asset starts with a tenth of a second of true silence, and
`score.js` finds the first sample over −48 dBFS rather than trusting the buffer to
start where the music does. Encoders add priming samples that some decoders hand
back and some swallow; without this the offsets in the table above would be ~48 ms
out on the decoders that do, which is a visible miss on an impact.

---

## The two cursors

The **fluid** (`splash-cursor.js`) belongs to the treasures page and Meet the
Mind. It is switched off inside a case study, which left the case studies with the
native arrow and nothing competing for it — so they carry **fireflies**
(`firefly-cursor.js`) instead: a short trail behind the pointer, and one brighter
light drawn *on* the pointer, standing in for the arrow.

There is no route to mount it on — the ten case studies are articles in one
document — so it is built once beside the fluid and switched by state one line
below the fluid's own toggle. That is also why case-to-case navigation cannot start
a second loop: there is only ever one instance and one rAF.

Three things about it that are easy to undo by accident:

1. **The head is not a particle.** It does not age or drift, and it is drawn on the
   exact pointer rather than eased toward it — it is what the visitor aims with.
   Only its halo wanders. It also swells over anything actionable, which is the
   affordance the arrow's pointing hand used to carry.
2. **`cursor: none` is gated on `.firefly-live`**, a class only the live controller
   sets, and scoped to `#casewrap` and `#caseback`. A touch device or a
   reduced-motion visitor gets an inert controller that never sets it, so they keep
   their arrow — and if the script fails to load, nothing is ever hidden. Widening
   that selector, or setting the class anywhere else, is how you end up with a page
   that has no cursor at all.
3. **The core is amber, not the cream it reads as.** On a dark page the halo swamps
   the difference, but over a white nav or a bright photo panel cream came within
   37/255 of the paper and vanished. Page pixels cannot be sampled from a
   transparent canvas, so one colour that works on both is chosen once rather than
   adapted per frame.

Count is `speed / GATE * lifetime`, held under `MAX`. Both sit at the end of their
range that gives fewer, which is the whole intent: noticed when looked for,
invisible while reading.

---

## Weight

| | |
| --- | --- |
| `assets/case` | 41 MB across ten folders (amarula 11 MB, stasis 5.4 MB, youlry 4.2 MB) |
| `assets/bg` | 6.7 MB |
| `assets/meet` | 6.5 MB — 5.8 MB of that is four pose PNGs, two of them redrawn |
| `assets/main.mp4` | 5.8 MB (was 26.4 MB) |
| `assets/cut` | 2.7 MB (used only by the backup parallax page) |
| `assets/proj` | 2.3 MB — the ten hover masks |
| `index.html` | 179 KB |
| `assets/audio` | 436 KB — 49 KB landing, 170 KB bed, 211 KB reveal, 128 kbit/s AAC |

The film was re-encoded from 15 Mbps to 3.2 Mbps H.264 through AVFoundation
(there is no ffmpeg on this machine). Measured across four frames spread through
the film, mean absolute difference is **2.44/255** — under one percent — and the
frame the treasures page is built to match comes in at 3.72/255, handed over across
a 400 ms dissolve. Duration, frame rate and dimensions survived exactly, and the
moov atom stayed in front so it still streams.

**The case imagery is the open problem.** 150 image references, 117 of them
`loading="lazy"`; the 33 eager ones are the ten page backgrounds and the small SVG
icons. So the landing page does not ship 41 MB — but every case study is one
document, and the backgrounds alone are eager.

---

## Changing things

### Cache-busting convention

Assets replaced **in place at the same URL** carry `?v=N` — the film and poster in
`index.html`, two poses in `meet-the-mind.html`. This is not decoration. A browser
holding the old file has no way to know it changed, and for video it is worse than
stale: media is fetched in ranges, so a client holding ranges of the old file and
asking for more gets bytes from a different file and decodes nothing. Bump `N`
whenever a file is overwritten rather than renamed.

### Replacing the video

The `art` boxes are in video-frame coordinates, so a new render invalidates all
ten. There is no single transform between renders — the scene is re-generated, not
re-framed, and per-treasure the best-fit scale ranges from 1.01 to 1.10.

1. Copy the file to `assets/main.mp4` and **bump the `?v=` on its URL**
2. Refresh `tools/lastframe.png` from its last frame, and
   `tools/lastframe-highres.png` from whatever high-res composite goes with the new
   render — the plate comes from the second, not the first
3. Set `FPS` to the file's actual rate and `PROJECT_FRAME` to the frame the plate
   was composed on
4. Re-derive the ten `art` boxes; `TREASURES` in `tools/treasures.py` and
   `HOTSPOTS` in `index.html` must agree
5. Re-run `tools/treasures.py`
6. Re-time the stops as `at(s, f)` against the new edit

There is no second plate to recompose any more; a phone roams this one.

Step 4 works by matching each source cutout into the frame across a range of
widths, masked by its own alpha. That found nine of ten at 0.94–0.99. It fails on
**Youlry** — a large flat red box degenerate-matches on any uniform patch, scoring
0.20 even against edges — so that one is measured by hand.

Two things in `tools/treasures.py` worth not rediscovering: it reads
`tools/lastframe.png` rather than decoding the video (a finished composite was once
baked into the mp4's final frame, and the script would have erased treasures out of
its own output), and **WebP `method=6` is pathological on partial alpha** — the
Knorr cutout takes 613 s at method 6 versus 0.3 s at method 4, for 6% more bytes.
`METHOD = 4`.

### Adding an eleventh case study

`README.md` still has the fullest account of the Figma export workflow. In short:
add the `HOTSPOTS` entry (both boxes, `art` and `box`), add the `<article class="cs cs-NAME" data-case="NAME" hidden>`, give
it its four palette properties, point the previous case's footer at it and its own
footer at wipro.

---

## Open items

- **The wide plate is still 1920×1080, so it is still upscaled.** The high-res
  composite fixed the treasures' *detail* — the Stasis ingredient lists and the
  Royal Sundaram letter body read now — but not the resolution. The world scales by
  `max(innerWidth/1920, innerHeight/1080)`, then by device pixel ratio, then by the
  parallax's `scale(1.03)`; on a Retina laptop that is roughly 1.6×. Beating it
  needs a plate larger than 1920×1080, and every still on hand is exactly that size.
- **A tap has no press state beyond the zoom itself.** A brief highlight would
  cost little, and matters more now that a tap competes with a drag.
- **`assets/bg/project-mobile.jpg` (627 KB) is on disk and referenced nowhere.**
  Kept for now in case the recomposition is wanted for something else; delete it
  and the repo loses the only copy.
- **The two new pose PNGs are 1.7 MB and 1.9 MB** and have not been recompressed —
  there is no pngquant, oxipng or cwebp on this machine.
- **In the waving pose there are now two pens**: the plate draws one on the desk and
  the new art brings its own. The plate's is half-hidden behind her forearm, which
  reads as a dark stub. Masking the plate's pen behind her would fix it.
- **Meet the Mind has no narrow-screen pass beyond its one breakpoint**, which crops
  the room to cover and moves the text off the desk.
- **Four documents is three more than anyone will keep current.** This one is meant
  to be the last; the other three should be retired once nothing points at them.

---

## The three older documents

**`OVERVIEW.md`** (5 September) — the immediate predecessor of this file and the
closest to it. Everything in it is folded in above except its own account of which
of README and PROJECT was stale, which this section replaces.

**`README.md`** (3 September) — the fullest writing on the Figma export workflow
and on adding an eleventh case, which is the reason to keep it. Its account of the
video and the treasures page is superseded here, as is its "Replacing a treasure"
section: that 18px dilation-erase pipeline only runs with `OVERLAY` on, and
`DILATE` is now 1. It also lists Meet the Mind under "not built yet".

**`PROJECT.md`** (3 September) — a snapshot that corrected README on the video and
the handover, and is still right about both. Three things in it have since changed:
the film is 5.8 MB, not 26 MB, and its URL carries `?v=3`; `assets/proj/*.webp` are
**not** unreferenced, they are the hover masks; and the video had no failure
handling when it was written.
