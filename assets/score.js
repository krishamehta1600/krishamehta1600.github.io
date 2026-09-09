/* Score — the film's soundtrack, cut to the film.

     const score = Score({ onchange: on => …, latency: 0 });
     score.arm();                       // try to start without a gesture
     score.wake();                      // the first real interaction
     score.toggle();                    // the Sound pill
     score.update(t, playing, state, rate);   // every frame, from render()

   One piece of music, three cues out of it, and the film's own clock deciding
   when each one arrives. Nothing here reads window.scrollY: the page does not
   scroll, journey.currentTime is what actually moves the picture, so it is
   what moves the sound too. That also means a visitor who sits at a stop for
   two minutes hears the bed go on rather than the score run ahead of them.

   ---- the three cues

   LANDING  starts with the film and is built so the low hit inside it falls on
            frame 23, where the astronaut's feet touch. Not "when the landing
            section scrolls into view" -- the clip is scheduled against the
            video clock so the hit and the contact frame are the same moment.

   WALK     the bed for the whole walk through the mind. A 10.44s phrase with
            an equal-power crossfade baked into the end of its loop, played on
            one looping source node, so there is no restart to hear: it is the
            same continuous air from the landing to the tunnel however long the
            visitor takes over it.

   REVEAL   the last cue. It starts 1.15s before the astronaut crosses the
            tunnel threshold, so the music is already opening when the picture
            does, and its own loop holds the cloud world for as long as the
            visitor stands at the last stop.

   The handovers between them are equal-power (sin/cos) rather than linear.
   Two uncorrelated passages crossfaded on linear ramps dip ~3dB in the middle,
   which is exactly the "two files being switched" sound this is meant not to
   have.

   ---- how loud

   The picture is the hero. The bed sits at about half of the impact's level
   and the reveal between them, and every cue runs through a gentle limiter so
   nothing an unlucky crossfade sums to can reach the ceiling. Scroll does not
   scrub the audio -- it opens it: playing a segment lifts the bed's gain a
   little and its low-pass a little, holding closes both, and travelling deeper
   adds a touch of each. No pitch, no rate, nothing that sounds like a
   timeline being dragged.

   ---- assets

   assets/audio/{landing,walk,reveal}.m4a, cut by tools/score.py from the
   source track. Each begins with a tenth of a second of true silence: AAC
   priming is handed back by some decoders and swallowed by others, so the
   offsets below are measured from the first audible sample rather than from
   the start of the decoded buffer. */
