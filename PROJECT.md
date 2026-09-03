# Into the Mind — project notes

Current state of the site as built, written 3 September 2026.

`README.md` is the older and fuller document — it still has the best writing on
the case studies, the Figma exports and the Amarula video, and that material is
all still accurate. But its account of the **video and the Project page is now
out of date**; where the two disagree, this file is right. The stale parts are
listed at the bottom.

---

## What it is

A one-page portfolio. An astronaut walks through the mind to a field of ten
treasures, one per project. It is a single video played in scroll-gated
segments; when the last segment ends the video hands over to a live page showing
that same final frame, with ten clickable hotspots on it, each opening a case
study.

No build step, no dependencies, no framework. `index.html` is the whole site.

## Run it

```bash
python3 -m http.server 8433
```

Then <http://localhost:8433>. `.claude/launch.json` runs that same command so
the editor can open it in a browser pane; nothing depends on it.

## Layout

| Path | What |
| --- | --- |
| `index.html` | The entire site — markup, CSS, JS, and all ten case studies |
| `assets/main.mp4` | The journey video (26 MB) |
| `assets/bg/project.jpg` | The Project page plate — the high-res composite |
| `assets/case/<id>/` | Each case study's imagery |
| `tools/treasures.py` | Rebuilds the plate (and, optionally, treasure cutouts) |
| `tools/lastframe.png` | The video's last frame, kept as the pipeline's source |
| `tools/lastframe-highres.png` | The plate's source — `LAST FRAME - HIGH RES PROJECTS.png` |
| `index-parallax-backup.html` | Superseded image-parallax version, kept for reference |

## The video

Currently `NEW MAIN VIDEO.mp4`, installed 3 September:

- **14.306 s**, **343 frames**, **23.976 fps**, 1920×1080, 26 MB
- Audio track runs 14.262 s — slightly *shorter* than the video here

Frame rate matters in two places. `FPS` in `index.html` must match the file, and
segment boundaries are written as `tc(seconds, frames)` against it. A previous
video was exactly 24 fps and the constant had to change with it; it is back to
`24000 / 1001` for this one.

## The Project page

The page is **not** a frame of the video. `assets/bg/project.jpg` comes from
`LAST FRAME - HIGH RES PROJECTS.png` on the Desktop, a separately composed
1920×1080 plate that carries the ten treasures at full detail — the same shot
from the same camera, re-rendered, not re-framed. `sips` writes it out at q93,
726 KB, and `tools/lastframe-highres.png` keeps the source alongside.

That it is the same camera was measured, not assumed: each of the ten cutouts
in `assets/proj/` template-matches into the plate at **0.82–0.93** normalised
cross-correlation, within a few pixels of where the same box sits in the video
(worst: Youlry at 17px, and Youlry is a flat red panel that matches loosely on
anything). So the `HOTSPOTS` boxes carry over unchanged.

The background, though, differs from the nearest video frame by **24.7/255**
even after per-channel grade matching — it is a higher-detail render, not a
compression difference. That is what the handover now has to cover, and why it
is a ~400ms dissolve rather than the near-cut it used to be: the same shot
resolving into detail, which is what it is.

It is drawn in the same 1920×1080 world as the video and cover-fit the same
way, so nothing rescales or reframes across the handover.

On top of it sit ten `.hotspot` divs — click targets only, no imagery. `#stage`
is `pointer-events: none` and the hotspots opt back in, so only they are
clickable. Each opens its case study by hash.

`HOTSPOTS` entries carry two boxes:

- `box` — the click target
- `art` — where the treasure actually sits in the frame. Nothing is drawn there
  any more, but the case-study zoom still reads it to find the centre of the
  thing it is zooming into, so it cannot be deleted.

### The high-res overlay, and why it is off

The page used to draw ten transparent PNG cutouts of the treasures over the
plate, so they stayed sharp through the 2.7× zoom into a case study. That
required erasing the video's own copy of each treasure out of the plate first —
a re-rendered cutout never lands on the original's silhouette, so laying one
over the other leaves the original poking out around it.

That overlay is **removed**. The page now shows the treasures as the video
renders them. `tools/treasures.py` keeps the whole machinery behind
`OVERLAY = False`; setting it back to `True` restores the cutouts.

Consequences of it being off:

- The handover no longer waits on anything. It used to hold until the cutouts
  had decoded, or the page would cut in showing the holes they filled.
- `assets/proj/*.webp` (2.3 MB, ten files) are **unreferenced**. They are left
  on disk because they regenerate in seconds, but nothing loads them.

## tools/treasures.py

Rebuilds `assets/bg/project.jpg`. Needs Pillow, NumPy and OpenCV; the site
itself still has none.

With `OVERLAY = False` it simply writes the frame out as the plate. With it on,
it also crops the source PNGs to their alpha bounds, writes `assets/proj/`,
erases each treasure from the frame and lets `index.html` draw the cutouts back
over the holes.

Two things in it are worth not rediscovering:

**It reads `tools/lastframe.png`, not the video.** A finished composite was once
baked into the mp4 as its final frame; had the script kept decoding the video it
would have erased treasures out of its own output. The pristine frame is kept
alongside, with the video only as a fallback. Refresh it whenever the video
changes.

**WebP `method=6` is pathological on partial alpha.** The Knorr cutout, at 8%
partial alpha, takes **613 s** to encode at method 6 and **0.3 s** at method 4,
for 6% more bytes. `METHOD = 4`.

