# Into the Mind — Portfolio

**Live: https://krishamehta1600.github.io/**

An astronaut journeys through the mind to a field of treasures (the projects).
One video, played in scroll-gated segments, ending on a clickable Project page.

## Run it

Any static file server works. From this folder:

```sh
python3 -m http.server 8433
```

`.claude/launch.json` runs that same command, so Claude Code can open the site
in its browser pane. It is a convenience only — nothing in the site depends on
it, and GitHub Pages ignores it.

Then open http://localhost:8433

## How it works

- `index.html` — the whole site (HTML/CSS/JS, no build step, no dependencies).
- `assets/main.mp4` — the full landing + scroll video. It autoplays to 0:04:06,
  then each scroll plays one segment (boundaries at 0:07:02, 0:08:08, 0:09:17,
  0:10:22, then to the end). Timecodes are seconds:frames @ 23.976 fps, defined
  in the `SEGMENTS` array in `index.html`.
- Scroll is ignored while a segment is playing (forward-only journey).
- The last frame *is* the Project page. `assets/bg/project.jpg` is literally
  that frame with the ten treasures erased out of it, at the video's own
  1920x1080 and cover-fit the same way, so the page and the frame under it are
  the same picture at the same size. When the final segment ends the page fades
  up in place — nothing rescales, nothing reframes, the treasures just resolve
  into their high-res selves and become clickable. There is no button and no
  way back to the journey: arriving is the end of it.
- Two things follow from the page being the frame. The astronaut is in the
  plate rather than a separate bobbing layer, because he is standing in the
  frame. And the parallax has to ease in from nothing (`liveT`) instead of
  applying at full strength, or the page would slide out from under the frame
  the moment it appeared.
- The video's last frame is never painted. `checkBoundary()` hands over
  `LAST_FRAME_LEAD` (2.5 frames, ~104ms) before the end, so the player stops a
  frame or two short and the page — which *is* that last frame, sharp — steps
  in as the next one. The shot moves 8–12/255 per frame right up to the end, so
  that step reads as one more frame of the same move. Firing early costs
  nothing; firing late costs the exact thing this is all for, hence 2.5 frames
  rather than 1: at 60Hz polling that leaves ~3.7 ticks of slack before the
  soft frame would reach the screen.
- And it is a cut, not a fade. A crossfade blends the page against the video
  underneath it, which shows as the low-res treasures ghosting through the
  sharp ones for as long as it runs — visible even at 85ms. There is nothing
  to ease between; the two pictures are the same frame.
- Both of those depend on the cutouts being decoded first, or the page would
  cut in showing the holes they fill. `artPainted` settles that during the
  journey (they load at normal priority and have all 13s), `checkBoundary()`
  will not hand over until it is true, and `ended` is the fallback for when the
  video ran out first.
- What none of this changes: the final segment is ~2.1s of the camera arriving,
  and the treasures are low-res for that shot because they are in the video.
  Bringing the page up any earlier does not work — it is a still, and it would
  ghost against the motion. Removing that needs the video's tail re-rendered
  against `assets/bg/project.jpg` plus the cutouts.
- `index-parallax-backup.html` — earlier version: image-based parallax journey
  with a persistent walking astronaut (kept for reference; uses `assets/bg/*`,
  `assets/cut/*`, `assets/video.mp4`, `assets/journey.mp4`).

## Assets

- `frames/` — original 2560×1664 PNG exports of the Figma frames
  (file X4313MZXnblmAef2MOlJhm). Source material; the live site doesn't load them.
- `assets/bg/` — 1920w backgrounds with the astronaut inpainted away. The one
  exception is `project.jpg`, which is not from this set at all: it is the last
  frame of `assets/main.mp4` with the ten treasures inpainted away, 1920x1080,
  astronaut included. Where a cutout sits, the plate underneath is an
  inpainting smear, so a *smaller* replacement cutout will expose the hole —
  re-run `tools/treasures.py`, which rebuilds the plate from the video, rather
  than shrinking a cutout by hand.
- `assets/cut/` — astronaut cutouts (auto-extracted with rembg).
- `assets/proj/<id>.webp` — the ten treasures on the Project page, as high-res
  transparent cutouts, so they stay sharp through the 2.7x zoom into a case
  study. Cropped to their alpha bounds, longest edge capped at 1400, WebP q76 —
  22 MB of PNG → 2.2 MB. Each one's `art` box in `HOTSPOTS` places it; those
  boxes are *not* the `box` click targets, which are looser and unrelated.