window.Score = function Score(opts) {
  const o = opts || {};
  /* onchange(on, needsInput). The second argument is what the page hangs its
     temporary wake listeners off: true means an input from the visitor would
     help, false means it would not -- either because the score is playing, or
     because they muted it themselves and the pill is the way back. */
  const onchange = o.onchange || function () {};

  /* ---------- the film's clock ----------
     Video seconds, all of them read off assets/main.mp4 frame by frame. The
     film is 23.976fps and is never retimed to suit the music; the music is cut
     to suit it. */
  const T_LAND      = 23 / (24000 / 1001);  /* 0.9593 — the contact frame */
  const T_BED_IN    = 1.10;                 /* the bed starts under the settling dust */
  const T_BED_FULL  = 2.90;                 /* landing gone, bed at level */
  const T_REVEAL_IN = 9.35;                 /* the reveal begins to arrive */
  const T_THRESHOLD = 10.50;                /* the tunnel gives way to the clouds */
  const T_BED_OUT   = 10.60;                /* the walk's air is gone by here */
  /* The treasure world finishes resolving out of the cloud between 12.2 and
     12.7, and the film hands over to the page at 14.16. The score lets go on
     the first of those and is silent on the second: the treasures page has no
     soundtrack, so the fade has to be over before the page is there rather
     than trailing across it. */
  const T_RESOLVE   = 12.20;
  const T_END       = 14.16;                /* the frame the project page is made of */

  /* ---------- levels ----------
     Measured off the graph rather than guessed: the bed lands at about -24
     dBFS RMS, the impact and the reveal at about -19. Five or six decibels is
     enough for the impact to read as a physical event and for the reveal to
     bloom, and little enough that neither is ever the loudest thing about the
     page.

     The bed is the one that has to be right, because it is under everything
     and it is what a visitor hears for most of the journey. An earlier pass
     had it at -29 through a 3.4kHz low-pass, which is atmospheric to the point
     of being easy to miss on a laptop speaker -- restrained is the brief, not
     inaudible. */
  const LVL_LANDING = 1.00;
  const LVL_BED     = 0.70;
  const LVL_REVEAL  = 0.64;
  const MASTER      = 0.72;

  /* Offsets inside each asset, in seconds from its first audible sample.
     Printed by tools/score.py; change them there, not here. */
  const CUES = {
    landing: { url: "assets/audio/landing.m4a", anchor: 0.95929 },
    walk:    { url: "assets/audio/walk.m4a",   loopStart: 1.80, loopEnd: 12.24 },
    reveal:  { url: "assets/audio/reveal.m4a", loopStart: 3.70, loopEnd: 14.11, anchor: 1.15 }
  };
  const ORDER = ["landing", "walk", "reveal"];
  const LEAD_MAX = 0.35;      /* a detected lead longer than this is not priming */

  let ctx = null, master = null;
  let wanted = false;         /* what the visitor has asked for */
  let phase = "idle";         /* idle | landing | bed | reveal | out */
  let asking = false;         /* a resume() is in flight */
  let muted = false;          /* the visitor pressed the pill, this page view */

  /* DEBUG: ?score=debug. Prints what was scheduled and when, which is the only
     way to check a cue that is meant to land on one frame of a fourteen-second
     film. Silent otherwise. */
  const DEBUG = /(\?|&)score=debug/.test(location.search);
  const log = DEBUG ? function () {
    console.log.apply(console, ["[SCORE]"].concat([].slice.call(arguments)));
  } : function () {};

  /* ---------- the mute lasts for the page view, and no longer ----------
     This was in sessionStorage for a while, so a mute followed the visitor
     across a reload. It is not worth what it costs. The state is invisible --
     the page simply comes up silent, with the pill reading "Sound on" and no
     way to tell that from a browser refusing -- and it is sticky per tab, so
     one press while looking at something else leaves the site apparently
     mute-by-default for the rest of the day.

     A reload of this page is a reload of the journey: the film starts again at
     frame 0, the astronaut falls again, and the score belongs to that. So the
     mute is a plain variable. It holds for as long as the page is open and
     goes when the page does. */

  /* ---------- the graph ----------
     source -> filter -> mod -> env -> master -> limiter -> out

     Two gains per cue on purpose. `env` carries the crossfades, which are
     scheduled curves; `mod` carries the scroll response, which is a slow
     setTargetAtTime chase. Sharing one AudioParam between a running curve and
     a running target is what makes Web Audio throw, so they are kept apart. */
  function graph() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    /* iOS mutes Web Audio with the hardware silent switch. The switch is meant
       for notifications, but WebKit applies it to an AudioContext as well, so
       a phone with the switch flipped plays the film in silence no matter how
       many times the score is unlocked -- and every unlock here reports itself
       as having worked, because as far as the context is concerned it has.
       Declaring the session as `playback` puts the score in the same class as
       a video's soundtrack, which the switch does not touch.

       Set before the context is constructed, because that is when WebKit reads
       it. Safari 16.4 and up; everywhere else the property is simply absent and
       this is a no-op. */
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (e) {}
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain();
    master.gain.value = MASTER;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(ctx.destination);
    /* A resume that is refused now can be granted later -- a browser that
       decides this page is trusted after all, a tab that comes to the front, a
       resume() whose promise was simply left hanging until the visitor did
       something. Whatever route the context takes to "running", the score is
       meant to be playing, so it is taken as the answer rather than waited on
       a second time. */
    ctx.onstatechange = () => {
      if (ctx.state === "running") { adopt("context started"); return; }
      /* The other direction, which iOS does: backgrounding the app suspends the
         context, and coming back does not always give it up again. Ask for it,
         and if the answer is no, stand down honestly -- the pill goes back to
         reading "Sound on" and the page puts its wake listeners back, rather
         than the score claiming to be playing with nothing coming out of it. */
      if (!wanted || muted) return;
      ctx.resume().catch(() => {});
      setTimeout(() => {
        if (!wanted || muted || ctx.state === "running") return;
        wanted = false;
        phase = "idle";
        onchange(false, true);
        log("stood down (context " + ctx.state + ")");
      }, 600);
    };
    for (const name of ORDER) {
      const c = CUES[name];
      c.filter = ctx.createBiquadFilter();
      c.filter.type = "lowpass";
      c.filter.frequency.value = 20000;
      c.filter.Q.value = 0.6;
      c.mod = ctx.createGain();
      c.env = ctx.createGain();
      c.env.gain.value = 0;
      c.filter.connect(c.mod).connect(c.env).connect(master);
    }
    return true;
  }

  /* ---------- fetching ----------
     In the order they are needed. The landing has under a second to be ready
     and is 50kB; the reveal has nine and is the biggest, so it goes last and
     never competes with the film's own opening fetch. */
  let loading = null;
  function load() {
    if (loading) return loading;
    loading = ORDER.reduce((chain, name) => chain.then(() => one(name)), Promise.resolve());
    return loading;
  }
  function one(name) {
    const c = CUES[name];
    return fetch(c.url)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))
      .then(b => ctx.decodeAudioData(b))
      .then(buf => { c.buffer = buf; c.lead = firstSound(buf); })
      /* A cue that will not decode costs its own moment and nothing else --
         the film, the scroll and the rest of the score carry on. */
      .catch(() => { c.buffer = null; });
  }
  /* Where the music actually starts inside the decoded buffer. tools/score.py
     writes a tenth of a second of silence in front of every asset for exactly
     this: whatever the decoder did or did not do with the AAC priming samples,
     the first sample over -48dBFS is the origin everything is measured from. */
  function firstSound(buf) {
    const d = buf.getChannelData(0);
    const n = Math.min(d.length, Math.ceil(buf.sampleRate * LEAD_MAX));
    for (let i = 0; i < n; i++) if (Math.abs(d[i]) > 0.004) return i / buf.sampleRate;
    return 0;
  }

  /* ---------- equal-power envelopes ---------- */
  const CURVE_N = 65;
  function curve(level, rising) {
    const a = new Float32Array(CURVE_N);
    for (let i = 0; i < CURVE_N; i++) {
      const u = i / (CURVE_N - 1);
      a[i] = level * (rising ? Math.sin(u * Math.PI / 2) : Math.cos(u * Math.PI / 2));
    }
    return a;
  }
  function hold(param, when) {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(when);
    else { const v = param.value; param.cancelScheduledValues(when); param.setValueAtTime(v, when); }
  }
  function up(param, level, when, dur) {
    dur = Math.max(0.03, dur);
    try {
      hold(param, when);
      param.setValueAtTime(0, when);
      param.setValueCurveAtTime(curve(level, true), when, dur);
    } catch (e) {
      param.cancelScheduledValues(when);
      param.setValueAtTime(0, when);
      param.linearRampToValueAtTime(level, when + dur);
    }
  }
  /* An equal-power move between two levels rather than from silence, used to
     pick up a handover that was already part-way through when the score was
     switched on. */
  function ramp(param, from, to, when, dur) {
    dur = Math.max(0.03, dur);
    const a = new Float32Array(CURVE_N);
    for (let i = 0; i < CURVE_N; i++) {
      const u = i / (CURVE_N - 1);
      a[i] = from * Math.cos(u * Math.PI / 2) + to * Math.sin(u * Math.PI / 2);
    }
    try { param.setValueCurveAtTime(a, when, dur); }
    catch (e) { param.linearRampToValueAtTime(to, when + dur); }
  }
  function down(param, dur) {
    const when = ctx.currentTime, from = param.value;
    dur = Math.max(0.03, dur);
    try {
      hold(param, when);
      param.setValueCurveAtTime(curve(from, false), when, dur);
    } catch (e) {
      param.cancelScheduledValues(when);
      param.setValueAtTime(from, when);
      param.linearRampToValueAtTime(0, when + dur);
    }
    return when + dur;
  }

  /* ---------- starting a cue ---------- */
  function begin(name, when, into, level, fade, then) {
    const c = CUES[name];
    if (!c.buffer) return false;
    stop(name);
    const src = ctx.createBufferSource();
    src.buffer = c.buffer;
    if (c.loopStart != null) {
      src.loop = true;
      src.loopStart = c.lead + c.loopStart;
      src.loopEnd = c.lead + c.loopEnd;
      /* An offset past the loop is not a thing a buffer source does anything
         sensible with, so it is wrapped back into the loop instead. */
      const span = c.loopEnd - c.loopStart;
      if (into > c.loopEnd) into = c.loopStart + (into - c.loopStart) % span;
    } else if (into > c.buffer.duration - c.lead - 0.05) {
      return false;                        /* the whole cue has already gone by */
    }
    src.connect(c.filter);
    src.start(when, c.lead + into);
    /* A cue that runs out, or one that is stopped, clears its own slot -- so
       nothing is left holding a reference to a node that has already ended,
       and inspect() does not report a cue as sounding after it has stopped. */
    src.onended = () => { if (c.src === src) c.src = null; };
    c.src = src;
    /* The scroll response starts from neutral for every fresh cue: leaving the
       previous run's chase in place would have the bed come up already half
       closed. */
    c.mod.gain.cancelScheduledValues(when);
    c.mod.gain.setValueAtTime(1, when);
    c.mod.gain.__aim = null;
    c.filter.frequency.__aim = null;
    up(c.env.gain, level, when, fade);
    if (then) ramp(c.env.gain, level, then.to, when + fade, then.over);
    log(name, "start in", (when - ctx.currentTime).toFixed(3) + "s",
        "at", into.toFixed(3), "| lead", c.lead.toFixed(4),
        "| level", level.toFixed(3), "| fade", fade.toFixed(2) + "s",
        then ? "-> " + then.to.toFixed(3) + " over " + then.over.toFixed(2) + "s" : "");
    return true;
  }
  /* Put the cue's anchor -- the hit inside the landing, the bloom inside the
     reveal -- on video second `videoT`, so the caller says "put the hit on the
     contact frame" rather than "start the file now". If that moment has already
     gone by (sound switched on late, a slow decode) the clip starts here and
     now, that much further in, rather than arriving after the thing it was for.

     `rate` is the film's playbackRate: the fast track runs the picture at 2x
     and the music is not stretched to match, so the wait is measured in film
     seconds and converted. */
  function fire(name, videoT, t, rate, level, fade, then) {
    const c = CUES[name];
    if (!c.buffer) return false;
    const wait = (videoT - t) / rate - (c.anchor || 0) - latency();
    return wait >= 0
      ? begin(name, ctx.currentTime + wait, 0, level, fade, then)
      : begin(name, ctx.currentTime, -wait, level, fade, then);
  }
  function stop(name) {
    const c = CUES[name];
    if (!c.src) return;
    try { c.src.stop(); } catch (e) { /* already stopped */ }
    c.src.disconnect();
    c.src = null;
  }
  function latency() {
    const l = (ctx.outputLatency || ctx.baseLatency || 0);
    return l > 0.25 ? 0.25 : l;
  }
  /* Fade a cue out and let it stop itself. The node stays in its slot until it
     actually ends -- onended clears it -- so a switch-off or a hard restart
     during the fade can still reach the thing that is still sounding. */
  function release(name, dur) {
    const c = CUES[name];
    if (!c.src) return;
    const at = down(c.env.gain, dur);
    try { c.src.stop(at + 0.05); } catch (e) { /* nothing to stop */ }
  }

  /* ---------- the scroll response ----------
     Not a scrub. Playing a segment opens the bed a little and holding closes
     it; travelling deeper adds a touch on top. Both chases are slow enough
     (0.55s) that a wheel flick is a swell, not a click. */
  function aim(param, target, eps, tau) {
    if (param.__aim != null && Math.abs(param.__aim - target) < eps) return;
    param.__aim = target;
    param.setTargetAtTime(target, ctx.currentTime, tau);
  }
  function modulate(t, playing) {
    const p = Math.min(1, Math.max(0, t / T_END));
    if (CUES.walk.src) {
      aim(CUES.walk.mod.gain, (playing ? 1 : 0.86) + 0.08 * p, 0.01, 0.55);
      /* Held is where a visitor spends most of the journey -- the film stops at
         every segment boundary and waits -- so the closed end of this has to
         still sound like the room and not like a wall. 5.2kHz to 8kHz, not the
         3.4 it started at. */
      aim(CUES.walk.filter.frequency, 5200 + (playing ? 2800 : 0) + 900 * p, 60, 0.55);
    }
    if (CUES.reveal.src) aim(CUES.reveal.mod.gain, playing ? 1 : 0.90, 0.01, 0.7);
  }

  /* ---------- the run ---------- */
  /* Crossfade lengths are measured from now to the film second they are meant
     to be over by, not from the film second they were meant to start at. A
     frame is 42ms and a cue can fire anywhere inside one; taking the span from
     the frame that actually fired is what keeps the reveal full at the
     threshold rather than a frame or two behind it. */
  function span(toVideoT, t, rate, least) {
    return Math.max(least, (toVideoT - t) / rate);
  }
  /* ---------- joining part-way through ----------
     The whole point of the file: **which second of the music belongs to which
     second of the film is a property of the film, not of when somebody pressed
     the button.** Switching the score on 6.2s into the journey comes up 5.1s
     into the bed -- the second of the bed that belongs to that second of the
     film -- rather than starting the bed over. Switch it off and on again and
     it comes back to where the film has got to, not to where it left off.

     fire() already does the placing: it puts a cue's own anchor on the video
     second that anchor was cut for and works the offset out from there for any
     t, wrapping into the loop where a looping cue has been round more than
     once. What is left is the levels -- and, if a handover was in flight at the
     moment of the press, the rest of that handover, which `then` carries.

     The 0.3s in front of each is an anti-click ramp and nothing else: starting
     a buffer at full gain is a step. It moves the level for a third of a
     second; it does not move the music. */
  const ENTRY = 0.30;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const rise = (t, a, b) => Math.sin(clamp01((t - a) / (b - a)) * Math.PI / 2);
  const fall = (t, a, b) => Math.cos(clamp01((t - a) / (b - a)) * Math.PI / 2);
  const rest = (toVideoT, t, rate) => (toVideoT - t) / rate - ENTRY;

  function enter(t, rate) {
    /* Still falling: the impact can be put where it belongs. If the clip has
       not decoded yet this waits rather than falling through -- opening on the
       bed while the astronaut is still in the air would spend the arrival and
       have nothing left for it. There is under a second to wait and the clip
       is 50kB, and if it never arrives at all the frame passes and the bed
       takes over below. */
    if (t < T_LAND - 0.06) {
      if (!CUES.landing.buffer) return;
      if (fire("landing", T_LAND, t, rate, LVL_LANDING, 0.25)) {
        phase = "landing";
        log("phase landing");
      }
      return;
    }

    /* The landing, and the handover out of it. No invented thud for a landing
       that has already happened -- but the clip is still placed by the film, so
       whatever of its tail belongs to this second is what plays. */
    if (t < T_REVEAL_IN) {
      const r = rest(T_BED_FULL, t, rate);
      const gL = LVL_LANDING * fall(t, T_BED_IN, T_BED_FULL);
      const gB = LVL_BED * rise(t, T_BED_IN, T_BED_FULL);
      if (t >= T_BED_IN &&
          !fire("walk", T_BED_IN, t, rate, gB, ENTRY, r > 0.05 ? { to: LVL_BED, over: r } : null)) return;
      if (gL > 0.02) fire("landing", T_LAND, t, rate, gL, ENTRY, r > 0.05 ? { to: 0, over: r } : null);
      phase = t < T_BED_IN ? "landing" : "bed";
      log("phase " + phase + " (joined at " + t.toFixed(2) + ")");
      return;
    }

    /* The tunnel and everything past it. Before the threshold the bloom can
       still be put on it; after it, the reveal is simply placed where the film
       says, which for a long hold at the last stop is somewhere inside its own
       loop. */
    const rR = rest(T_THRESHOLD, t, rate);
    const rW = rest(T_BED_OUT, t, rate);
    const gR = LVL_REVEAL * rise(t, T_REVEAL_IN, T_THRESHOLD);
    const gW = LVL_BED * fall(t, T_REVEAL_IN, T_BED_OUT);
    if (!fire("reveal", T_THRESHOLD, t, rate, gR, ENTRY, rR > 0.05 ? { to: LVL_REVEAL, over: rR } : null)) return;
    if (gW > 0.02) fire("walk", T_BED_IN, t, rate, gW, ENTRY, rW > 0.05 ? { to: 0, over: rW } : null);
    phase = "reveal";
    log("phase reveal (joined at " + t.toFixed(2) + ")");
  }
  function toBed(t, rate) {
    const d = span(T_BED_FULL, t, rate, 0.5);
    if (!fire("walk", T_BED_IN, t, rate, LVL_BED, d)) return;
    release("landing", d);
    phase = "bed";
    log("phase bed");
  }
  function toReveal(t, rate) {
    if (!fire("reveal", T_THRESHOLD, t, rate, LVL_REVEAL, span(T_THRESHOLD, t, rate, 0.4))) return;
    release("walk", span(T_BED_OUT, t, rate, 0.5));
    phase = "reveal";
    log("phase reveal");
  }
  /* The treasures are resolving out of the cloud and the score has nothing left
     to say. The fade is measured to the frame the film hands over on, so it is
     already silent when the page arrives rather than trailing across it -- the
     treasures page has no soundtrack, and the arrival should be quiet. Taking
     the span from now rather than from T_RESOLVE keeps that true at 2x, where
     the last two seconds of film are one second of wall clock. */
  function resolve(t, rate, dur) {
    if (phase === "out") return;
    phase = "out";
    const d = dur != null ? dur : Math.max(0.4, (T_END - t) / rate);
    log("phase out | fade", d.toFixed(2) + "s");
    for (const name of ORDER) release(name, d);
  }
  /* Switching off. The master fades rather than cuts, the sources are told to
     stop just after it lands, and the master is put back where it was a moment
     later -- by then there is nothing connected for it to be loud with. All of
     it is scheduled on the audio clock rather than in a setTimeout, because a
     backgrounded tab throttles timers to nothing and this has to finish
     cleanly whether or not the visitor is looking at the page.

     The phase goes back to idle in the same breath, so switching the score on
     again mid-journey re-enters wherever the film has got to instead of
     resuming a run that has already ended. */
  function quiet() {
    if (!ctx) { phase = "idle"; return; }
    const at = down(master.gain, 0.35);
    for (const name of ORDER) {
      const c = CUES[name];
      if (!c.src) continue;
      try { c.src.stop(at + 0.05); } catch (e) { /* nothing to stop */ }
      c.src = null;
    }
    master.gain.setValueAtTime(MASTER, at + 0.06);
    phase = "idle";
  }

  function running() {
    return wanted && ctx && ctx.state === "running";
  }

  /* ---------- switching it on ----------
     The thing this has to survive is that **a scroll cannot unlock audio**.
     The list of inputs a browser will accept as permission is short --
     mousedown, pointerdown, pointerup, touchend, keydown -- and `wheel` is not
     on it. This journey is driven by the wheel, so a visitor on a trackpad can
     scroll the whole way through without ever handing the page the one thing
     it needs. An attempt that gives up after the first input therefore gives
     up on the first scroll and never comes back.

     So every attempt is a retry. `asking` only keeps two from being in flight
     at once; the pill sets `force` and jumps that queue, because a click is
     the one input that is certain to work and it must never be the press that
     was thrown away.

     The context is created first and resumed second, and `wanted` is only set
     once the context is genuinely running -- so a refused resume leaves a
     graph ready for the next attempt and a pill still reading "Sound on",
     rather than a page that thinks it has sound and has not. */
  function adopt(why) {
    if (wanted || muted || !ctx || ctx.state !== "running") return;
    wanted = true;
    onchange(true, false);
    log("on (" + why + ")", "| rate", ctx.sampleRate, "| latency", latency().toFixed(4));
  }
  function start(force, why) {
    if (wanted || !graph()) return;
    load();
    if (asking && !force) return;
    asking = true;
    const done = () => { asking = false; };
    ctx.resume().then(() => { done(); adopt(why); }, done);
  }

  return {
    /* The score is meant to be on. This is the attempt to have it on from the
       first frame, and it is made three times over the first two seconds
       rather than once: the answer a browser gives at the instant a document
       parses is not always the answer it gives a moment later, once the film
       has started and the page has settled. Every attempt is silent if
       refused, and the buffers are fetched on the first one either way, so a
       later unlock has nothing to wait for.

       Only an explicit "off" this session stops it. */
    arm() {
      start(true, "allowed at load");
      setTimeout(() => { if (!wanted && !muted) start(true, "allowed at load"); }, 500);
      setTimeout(() => { if (!wanted && !muted) start(true, "allowed at load"); }, 2000);
    },
    /* Every input, not just the first: see start(). Held back only if the
       visitor has pressed the pill on this page. */
    wake() {
      if (wanted || muted) return;
      start(false, "interaction");
    },
    toggle() {
      if (wanted) {
        wanted = false;
        muted = true;
        onchange(false, false);   /* the pill is the way back, not a scroll */
        quiet();
        log("off (muted until this page is reloaded)");
        return false;
      }
      muted = false;
      start(true, "the pill");
      return true;
    },
    get on() { return wanted; },
    /* What the debug log is looking at, for the console: which cues decoded,
       where their first audible sample turned out to be, and what is sounding
       right now. */
    inspect() {
      const out = { phase: phase, on: wanted, ctx: ctx && ctx.state };
      for (const name of ORDER) {
        const c = CUES[name];
        out[name] = c.buffer ? {
          dur: +c.buffer.duration.toFixed(4),
          lead: +(c.lead || 0).toFixed(4),
          loop: c.loopStart != null ? [c.loopStart, c.loopEnd] : null,
          gain: +c.env.gain.value.toFixed(4),
          live: !!c.src
        } : null;
      }
      return out;
    },
    /* ---------- the film has gone backwards ----------
       The phases below only ever move forward: each is entered when the film
       reaches the second it was cut for, and nothing here ever un-enters one.
       That was true while the journey only walked forwards. It does not
       survive a rewind -- a film sent back behind the cue that opened the
       phase it is in would be scored by music that has not happened yet, and
       would stay that way, because no threshold is ever crossed again.

       So the run is stood down when, and only when, the film lands behind its
       own phase's opening cue. update() then finds `idle` on the next frame
       and rejoins at the second the film has actually landed on, which is
       exactly what switching the score on part-way through already does.
       Rewinding *within* a phase resets nothing: the music there is still the
       music for that second, and cutting it would be the louder mistake. */
    rewound(t) {
      const OPENED = { landing: 0, bed: T_BED_IN, reveal: T_REVEAL_IN, out: T_RESOLVE };
      if (!ctx || !(phase in OPENED)) return;
      if (t < OPENED[phase]) { log("rewound to " + t.toFixed(2) + " -- standing down " + phase); quiet(); }
    },
    /* Called every frame from render(), with the film's own clock. */
    update(t, playing, state, rate) {
      if (!running()) return;
      rate = rate || 1;
      /* On the project page and in a case study there is no score. By the time
         the film gets there the fade below has already finished; this is the
         backstop for every other way out -- the fast track, a deep link, the
         rescue when the film never arrives -- and it is short because those
         all arrive without warning. */
      if (state !== "playing" && state !== "hold") { resolve(t, rate, 0.6); return; }
      if (phase === "idle") enter(t, rate);
      else if (phase === "landing" && t >= T_BED_IN) toBed(t, rate);
      else if (phase === "bed" && t >= T_REVEAL_IN) toReveal(t, rate);
      else if (phase === "reveal" && t >= T_RESOLVE) resolve(t, rate);
      modulate(t, playing);
    }
  };
};
