# Into the Mind — project overview

**Live: https://krishamehta1600.github.io/**

The current map of the whole project, written 5 September 2026. Start here.

There are two older documents and both are partly stale. Where any of the three
disagree, **this file is right**; [what the older two still hold](#the-other-two-documents)
is listed at the bottom, because each still has material worth keeping.

---

## What it is

A portfolio in two documents and no framework.

An astronaut walks through the mind to a field of ten treasures, one per
project. It is a single video played in scroll-gated segments; when the last
segment ends the film hands over to a live page showing that same final frame,
with ten clickable hotspots on it, each opening a case study. A second page —
*Meet the Mind* — is the about page, a lit room with an illustrated character
in it who changes what she is doing while you read.

No build step, no dependencies, no bundler, no package.json. Two HTML files
carry their own markup, CSS and JavaScript. The only external request either
one makes is to Google Fonts.

## Run it

```bash
python3 -m http.server 8433
```

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
| `index.html` | The journey, the treasures page, and all ten case studies — 2,725 lines |
| `meet-the-mind.html` | The about page — 1,050 lines, self-contained |
| `assets/main.mp4` | The journey film — 5.8 MB, 1920×1080, 23.976 fps, 14.31 s |
| `assets/poster.jpg` | The film's own first frame, so the poster is not a placeholder |
| `assets/bg/project.jpg` | The treasures plate — the high-res composite of the final frame |
| `assets/proj/<id>.webp` | The ten treasure silhouettes, used as **masks** (see below) |
| `assets/case/<id>/` | Each case study's imagery, plus one video for amarula |
| `assets/meet/` | The room plate, the four poses, and the design's orbs and sparkles |
| `assets/resume.png` | The CV — 1024×1536, opened in its own tab by all twelve Resume links |
| `assets/atmosphere.js` | The journey's particle field, scroll- and film-reactive |
| `assets/splash-cursor.js` | The fluid cursor, shared by the treasures page and Meet the Mind |
| `assets/firefly-cursor.js` | The firefly cursor, the case studies' own — the trail, and the head that stands in for the arrow |
| `tools/treasures.py` | Rebuilds the plate; needs Pillow, NumPy and OpenCV |
| `tools/lastframe*.png` | The pipeline's source frames, kept out of the video's way |
| `index-parallax-backup.html` | Superseded image-parallax version, kept for reference |

Working tree ≈ 74 MB, of which `assets/case` is 41 MB. `.git` is another 133 MB,
mostly the history of the film before it was compressed.

---

## The journey — `index.html`

### The film and its stops

- `FPS = 24000 / 1001` at [index.html:2070](index.html:2070) **must match the
  file**. A previous cut was exactly 24 fps and this constant changed with it.
- Boundaries are absolute timecodes into this exact file, written as `at(s, f)`
  — four stops at **00:04:10 · 00:07:06 · 00:08:16 · 00:11:03**, ending on
  `PROJECT_FRAME = at(14, 3)`.
- `at()` replaced an earlier `tc()` that read a timecode as `s + f/FPS`. That is
  not what a timecode means: it counts 24 frames to the second even on a 23.976
  timeline, so every boundary fell a frame short. `at()` also adds the
  half-frame that puts each boundary inside its own frame's display interval.
- Scroll is ignored while a segment plays. The journey is forward-only and there
  is no way back from the treasures page — arriving is the end of it.
- Autoplay runs muted, per browser policy. The Sound button unmutes.

### The handover

The treasures page is **not** a frame of the video. `assets/bg/project.jpg` is a
separately composed 1920×1080 plate carrying the ten treasures at full detail —
the same shot from the same camera, re-rendered, not re-framed. That it is the
same camera was measured, not assumed: each cutout template-matches into the
plate at 0.82–0.93 normalised cross-correlation, within a few pixels of where
the same box sits in the video, so the `HOTSPOTS` boxes carry over unchanged.

The background still differs from the nearest video frame by 24.7/255 even after
per-channel grade matching — a higher-detail render, not a compression artefact.
That is why the handover is a **~400 ms dissolve** rather than the near-cut it
once was: the same shot resolving into detail, which is what it is.

It is drawn in the same 1920×1080 world and cover-fit the same way, so nothing
rescales or reframes across the handover.

### What `assets/proj/*.webp` is actually for

The ten WebP files are **not drawn as imagery** — and, contrary to the older
notes, they are **not unreferenced either**. Each is loaded as a CSS
`mask-image` at [index.html:2253](index.html:2253): a `.treasure` div re-draws
the plate, cut to that one treasure's silhouette and pinned so its pixels land
exactly where the plate's own already are. That is what lets one treasure
brighten on hover while the rest of the scene dims.

The mask is unpadded (`MASK_PAD = 1`) on purpose. Padding seemed safer against a
pixel of misalignment, but the padding is background, the overlay sits above the
dim, and the overlay is brightened — so the pad came back as a bright
rectangular halo around every treasure. Unpadded, a misalignment costs a sliver
of the original's rim instead.

`HOTSPOTS` entries carry two boxes: `box` is the click target, `art` is where
the treasure actually sits in the frame. `art` drives both the mask geometry and
the centre the case-study zoom flies into, so it cannot be deleted.

### If the film never arrives

Every route into this portfolio runs through those fourteen seconds, so a video
that fails takes the whole site with it — a black page, no prompt, nothing to
click, no way to the work. Three defences, all at
[index.html:2428](index.html:2428) onward:

1. **It errors, or fifteen seconds pass with nothing decodable.** The first
   frame needs only the head of the file, so that long without one means it is
   not coming. `rescueToTreasures()` abandons the journey and opens the
   treasures directly. Better to lose the entrance than the building.
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
a backgrounded tab keeps a muted video playing while rAF is throttled to
nothing.

### The fast track

A return visit offers to run the rest of the film at double speed and hand the
visitor straight to the treasures. Nothing is cut — every frame still plays,
nothing is seeked past, the counter keeps stepping.

- The flag (`km.journey.seen` in `localStorage`) is written **only where the
  journey actually ends**, so it records having been through the film rather
  than having been on the site. A deep link to `#treasures` never sets it.
- It is read once at load, not at each stop, or the offer could appear in the
  final moments of the very journey that earns it.
- The offer is on at the first two stops and gone from the third (`FAST_LAST_STOP
  = 1`): somebody still walking three stops in has chosen the walk, and a
  shortcut offered that late only asks them to reconsider.
- Storage that throws (private windows, blocked site data) simply yields the
  first-visit experience every time.

---

## Meet the Mind — `meet-the-mind.html`

Figma node `2431-4`, a 1280-wide frame. Every measurement in the file is that
frame's, expressed as a percentage, so the page scales as one drawing.

Sections: the hero (shuffling title, speech bubble), a philosophy pair, a facts
list beside the two-cities story, and a mailto call to action. Type is **Fraunces**
for display (with the design's SOFT and WONK axes driven from CSS rather than
pinned to instances) over Poppins for everything else.

### The character, and the rule that holds her together

The room is one plate (`assets/meet/hero-plate.jpg`, 934×1685) with the
character lifted out as four transparent PNGs layered over it: idle, wave,
writing, reach.

**The anchor invariant** ([:114](meet-the-mind.html:114)) is the thing to
understand before touching any of it. Every pose is placed so that **her
necklace lands on the same point in the room**, and scaled so that the
**crown-of-head → necklace distance is constant**. That is what stops her
jumping when she changes pose — not the canvas edges, which differ per drawing.
Placement lives in three CSS vars per pose: `--px` (left, % of cast width),
`--py` (top, % of cast **height**), `--pw` (width, % of cast width), on a
`.cast` of `aspect-ratio: 934 / 1685`.

**To add or replace a pose:** measure the two landmarks in the new art, then
solve for `--px/--py/--pw` that put them where the old pose had them. Do not
eyeball it. The rule was verified against all four existing poses and held to
±0.005 on necklace X and ±0.008 on crown→necklace.

### Three things that move in lockstep with a pose

None of these throw an error if missed — they fail silently and visually.

1. **The JS pose table** ([:686](meet-the-mind.html:686)) repeats each pose's
   L/T/W as decimals. CSS and JS both need them.
2. **`REGION`** ([:697](meet-the-mind.html:697)) mirrors the `.morph` canvas box
   in cast-width units, and is **not derived from the CSS**. Left stale, the
   morph particles settle at the wrong scale. `h` = the CSS height × `CAST_AR`
   (1685/934 ≈ 1.804068).
3. **The `.desk` band.** The plate is re-drawn masked to a narrow strip and
   raised in front of any pose flagged `cut: true`, to hide a drawing that runs
   off its own canvas mid-arm. The band spans 0.512–0.568 in cast-width units —
   so it will also cover anything a pose legitimately holds down there. **No
   pose sets `cut` today**; both that once did were replaced with complete art.

### The particle morph

A hard swap between two drawings this different reads as a glitch, so a
`<canvas class="morph">` samples each pose into ~7,000 particles that fly
between poses on hover. Sampling adapts to the image (it counts opaque pixels
first, then picks a step that lands near the target count), so a larger PNG
needs no code change — but the canvas box does have to be big enough to hold the
art plus scatter margin, and `REGION` has to follow it.

A morph must always end: the browser parks rAF in a hidden tab, so there is a
guard that completes the transition rather than leaving her mid-flight.

### Cache-busting convention

Assets replaced **in place at the same URL** carry `?v=N` — the film and poster
at [index.html:914](index.html:914), two poses at
[meet-the-mind.html:447](meet-the-mind.html:447). This is not decoration. A
browser holding the old file has no way to know it changed, and for video it is
worse than stale: media is fetched in ranges, so a client holding ranges of the
old file and asking for more gets bytes from a different file and decodes
nothing. Bump `N` whenever a file is overwritten rather than renamed.

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

They live **inside `index.html`** rather than in their own files, because the
open transition keeps zooming past the treasures page into the artifact — which
only works if both are in the same document. Each is one `<article class="cs
cs-NAME" data-case="NAME" hidden>`; `openCase()` unhides one and hides the rest.

Every Figma frame is 1280 wide and shares the same chrome, so the CSS states
that once and each case restates only its own palette (four custom properties)
and the geometry of its own collages. The collages are absolutely positioned in
Figma but are plain grids once the offsets are read, so they are grids here and
collapse to one column under 900px.

**README.md has the per-case detail** — wewe-uzuri's masonry, phonepe's per-row
slack, amarula's video and the three things that had to hold for it not to load
with the landing page, knorr's off-accent pill, the stasis padding that goes
negative on phones. That material is still accurate and is not repeated here.

### The cursor on a case study

The fluid belongs to the treasures page and is switched off here, so the case
studies had the native arrow and nothing competing for it. They carry fireflies
instead: a short trail behind the pointer, and one brighter light drawn *on* the
pointer, standing in for the arrow.

There is no route to mount it on — the ten case studies are articles in one
document — so it is built once beside the fluid at
[index.html:2115](index.html:2115) and switched by state one line below the
fluid's own toggle at [index.html:2558](index.html:2558). That is also why
case-to-case navigation cannot start a second loop: there is only ever one
instance and one rAF.

Three things about it that are easy to undo by accident:

1. **The head is not a particle.** It does not age or drift, and it is drawn on
   the exact pointer rather than eased toward it — it is what the visitor aims
   with. Only its halo wanders. It also swells over anything actionable, which
   is the affordance the arrow's pointing hand used to carry.
2. **`cursor: none` is gated on `.firefly-live`**, a class only the live
   controller sets, and scoped to `#casewrap` and `#caseback`. A touch device or
   a reduced-motion visitor gets an inert controller that never sets it, so they
   keep their arrow — and if the script fails to load, nothing is ever hidden.
   Widening that selector, or setting the class anywhere else, is how you end up
   with a page that has no cursor at all.
3. **The core is amber, not the cream it reads as.** On a dark page the halo
   swamps the difference, but over a white nav or a bright photo panel cream
   came within 37/255 of the paper and vanished. Page pixels cannot be sampled
   from a transparent canvas, so one colour that works on both is chosen once
   rather than adapted per frame.

Count is `speed / GATE * lifetime`, held under `MAX`. Both sit at the end of
their range that gives fewer, which is the whole intent: noticed when looked
for, invisible while reading.

---

## Weight

| | |
| --- | --- |
| `assets/case` | 41 MB across ten folders |
| `assets/meet` | 6.5 MB — 5.8 MB of that is four pose PNGs, two of them redrawn |
| `assets/bg` | 6.1 MB |
| `assets/main.mp4` | 5.8 MB (was 26.4 MB) |
| `index.html` | 168 KB |

The film was re-encoded from 15 Mbps to 3.2 Mbps H.264 through AVFoundation
(there is no ffmpeg on this machine). Measured across four frames spread through
the film, mean absolute difference is **2.44/255** — under one percent — and the
frame the treasures page is built to match comes in at 3.72/255, handed over
across a 400 ms dissolve. Duration, frame rate and dimensions survived exactly,
and the moov atom stayed in front so it still streams.

**The case imagery is the open problem.** 150 image references, 117 of them
`loading="lazy"`; the 33 eager ones are the ten page backgrounds and the small
SVG icons. So the landing page does not ship 41 MB — but every case study is one
document, and the backgrounds alone are eager.

## Open items

- **The plate is still 1920×1080, so it is still upscaled.** The high-res
  composite fixed the treasures' *detail* — the Stasis ingredient lists and the
  Royal Sundaram letter body read now — but not the resolution. The world scales
  by `max(innerWidth/1920, innerHeight/1080)`, then by device pixel ratio, then
  by the parallax's `scale(1.03)`; on a Retina laptop that is roughly 1.6×.
  Beating it needs a plate larger than 1920×1080, and every still on hand is
  exactly that size.
- **The two new pose PNGs are 1.7 MB and 1.9 MB** and have not been recompressed
  — there is no pngquant, oxipng or cwebp on this machine.
- **In the waving pose there are now two pens**: the plate draws one on the desk
  and the new art brings its own. The plate's is half-hidden behind her forearm,
  which reads as a dark stub. Masking the plate's pen behind her would fix it.
- **Meet the Mind has no narrow-screen pass beyond the one breakpoint** at
  [:384](meet-the-mind.html:384), which crops the room to cover and moves the
  text off the desk.

## Replacing the video

The `art` boxes are in video-frame coordinates, so a new render invalidates all
ten. There is no single transform between renders — the scene is re-generated,
not re-framed.

1. Copy the file to `assets/main.mp4` and **bump the `?v=` on its URL**
2. Refresh `tools/lastframe.png` from its last frame, and
   `tools/lastframe-highres.png` from whatever high-res composite goes with the
   new render — the plate comes from the second, not the first
3. Set `FPS` to the file's actual rate and `PROJECT_FRAME` to the frame the
   plate was composed on
4. Re-derive the ten `art` boxes; `TREASURES` in `tools/treasures.py` and
   `HOTSPOTS` in `index.html` must agree
5. Re-run `tools/treasures.py`
6. Re-time the stops as `at(s, f)` against the new edit

Step 4 works by matching each source cutout into the frame across a range of
widths, masked by its own alpha. That found nine of ten at 0.94–0.99. It fails
on **Youlry** — a large flat red box degenerate-matches on any uniform patch,
scoring 0.20 even against edges — so that one is measured by hand.

Two things in `tools/treasures.py` worth not rediscovering: it reads
`tools/lastframe.png` rather than decoding the video (a finished composite was
once baked into the mp4's final frame, and the script would have erased
treasures out of its own output), and **WebP `method=6` is pathological on
partial alpha** — the Knorr cutout takes 613 s at method 6 versus 0.3 s at
method 4, for 6% more bytes. `METHOD = 4`.

---

## The other two documents

Both were written 3 September 2026 and neither knows the Meet the Mind page
exists — README lists it under "not built yet".

**`README.md`** — the fullest writing on the case studies, the Figma export
workflow, the Amarula video, and adding an eleventh case. All of that is still
accurate and is the reason to keep the file. Its account of the video and the
treasures page is superseded here, as is its "Replacing a treasure" section
(that 18px dilation erase pipeline only runs with `OVERLAY` on, and `DILATE` is
now 1).

**`PROJECT.md`** — a 3 September snapshot that corrected README on the video and
the handover, and is still right about both. Three things in it have since
changed:

- The film is **5.8 MB, not 26 MB**, and its URL carries `?v=3`
- `assets/proj/*.webp` are **not unreferenced** — they are the hover masks
- The video had no failure handling when it was written; it has three layers now

Worth folding all three into one file at some point. Three documents is one more
than anyone will keep current, which is how two of them drifted.
