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
| `resume.html` | The CV viewer — the page every Resume link opens, and the only thing that offers a way back |
| `assets/resume.pdf` | The CV itself — 468 KB on a Letter page. Rebuilt from the 1024×1536 artwork: the Photoshop export of the same picture was 37 MB, flattened, with a page box of 1024×1536 **points**, so it printed to nothing standard |
| `assets/resume-fallback.jpg` | The CV as an image, shown only where a PDF will not render inline |
| `assets/atmosphere.js` | The journey's particle field, scroll- and film-reactive |
| `assets/score.js` | The soundtrack — three cues off one piece of music, scheduled against the film's clock |
| `assets/audio/*.m4a` | The three cues — 436 KB of AAC in total |
| `tools/score.py` | Cuts the three cues out of the source track; macOS `afconvert` only, nothing to install |
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
- Autoplay runs muted, per browser policy — and stays muted for good. The film's
  own audio track is 2.2 kbit/s of encoded silence, so there was never anything
  to unmute; the Sound button switches [the score](#the-soundtrack) instead.

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

### The soundtrack

One piece of music — *Beneath the Abyss* — cut into three cues and scheduled
against `journey.currentTime`, never against a scroll position or a viewport
test. The page does not scroll, so the film's clock is the only clock there is;
it is also what lets a visitor stand at a stop for two minutes and hear the bed
hold rather than the score walk on without them.

| Cue | Out of the source | Lands on |
| --- | --- | --- |
| `landing.m4a` | 18.881 – 23.000 s | The riser and the low hit inside it. The hit is at 19.840 s in the source and 0.959 s into the clip, which is **frame 23**, the frame the astronaut's feet touch |
| `walk.m4a` | 30.450 – 42.690 s | The bed for the whole walk. Loops 1.80 → 12.24 s inside the clip; the 1.8 s before that is a one-shot lead-in, so the bed arrives rather than starts |
| `reveal.m4a` | 151.850 – 165.960 s | The bloom is 1.15 s into the clip and is put on **10.50 s**, where the tunnel gives way to the clouds. Loops 3.70 → 14.11 s, so the cloud world holds for as long as the visitor stands at the last stop |

The three cue points and the two visual ones were measured, not eyeballed. The
impact is where the source's sub-120 Hz band jumps from 2186 to 3899 RMS in one
30 ms window; the contact frame is the first frame carrying the landing flash
under the boots; the threshold is the frame the last tunnel arch leaves. Nothing
in the film was retimed for any of it — the picture is the master timeline and
the music was cut to fit it.

**Each cue is pinned to a video second, and stays pinned.** Which second of the
music belongs to which second of the film is a property of the film, not of when
the visitor pressed the button:

| Cue | Clip second 0 is video second |
| --- | --- |
| `landing` | **0.000** — so its hit, 0.959 s in, is on frame 23 |
| `walk` | **1.100** |
| `reveal` | **9.350** — so its bloom, 1.15 s in, is on the 10.500 s threshold |

Switching the score on 6.2 s into the journey therefore comes up 5.1 s into the
bed, not at the start of it. Switch it off and on again and it returns to where
the *film* has got to, not to where it left off. `fire()` does this for any `t`:
it puts a cue's own anchor on the video second that anchor was cut for and works
the offset out from there, wrapping into the loop where a looping cue has been
round more than once, and subtracting `outputLatency` so the sound reaches the
ear on the frame rather than after it. If a handover was in flight at the moment
of the press, both cues come up at the levels the score would have had them at
and the rest of that handover is scheduled from there (`then` on `begin()`). The
0.3 s ramp in front of a mid-score join is an anti-click ramp on the level only —
it never moves the music.

**The arrival is silent.** The resolve starts at 12.20 s, where the treasure
world finishes resolving out of the cloud, and its length is measured from the
firing frame to 14.16 s — the frame the film hands over to the page. Metered, it
reaches −39 dBFS at 14.16 and true silence at 14.17, so the treasures page is
quiet from the moment it appears rather than having a fade trail across it. At
2× on the fast track the same span is half the wall clock and still lands on the
same frame.

**Why the loops are whole phrases.** The track's phrase is ~10.43 s, found by
correlating three-band energy envelopes of a region against itself. Both looping
cues are one phrase long, and each carries a 0.70 s equal-power crossfade baked
into the end of its loop by `tools/score.py`: the last 0.70 s before the loop
end is a sin/cos blend of the material approaching the loop end with the
material approaching the loop start, which makes the sample before the wrap the
sample before the loop start. The join is continuous in the waveform, not just
in the phrasing. A two-second loop of the passage that was originally picked out
would have been audible as a loop inside one pass.

**Why equal power everywhere.** Two uncorrelated passages crossfaded on linear
ramps dip about 3 dB in the middle, which is exactly the "three MP3s being
switched" sound this is meant not to have. Every handover — landing into bed,
bed into reveal, and the resolve onto the treasures page — is a sin/cos pair.

**Levels**, measured off the graph rather than guessed: the bed sits at about
−25 dBFS RMS, the impact at −21 and the reveal at −18, peaks no higher than
−10. An earlier pass had the bed at −29 behind a 3.4 kHz low-pass, which is
atmospheric to the point of being easy to miss on a laptop speaker — restrained
is the brief, inaudible is not. Scroll does not scrub the audio, it opens it —
playing a segment lifts the bed's gain and its low-pass a little (5.2 → 8 kHz),
holding closes both, travelling deeper adds a touch of each, all on 0.55 s
chases. No pitch, no playback rate, nothing that sounds like a timeline being
dragged.

**The score is on by default; the pill is an off switch.** `arm()` runs at load
and, where the browser allows sound, the score starts with the film — the pill
reads "Sound off" before anybody has touched anything, and that is the path that
gets the impact on the contact frame. It is attempted three times over the first
two seconds rather than once, because the answer a browser gives while a
document is still parsing is not always the answer it gives a moment later. The
buffers are fetched on the first attempt either way, so a later unlock has
nothing to wait for. Only an explicit "off" this session stops any of it.

**What makes that hard here.** A browser takes a short list of inputs as
permission to play sound — `mousedown`, `pointerdown`, `pointerup`, `touchend`,
`keydown` — and **`wheel` is not on it**. This journey is driven by the wheel, so
a visitor on a trackpad can scroll the whole way through without ever handing
the page the one thing it needs. An unlock that spends its single attempt on the
first input therefore spends it on a scroll and never comes back. So:

- `score.wake()` retries on *every* input rather than only the first, and
  `firstInput` in `index.html` listens on six events rather than the film's four
  — `pointerup` and `touchend` are there purely so the score has something it
  can use.
- `ctx.onstatechange` adopts the context by whatever route it reaches
  `running`, including a `resume()` whose promise the browser simply left
  hanging until the visitor did something. Anything that gets the context
  running is taken as the answer rather than waited on a second time.
- Where a browser still refuses, **the Sound pill is the one route that always
  works**, so it breathes (`#soundHud.waiting`, the scroll prompt's own
  `hintPulse`) — but *only* while the score is off and the journey is still
  running. Where autoplay is allowed that never happens, and it never happens on
  the treasures page.

If the score only unlocks once the film is past 4.38 s — the first stop, which
is where a first-time visitor's first scroll lands — the astronaut landed three
and a half seconds ago, so it opens on the bed at the bed's correct second and
no thud is invented for a landing that has already happened.

The pill's own press is excluded from `wake()`: a press lands as a `pointerdown`
before it lands as a `click`, so without that guard the press would switch the
score on and the click would immediately switch it back off.

**The mute lasts one page view.** It was in `sessionStorage` for a while, so a
press followed the visitor across reloads — and that is not worth what it costs.
The state is invisible: the page comes up silent with the pill reading "Sound
on", which is indistinguishable from a browser refusing, so one press while
looking at something else leaves the site apparently mute-by-default for the
rest of the day in that tab. It cost two rounds of debugging exactly that way.
A reload of this page is a reload of the journey — the film starts at frame 0,
the astronaut falls again, and the score belongs to that — so the mute is now a
plain variable that goes when the page does. Within the page view it does hold:
a scroll after a deliberate mute does not undo it.

**The fast track** runs the picture at 2× and the music is not stretched to
match, so `update()` is handed `journey.playbackRate` and every crossfade length
is measured from the frame that fired it to the film second it has to be over
by, converted at that rate.

`?score=debug` logs what was scheduled and when — including the clip offset each
cue started at, which is the thing to check against the table above;
`score.inspect()` from the console shows which cues decoded, where their first
audible sample turned out to be, and what is sounding. Both are silent
otherwise.

**`assets/score.js` carries a `?v=`**, for the same reason the film does. It is
edited far more often than the page that loads it, and a browser holding an old
copy is a page with no sound and no error to say why. Bump it on every change.

**AAC priming.** Every asset starts with a tenth of a second of true silence,
and `score.js` finds the first sample over −48 dBFS rather than trusting the
buffer to start where the music does. Encoders add priming samples that some
decoders hand back and some swallow; without this the offsets in this table
would be ~48 ms out on the decoders that do, which is a visible miss on an
impact.

---

## Meet the Mind — `meet-the-mind.html`

Figma node `2431-4`, a 1280-wide frame. Every measurement in the file is that
frame's, expressed as a percentage, so the page scales as one drawing.

Sections: the hero (shuffling title, speech bubble), a philosophy pair, a facts
list beside the two-cities story, and a call to action that opens Gmail's own
compose window. Type is **Fraunces**
for display (with the design's SOFT and WONK axes driven from CSS rather than
pinned to instances) over Poppins for everything else.

### The one contact route on the site

The button at the foot of this page is the only way to reach anyone from the
whole portfolio -- the case studies' "emailer" sections are layout, with no
address in them. It goes to Gmail's compose
(`mail.google.com/mail/?view=cm&fs=1&to=`), in a new tab, rather than the
`mailto:` it used to be.

That is a deliberate trade, taken with its cost understood. A `mailto:` hands
off to whatever mail client the visitor's machine has registered, and where
none is -- a laptop where Mail was never set up, a browser with no handler --
it does nothing whatsoever, silently, which is the worst way for a site's only
contact route to fail. The cost is that Gmail is now the destination for
everyone: a visitor on Outlook or Apple Mail is taken somewhere that is not
their mail, and one not signed in meets a sign-in page. The address is written
on the face of the button either way, so it can always just be copied.

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

## The resume, and the way back out of it

`resume.html` is a viewer wrapped around `assets/resume.pdf`: the site's own
pill top left for **Back**, a **Download PDF** beside it, Escape bound to the
same thing a case study binds it to, and the PDF below in the browser's native
viewer so its zoom, print and download all still work.

**It opens in the same tab, and that is the whole point.** The links used to be
`target="_blank"`, which is what made the resume a dead end: a tab opened that
way has no history, so the back button is inert in it, and `rel="noopener"`
means the page cannot call `window.close()` on itself either. The only exit was
the tab's own close button. Putting `target="_blank"` back on these links
reintroduces exactly that, and no amount of work inside `resume.html` can fix
it from there.

### The `?from` contract

`history.back()` on its own is not enough, and the reason is easy to miss:
**the treasures page has no hash of its own.** `closeCase()` at
[index.html:2724](index.html:2724) rewrites the URL to `location.pathname`, and
`toProject()` never adds one — so a visitor standing on the treasures is at a
bare `index.html`. Step back to that and the page has no idea where they were,
and replays all fourteen seconds of film to return them somewhere they were
already standing.

So the page that sends someone to the viewer names the way back, in `?from`:

| Where the link is | What `?from` carries | Set |
| --- | --- | --- |
| `#projnav`, on the treasures | `index.html#treasures` | at click, by JS |
| The ten case-study nav bars | `index.html#<case>` — the open one | at click, by JS |
| Meet the Mind's `#projnav` | `meet-the-mind.html` | in the markup, [:431](meet-the-mind.html:431) |

The ten case bars and the treasures share one handler at
[index.html:2737](index.html:2737). It binds to `a.resume-link` and rewrites the
`href` **on click**, because which case is open is only known then — it reads
`openCaseId`, falling back to `treasures`. Meet the Mind has no such states, so
its link carries the value statically and needs no script.

`resume.html` reads it at [resume.html:69](resume.html:69) and takes the first
of three that applies:

1. a `?from` that passes validation — `location.replace()` to it;
2. otherwise `history.back()`, if there is any history to step through;
3. otherwise `index.html#treasures`.

What makes the returns land is the deep-link handling that already existed:
`initFromHash()` at [index.html:2757](index.html:2757) opens `#<case>` straight
into that case study and `#treasures` straight onto the treasures, pausing the
journey rather than playing it. **`?from` is only ever a hash that function
already understands** — it adds no new routing, and that is why it works.

### What a later change has to keep

- **Same tab.** See above. `target="_blank"` breaks the return outright.
- **The values stay hashes `initFromHash()` knows** — `#treasures`, or an id in
  `HOTSPOTS`. Invent a new one and Back lands on a page that ignores it.
- **The validation stays narrow.** `?from` is matched against
  `/^[\w.\-]+\.html(#[\w-]*)?$/` — a page on this site and nothing else.
  It is a URL from the query string being handed to `location.replace()`, so
  widening it to accept a scheme, a `//host`, or a path segment turns the
  viewer into an open redirect: a link could be dressed as this portfolio and
  bounce whoever clicked it somewhere else. Absolute URLs,
  protocol-relative ones, `javascript:` and `../` traversal are all rejected
  today, and each falls through to the safe default rather than failing.
- **`resume-link` is what the handler binds to.** A new Resume link without
  that class still opens the viewer; it just arrives with no `?from` and comes
  back by history instead, which on the treasures means the film.
- **The fallback stays inside the `<object>`** at
  [resume.html:49](resume.html:49). It is there for iOS Safari, which will not
  render a PDF inline and would otherwise show a blank page; an `<object>`
  displays its children only when it cannot render its own data, so moving that
  image out shows it to everybody, always.

If the treasures page is ever given a real hash of its own, most of this
collapses to a plain `history.back()`. Until then, the naming is what carries
it.


## Weight

| | |
| --- | --- |
| `assets/case` | 41 MB across ten folders |
| `assets/meet` | 6.5 MB — 5.8 MB of that is four pose PNGs, two of them redrawn |
| `assets/bg` | 6.1 MB |
| `assets/main.mp4` | 5.8 MB (was 26.4 MB) |
| `index.html` | 171 KB |
| `assets/audio` | 436 KB — 49 KB landing, 170 KB bed, 211 KB reveal, 128 kbit/s AAC |

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
