# Into the Mind — Portfolio

**Live: https://krishamehta1600.github.io/**

An astronaut journeys through the mind to a field of treasures (the projects).
One video, played in scroll-gated segments, ending on a clickable Project page.

## Run it

Any static file server works. From this folder:

```sh
python3 -m http.server 8433
```

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

## Gotchas

- The live site is served by GitHub Pages from `main` at the repo root, which
  does support range requests — seeking works there if you ever add it.
- `python3 -m http.server` has no HTTP range support, so **video seeking
  silently fails** (currentTime resets to 0). The player deliberately never
  seeks — segments are contiguous and playback simply resumes. If you ever need
  seeking (e.g. a skip button), use a range-capable server (`npx http-server`,
  or any real host).
- Autoplay runs muted (browser policy); the Sound button unmutes.

## Next up (not built yet)

- Clickable hotspots on the Project page artifacts → case-study pages
  (the Figma file has full case-study frames: wipro, youlry, stasis, tcs,
  godrej, royal-sundaram, knorr, amarula, phonepe, wewe-uzuri).
- "Meet the mind" about page (Figma frame `meet-the-mind`).