- `assets/layers.json` — astronaut bounding boxes per frame (1920×1248 space).
- `assets/case/<name>/` — each case study's imagery and, for amarula, one video, exported from its Figma
  node. The creatives are the 1080×1350 (and 1080×1080) social posts, re-encoded
  to JPEG — 20 MB of PNG → 2.9 MB for wipro, 4.2 MB for youlry — plus the page
  background and two 10px icons, which stay SVG. The icons differ per case (the
  brand dot and arrow are recoloured per palette), so they are not shared.

## Replacing a treasure

`tools/treasures.py` does the whole job: it crops the source PNGs to their alpha
bounds, writes `assets/proj/`, decodes the video's last frame, and rebuilds
`assets/bg/project.jpg` from it. Point `SRC` at the folder of PNGs and run it
(needs Pillow, NumPy and OpenCV — the site itself still has no dependencies).

The reason it erases rather than covers: the cutouts are re-renders of the
treasures, not upscales, so a new one never lands on the old one's silhouette.
Laying a cutout over the painted-in original leaves the original poking out
around it — the chair was the worst, a second chair in ghost form — and scaling
the cutout up until it swallowed the old one made it tower over its pedestal.
So the script dilates each cutout's alpha where the cutout sits, inpaints that
whole region out of the frame (OpenCV Telea, radius 12), feathers the result
back in, and index.html draws the cutouts over the holes. The dilation is what
has to clear the old silhouette; 18px does it for all ten.

The `art` boxes are in video-frame coordinates and were found by
template-matching each treasure into the frame one at a time. Do not try to fit
a single transform: the frame and the old 1920x1248 plate are the same scene,
but per-treasure the best-fit scale ranges from 1.01 to 1.10, so one global
mapping does not place all ten.

## Gotchas

- The live site is served by GitHub Pages from `main` at the repo root, which
  does support range requests — seeking works there if you ever add it.
- `python3 -m http.server` has no HTTP range support, so **video seeking
  silently fails** (currentTime resets to 0). The player deliberately never
  seeks — segments are contiguous and playback simply resumes. If you ever need
  seeking (e.g. a skip button), use a range-capable server (`npx http-server`,
  or any real host).
- Autoplay runs muted (browser policy); the Sound button unmutes.

## Case studies

All ten are built, each opened by clicking its artifact on the Project page.
Every artifact in the scene is now clickable, and each footer's "next project"
button points at the following case study — phonepe points back at wipro, so
the chain is a closed loop:

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
rule is the 80px wipro case, and every other frame overrides it.

They live inside `index.html` rather than in their own files, because the open
transition keeps zooming past the project page into the artifact — that only
works if both are in the same document. Each is one `<article class="cs cs-NAME"
data-case="NAME" hidden>`; `openCase()` unhides one and hides the rest.

Every Figma frame is 1280px wide and shares the same chrome — nav, header, text
cards, footer — so the CSS states that once and each case only restates its own
palette (four custom properties) and the geometry of its own photo collages.
Those collages are absolutely positioned in Figma, but each is a plain grid once
you read the offsets, so they are grids here and collapse to one column under
900px. Type is Instrument Serif + Geist from Google Fonts — the only external
request the site makes.

The wewe-uzuri frame is the awkward one: the whole page is absolutely positioned
rather than stacked, so its section order comes from reading the `top` values.
Between y=1395 and y=2914 its spreads form a two-column masonry — the right
column a tight 11px stack of four, the left three taller items spaced to match.
`justify-content: space-between` on a stretched flex column reproduces that
stagger without hard-coding any offsets, and degrades to a normal stack when the
columns collapse. Its figures carry their proportions inline as `--ar`, since
every spread in that frame is cropped to a different ratio.

The phonepe frame is the most collage-like: absolutely positioned throughout,
with each row carrying its own column widths *and* its own right-hand slack, so
the rows hold the horizontal padding rather than the sections. Every grid in it
is `.pp-grid` plus a row modifier, so a single rule reflows them all. Its cards
open with a numbered kicker (`.cs-kicker`) above the heading.

The amarula frame is the only one that carries a second background image: its
lower section has a full-bleed backdrop of its own, distinct from the page
background every case sets. Both its lower sections interleave a text card and
an image per column, so each column is a `.cs-sec` stack inside a two-column
grid.

It is also the only case study with **video**. One of its nodes exported as an
empty div with no image, because Figma exports a video node that way — the still
came from `download_assets` on the node id, and the mp4 had to be supplied
separately. The still is reused as the `poster`.

