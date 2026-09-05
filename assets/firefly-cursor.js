/* FireflyCursor — a few tiny lights that drift after the pointer.

     const flies = FireflyCursor();
     flies.setEnabled(true|false);   // parks the rAF loop and hides the canvas
     flies.destroy();

   Same shape as SplashCursor next door, and for the same reason: this site is
   one document with several states, so the thing that decides where an effect
   runs is the render loop, not a route. Built once, switched on for the case
   studies and off everywhere else.

   The two cursors are never on together — the fluid belongs to the treasures
   page, these belong to the case studies — so nothing here has to reason about
   the other one.

   The native cursor is left alone. These are a trail beside it, not a
   replacement for it, and the canvas takes no pointer events, so every link,
   button and hover state underneath behaves exactly as it did. */
window.FireflyCursor = function FireflyCursor(opts) {
  const o = opts || {};

  /* Touch-first devices and anyone who has asked for less motion never get a
     canvas at all -- not a hidden one, not a parked loop. Both are read once:
     a laptop does not grow a touchscreen mid-session, and a reduced-motion
     change fires a page-level media query that this file would only be
     duplicating. */
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || calm) return { setEnabled() {}, destroy() {} };

  /* These two set how many are in the air: roughly speed / GATE * lifetime,
     held under MAX. A hand moving at a readerly pace sits in the 6-14 the brief
     asks for; a fast sweep would want far more than that and meets the ceiling
     instead. Both are at the end of their stated ranges that gives fewer -- the
     effect is meant to be noticed only when looked for. */
  const MAX        = o.MAX ?? 18;    /* hard ceiling, however fast the pointer moves */
  const GATE       = o.GATE ?? 18;   /* px of travel between spawns */
  const JITTER     = 8;              /* px of slop around the spawn point */
  const LIFE_MIN   = 900, LIFE_MAX = 1600;

  const canvas = document.createElement("canvas");
  canvas.className = "firefly-cursor";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setEnabled() {}, destroy() {} };
  (o.parent || document.body).appendChild(canvas);

  let enabled = false, alive = true, rafId = null, last = 0;
  let px = 0, py = 0;                /* last spawn point, for the distance gate */
  let seeded = false;                /* has the pointer been seen at all yet */
  const flies = [];

  /* The one at the front is the cursor itself, so it is not a particle: it does
     not age, drift or expire, and it is drawn on the pointer rather than behind
     it. Losing the arrow costs two things a cursor was doing for free -- where
     exactly the click lands, and whether the thing under it is clickable -- so
     this is drawn on the exact pointer position (only the glow wanders) and it
     opens up over anything actionable, which is what the arrow's hand was for. */
  let hx = 0, hy = 0;
  let hasPointer = false;            /* false before the first move, and once it leaves */
  let hover = 0, hoverTo = 0;        /* eased, so the swell is a lean not a snap */
  const headPhase = Math.random() * Math.PI * 2;

  /* Cap DPR at 2. Past that the fill cost of two dozen soft gradients climbs
     for a glow nobody can resolve. */
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(innerWidth  * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width  = innerWidth  + "px";
    canvas.style.height = innerHeight + "px";
    /* draw in CSS pixels; the transform carries the density */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  const rand = (a, b) => a + Math.random() * (b - a);

  /* Roughly a third of them lean pink rather than gold. The case studies sit on
     plum and wine backgrounds, so a little of that warmth in the halo settles
     them into the page -- but the core stays pale yellow on all of them, because
     a pink light stops reading as a firefly. */
  function spawn(x, y, boost) {
    if (flies.length >= MAX) return;
    const size = rand(0.9, 1.6);          /* core radius: ~1.8-3.2px across */
    flies.push({
      x: x + rand(-JITTER, JITTER),
      y: y + rand(-JITTER, JITTER),
      vx: rand(-0.35, 0.35),
      vy: rand(-0.6, 0.15),               /* biased upward, the way they drift */
      size,
      halo: size * rand(3.8, 4.8),        /* ~7-15px across */
      age: 0,
      life: rand(LIFE_MIN, LIFE_MAX),
      phase: Math.random() * Math.PI * 2,
      flicker: rand(0.004, 0.009),        /* per ms, so a slow breath not a blink */
      drift: rand(0.0012, 0.0026),
      sway: rand(0.10, 0.30),
      peak: rand(0.55, 0.85) * (boost ? 1.18 : 1),
      pink: Math.random() < 0.34
    });
  }

  /* Anything the visitor can act on. Read only when a spawn is actually due,
     so the cost is a few closest() calls a second rather than one per event. */
  const ACTIONABLE = "a, button, [role='button'], input, select, textarea, summary, video, [tabindex]:not([tabindex='-1'])";

  function onMove(e) {
    if (e.pointerType === "touch") return;
    const x = e.clientX, y = e.clientY;
    /* The head follows every move without exception -- it is the cursor, and a
       cursor that only updates every 18px would be unusable. The gate below is
       about the trail alone.

       This is tracked even while switched off, so that opening a case study
       already knows where the pointer is. Otherwise the arrow would be hidden
       the instant the page opened and nothing drawn in its place until the
       visitor happened to move -- and they have just clicked, so they may not. */
    hx = x; hy = y; hasPointer = true;
    const over = e.target && e.target.closest ? !!e.target.closest(ACTIONABLE) : false;
    hoverTo = over ? 1 : 0;
    if (!enabled) return;
    start();
    /* First sighting, and every re-entry after the pointer has left the window,
       only records the position. Spawning off that first delta would draw a
       trail along a jump the pointer never made. */
    if (!seeded) { px = x; py = y; seeded = true; return; }
    if (Math.hypot(x - px, y - py) < GATE) return;
    px = x; py = y;
    spawn(x, y, over);
  }

  /* Leaving the window stops the spawning by itself -- no pointer, no
     pointermove -- so this only drops the anchor, and the survivors fade out on
     their own rather than being cleared. */
  function onOut(e) { if (!e.relatedTarget) { seeded = false; hasPointer = false; } }

  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerout", onOut, { passive: true });

  function frame(now) {
    const dt = Math.min(now - last, 64);   /* a backgrounded tab must not age them all at once */
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i];
      f.age += dt;
      if (f.age >= f.life) { flies.splice(i, 1); continue; }

      const k = f.age / f.life;
      f.x += f.vx * (dt / 16.667) + Math.sin(f.age * f.drift + f.phase) * f.sway * (dt / 16.667);
      f.y += f.vy * (dt / 16.667);

      /* up fast, hold, then a long fade -- and a slow breath over the top of it */
      const env = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      const a = Math.max(0, env * f.peak + Math.sin(f.age * f.flicker + f.phase) * 0.15 * env);
      if (a <= 0.001) continue;
      const scale = 0.6 + 0.4 * Math.min(1, k / 0.15) + Math.sin(f.age * f.flicker + f.phase) * 0.15;

      /* Halo additively, so overlapping lights pool instead of stacking edges.
         It is the part that vanishes over a bright photo, which is why the core
         below is drawn normally -- there it carries the firefly on its own. */
      ctx.globalCompositeOperation = "lighter";
      const r = f.halo * scale;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      if (f.pink) {
        g.addColorStop(0,    "rgba(255, 240, 190, " + (a * 0.55).toFixed(3) + ")");
        g.addColorStop(0.35, "rgba(255, 200, 165, " + (a * 0.22).toFixed(3) + ")");
        g.addColorStop(1,    "rgba(255, 180, 150, 0)");
      } else {
        g.addColorStop(0,    "rgba(255, 245, 180, " + (a * 0.55).toFixed(3) + ")");
        g.addColorStop(0.35, "rgba(255, 225, 120, " + (a * 0.22).toFixed(3) + ")");
        g.addColorStop(1,    "rgba(255, 220, 100, 0)");
      }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();

      /* Amber rather than the cream it reads as on a dark page. Over the plum
         backgrounds the halo swamps the difference, but over a white nav or a
         bright photo panel the cream came within 37/255 of the paper and simply
         went missing, where this stays about 100 clear of it. The page pixels
         cannot be sampled from a transparent canvas, so the colour that works on
         both is chosen once here rather than adapted per frame. */
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255, 226, 146, " + (a * 0.9).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(f.x, f.y, f.size * scale, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    /* The head, last, so it sits over its own trail. */
    if (enabled && hasPointer) {
      hover += (hoverTo - hover) * 0.12;
      const pulse = 0.86 + Math.sin(now * 0.005 + headPhase) * 0.14;
      /* Only the glow wanders. The core stays on the pointer, because this is
         what the visitor is aiming with. */
      const gx = hx + Math.sin(now * 0.0016 + headPhase) * 1.6;
      const gy = hy + Math.cos(now * 0.0021 + headPhase * 1.7) * 1.3;
      const grow = pulse * (1 + hover * 0.38);
      const R = 11 * grow;

      ctx.globalCompositeOperation = "lighter";
      const hg = ctx.createRadialGradient(gx, gy, 0, gx, gy, R);
      hg.addColorStop(0,    "rgba(255, 245, 190, " + (0.46 + hover * 0.16).toFixed(3) + ")");
      hg.addColorStop(0.35, "rgba(255, 228, 130, " + (0.19 + hover * 0.07).toFixed(3) + ")");
      hg.addColorStop(1,    "rgba(255, 220, 100, 0)");
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(gx, gy, R, 0, Math.PI * 2); ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255, 226, 146, 0.95)";
      ctx.beginPath(); ctx.arc(hx, hy, 2.1 * grow, 0, Math.PI * 2); ctx.fill();
    }

    /* Park the loop when there is nothing left to draw. The head counts as
       something: while a case study is open and the pointer is on it, this runs
       so the glow can breathe. Off the page, or with the pointer gone, the last
       trail fades out and the loop stops. */
    if (!alive) { rafId = null; return; }
    if (!flies.length && !(enabled && hasPointer)) { rafId = null; return; }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId === null) { last = performance.now(); rafId = requestAnimationFrame(frame); }
  }

  return {
    setEnabled(on) {
      on = !!on;
      if (on === enabled) return;
      enabled = on;
      canvas.classList.toggle("on", on);
      /* Only ever set from here, so the native cursor is hidden exactly when
         there is a firefly standing in for it -- never on a touch device or
         under reduced motion, where this controller is the inert one and this
         line does not run at all. */
      document.documentElement.classList.toggle("firefly-live", on);
      /* Off means stop spawning, not stop drawing: whatever is in the air
         finishes its fade and the loop parks itself. */
      if (!on) seeded = false;
      /* Coming back, the head is wanted straight away rather than on the next
         move -- a case study is opened by a click, and the pointer may not move
         again for a while. */
      else if (hasPointer) start();
    },
    destroy() {
      alive = false; enabled = false; hasPointer = false;
      document.documentElement.classList.remove("firefly-live");
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerout", onOut);
      removeEventListener("resize", resize);
      canvas.remove();
    }
  };
};
