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
- After the last frame: "Enter the treasures" → zoom into the Project page
  (`assets/bg/project.jpg` + `assets/cut/project.png` astronaut layer).
- `index-parallax-backup.html` — earlier version: image-based parallax journey
  with a persistent walking astronaut (kept for reference; uses `assets/bg/*`,
  `assets/cut/*`, `assets/video.mp4`, `assets/journey.mp4`).

## Assets

- `frames/` — original 2560×1664 PNG exports of the Figma frames
  (file X4313MZXnblmAef2MOlJhm). Source material; the live site doesn't load them.
- `assets/bg/` — 1920w backgrounds with the astronaut inpainted away.
- `assets/cut/` — astronaut cutouts (auto-extracted with rembg).
- `assets/layers.json` — astronaut bounding boxes per frame (1920×1248 space).
- `assets/case/<name>/` — each case study's imagery, exported from its Figma
  node. The creatives are the 1080×1350 (and 1080×1080) social posts, re-encoded
  to JPEG — 20 MB of PNG → 2.9 MB for wipro, 4.2 MB for youlry — plus the page
  background and two 10px icons, which stay SVG. The icons differ per case (the
  brand dot and arrow are recoloured per palette), so they are not shared.

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

Six are built, each opened by clicking its artifact on the Project page:

| Artifact | Hash | Figma node | Title size |
| --- | --- | --- | --- |
| The office chair | `#wipro` | `2072-4` | 80 |
| The maroon YOULRY jewellery box | `#youlry` | `2093-4` | 96 |
| The WEWE UZURI magazine | `#wewe-uzuri` | `2108-4` | 96 |
| The pair of Stasis bottles | `#stasis` | `2142-4` | 96 |
| The carved TCS stone | `#tcs` | `2177-4` | 88 |
| The framed Godrej HOMES sign | `#godrej` | `2204-4` | 80 |

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

Check what the exported images actually contain before writing alt text. The
Figma layer names have been unreliable in every frame so far — in wipro and
wewe-uzuri they were shifted by one relative to the artwork, and in stasis the
neutral names (`grid-1`, `grid-2`) say nothing at all — so the files here are
named after their contents, not their nodes. The quickest check is a scratch
HTML contact sheet of the folder, opened in the browser.
3. Add the `<article>`, and a `.cs-<name>` CSS block for its palette and
   collage geometry.

Keep hotspot labels short. They render centred under the artifact with
`white-space: nowrap`, so a long one clips against `#stage` when the artifact
sits near a viewport edge — which is why tcs's reads "TCS" and not the full
client name.

The "Step inside" button in each footer points at the next case by `data-case`
and is inert until that case has a hotspot, so wiring step 2 is what turns it on.

## Next up (not built yet)

- The remaining case-study frames in the Figma file: royal-sundaram (the godrej
  footer already points at it), knorr, amarula, phonepe.
- "Meet the mind" about page (Figma frame `meet-the-mind`). Every case study's
  nav links (Meet the mind / Resume / LinkedIn) are `href="#"` until then.