`GROUNDED` and `DETECT` — per-treasure contact lines, erase thresholds and
relighting — are **empty**. Every constant in them was measured off the previous
render's frame and none of it survives a new scene. They are re-derived from
what a plain pass actually shows, not carried over.

## Replacing the video

The art boxes are in video-frame coordinates, so a new render invalidates all of
them. There is no single transform that maps one render onto another: the scene
is re-generated, not re-framed.

1. Copy the file to `assets/main.mp4`
2. Refresh `tools/lastframe.png` from its last frame, and
   `tools/lastframe-highres.png` from whatever high-res composite goes with the
   new render — the plate comes from the second of those, not the first
3. Set `FPS` in `index.html` to the file's actual rate, and `PROJECT_FRAME` to
   the frame the plate was composed on
4. Re-derive the ten `art` boxes and update both `TREASURES` in
   `tools/treasures.py` and `HOTSPOTS` in `index.html` — the two must agree
5. Re-run `tools/treasures.py`
6. Re-time the segment boundaries against the new edit, as `at(s, f)`
   timecodes

Step 4 is done by matching each source cutout into the frame across a range of
widths, masked by its own alpha. That found nine of ten at 0.94–0.99 confidence.
It fails on **Youlry** — a large flat red box degenerate-matches on any uniform
patch, scoring 0.20 even against edges — so that one is measured by hand.

## Open items

- **The plate is still 1920×1080, so it is still upscaled.** The high-res
  composite fixed the icons' *detail* — the Stasis ingredient lists and the
  Royal Sundaram letter body read now, where in the video frame they were mush.
  It did not raise the resolution. The world is scaled by
  `Math.max(innerWidth / 1920, innerHeight / 1080)` and then by the device pixel
  ratio, which on a Retina laptop is roughly a 1.6× upscale, with the parallax's
  `scale(1.03)` on top. Beating that needs a plate larger than 1920×1080; every
  still on hand (`LAST FRAME - HIGH RES PROJECTS.png`, `tools/lastframe.png`) is
  exactly that size.

## Fixed on 3 September, after the new video

- **The journey now stops at 00:00:14:03, and that is a real boundary.** It used
  to play to the end of the file under `LAST_FRAME_LEAD`, a 2.5-frame lead left
  over from when the plate was the sharp replacement for a soft final frame.
  Both are gone. `PROJECT_FRAME` is `at(14, 3)`, an ordinary `end` like the
  four before it. The `ended` listener stays as a backstop for a starved rAF —
  which is not hypothetical: a backgrounded tab keeps a muted video playing
  while rAF is throttled to nothing, so the boundary is missed and the last few
  frames run past before the page takes over.
- **The scroll boundaries were re-cut against this edit.** They used to read
  0:04:06, 0:07:02, 0:08:08, 0:09:17, 0:10:22 — five stops timed against a
  13.04 s video, landing at arbitrary moments in this 14.31 s one. There are
  **four** now, at **00:04:10 · 00:07:06 · 00:08:16 · 00:11:03**, and the
  journey ends on the fifth at 00:14:03. The 9:17 stop is gone, which is the
  one that fell at the busiest point in the shot.
- **`tc()` is gone; boundaries are counted in frames.** `tc(s, f)` read a
  timecode as `s + f/FPS`, which is not what a timecode means: it counts 24
  frames to the second even on a 23.976 timeline, so 00:00:07:06 is frame 174
  at 7.257s, while `tc(7, 6)` gives 7.250s — still inside frame 173. The drift
  is only s/1000 of a second but it is enough to fall a frame short at every
  boundary. `at(s, f)` replaces it, and adds the half-frame that puts each
  boundary inside its own frame's display interval. Checked against the file:
  all five stop on exactly the frame their timecode names.
- **Hotspots did not travel with the plate.** They were children of `proj`,
  while the plate is inside `projPara`, which eases in `translate(8px, 6px)
  scale(1.03)` over about two seconds once the page lands. Measured against the
  plate, the click targets ended up as much as **35px** off the treasures they
  belong to — worst at the edges, so Youlry, TCS and Amarula. They are children
  of `projPara` now; the same measurement reads 0.

## Gotchas

- **`python3 -m http.server` has no range support**, so video seeking silently
  fails — `currentTime` resets to 0. The player never seeks by design; segments
  are contiguous and playback resumes. GitHub Pages does support ranges.
- Autoplay runs muted, per browser policy. The Sound button unmutes.
- Scroll is ignored while a segment plays — the journey is forward-only, and
  there is no way back from the Project page. Arriving is the end of it.

## What in README.md is now wrong

- The video's length, frame count and segment boundaries
- "`assets/bg/project.jpg` is that frame with the ten treasures erased out of
  it" — nothing is erased now
- "the treasures resolve into their high-res selves" — the overlay is off
- The `artPainted` / `artReady` handover gate — removed, along with the
  `toProject()` race that waited on it
- The `assets/proj/<id>.webp` description — still accurate as a description of
  the files, but they are no longer loaded
- "Replacing a treasure", which describes the 18 px dilation erase pipeline —
  `DILATE` is 1, and the erase only runs when `OVERLAY` is on
- The `LAST_FRAME_LEAD` reasoning, which turned on the last frame being soft and
  the page being its sharp replacement