That video is 9.3 MB, so it must not load with the landing page. Three things
have to hold together for that, and each one broke on the way:

- `preload="none"` alone is not enough — an `autoplay` attribute makes the
  browser fetch anyway, even while the article is `hidden`. So there is no
  `autoplay`; `openCase()` starts playback and `closeCase()` pauses it.
- Playback cannot be started with `requestAnimationFrame`, which never fires in
  a backgrounded tab. It uses `load()` plus the `canplay` event instead.
- `play()` is ignored while the element is still `display:none`, which it is
  until `openCase()`'s unhide loop returns. Both the cold path (`canplay`, async
  already) and the warm path (`readyState >= 2`, via `setTimeout`) have to land
  after that tick.

The knorr frame is the only one whose tag colour differs from the site accent:
its pill is Knorr green (`#007a33`) while the footer keeps the emerald, so the
pill overrides `--accent` rather than the case doing so. It also reuses one
export twice — the banner artwork appears both large beside a card and small in
the three-up colourway row.

The royal-sundaram frame reuses `.cs-sec` the same way godrej does, except its
dating section is absolutely positioned with every child at a different inset —
card at 68, image pair at 220, trio at 32 — so that section carries no
horizontal padding at all and each child brings its own.

The godrej frame stacks a text card, an image row and a caption inside one
section, so `.cs-sec` owns the horizontal padding and the rows nested in it
carry none — except its two story grids, which are narrower than the column and
centred with their own inset. It is also the only frame whose accent colour is
not uniform: the first card's heading is `#92cafb` while the rest are `#dfc9aa`,
so that one heading overrides `--serif-accent` rather than the case doing so.

The tcs frame is the plainest — a straight vertical stack — but it introduced
three pieces the earlier frames did without: `.cs-figcap` (a figure with a serif
caption under it), `.cs-split` (a card setting a serif heading beside its body),
and `.cs-caprow` (the same pairing with no card around it). Its Figma exports
also came out at up to 6000x4500, far past any display size, so they are
downscaled to 2240 for full-width images and 1200 for column images.

The stasis frame adds two rows of tall email screenshots. Their Figma boxes
match the source images' own proportions exactly, so `--ar` crops nothing there
— it only fixes each column's height before the image loads. Those rows go to
two columns rather than one under 900px; one email per row would be absurdly
tall. Watch the frame-derived paddings when adding a case: stasis's closing card
is inset 419px from the left, which goes negative well above phone widths, so
the narrow-screen block resets `.cs-band` padding for every case.

### Adding the next one

1. Export the frame with the Figma MCP server and put its imagery in
   `assets/case/<name>/`.
2. Add an entry to `HOTSPOTS` with the artifact's box in 1920×1248 world
   coordinates. Measure it off `assets/bg/project.jpg` — crop the candidate box
   out with `sips -c H W --cropOffset Y X` and look at it, rather than eyeballing
   a scaled-down screenshot.

Mind the units in `grid-template-columns`: a track pair like `304fr 1fr` gives
the first column 99.7% of the row, not 304px. Both tracks have to be in the same
units — `304fr 776fr`.

Check what the exported images actually contain before writing alt text. The
Figma layer names have been unreliable in every frame so far — in wipro and
wewe-uzuri they were shifted by one relative to the artwork, and in stasis the
neutral names (`grid-1`, `grid-2`) say nothing at all — so the files here are
named after their contents, not their nodes. The quickest check is a scratch
HTML contact sheet of the folder, opened in the browser.
3. Add the `<article>`, and a `.cs-<name>` CSS block for its palette and
   collage geometry.

Watch hotspot labels near the edges of the scene. They render centred under the
artifact with `white-space: nowrap`, so a long one clips against `#stage`, which
is `overflow: hidden`. A hotspot can set `align: "left"` or `"right"` to anchor
its label inward instead of centring it — phonepe does, sitting at the far left.
tcs solves the same problem the blunt way, with a short label.

The "Step inside" button in each footer points at the next case by `data-case`
and is inert until that case has a hotspot, so wiring step 2 is what turns it on.

## Next up (not built yet)

The case studies are done. What is left is everything around them:

- "Meet the mind" about page (Figma frame `meet-the-mind`).
  Every case study's nav links (Meet the mind / Resume / LinkedIn) are `href="#"`
  until there is somewhere to point them.
- Weight: `assets/case` is ~41 MB across ten folders and `index.html` is ~125 KB,
  all of which the landing page ships before a visitor clicks anything.
