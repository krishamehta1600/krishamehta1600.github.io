/* Atmosphere — glowing dust the visitor travels through.

     const air = Atmosphere({ ...opts });
     air.setEnabled(true|false);
     air.setMotion(progress, filmMoving, stateName);
     air.destroy();

   DEBUG: ?atmos=debug, or atmosphereDebug(true|false) from the console. Tints
   each depth class so the layering is legible, exaggerates opacity, and logs
   velocity / progress / intensity / counts. Silent otherwise.

   ---- what moves in this page

   The page does not scroll: html and body are overflow:hidden at 100vh, so
   window.scrollY is 0 throughout. The wheel is a *gate* -- one gesture moves
   the film from a hold to the next segment -- and scroll is ignored while a
   segment plays. Two things therefore mean "travelling", and both feed in:
   the film's own clock (journey.currentTime, what actually drives the picture)
   as a baseline, and wheel/touch deltas integrated into a virtual scroll
   position and smoothed off that, which is what makes a trackpad's long tail
   of small deltas read like a wheel's few large ones.

   ---- one layer, round, and drawn as sprites

   Only soft circular particles. No wisps, streaks or trails, and nothing is
   ever elongated by velocity -- speed changes how fast a particle travels, how
   many there are and how strongly they glow, never their shape.

   Each family is pre-rendered once into an offscreen sprite and blitted with
   drawImage, rather than building two radial gradients per particle per frame.
   At forty-odd particles that is the difference between ninety gradient
   allocations a frame and none, which is what makes this size of field
   affordable next to a decoding MP4. */
window.__atmosphereLive = window.__atmosphereLive || new Set();
window.atmosphereDebug = function (on) {
  window.__atmosphereLive.forEach(fn => fn(!!on));
  console.log("[ATMOSPHERE] DEBUG", on ? "ON" : "OFF",
              "(" + window.__atmosphereLive.size + ")");
  return !!on;
};
window.Atmosphere = function Atmosphere(opts) {
  const o = opts || {};
  const coarse = !matchMedia("(hover: hover) and (pointer: fine)").matches;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let DEBUG = /(\?|&)atmos=debug/.test(location.search);

  const base = {
    MAX_PARTICLES: o.MAX_PARTICLES ?? (coarse ? 22 : 48),
    MAX_HEROES:    o.MAX_HEROES    ?? (coarse ? 1 : 4),
    FILM_WEIGHT:   o.FILM_WEIGHT   ?? 0.45,
    SCROLL_SCALE:  o.SCROLL_SCALE  ?? 700,
    DISTORT:       o.DISTORT       ?? !coarse,
    DISTORT_MAX:   o.DISTORT_MAX   ?? 4,
    GLOW_MAX:      o.GLOW_MAX      ?? 0.06,   /* the wash carries none of the drama */
    DPR_CAP:       o.DPR_CAP       ?? (coarse ? 1.5 : 2),
    target:        o.target        ?? null
  };
  if (calm) { base.MAX_PARTICLES = 8; base.MAX_HEROES = 0; base.DISTORT = false; base.FILM_WEIGHT = 0; base.GLOW_MAX = 0.02; }

  const cfg = Object.assign({}, base);

  const canvas = document.createElement("canvas");
  canvas.className = "atmosphere";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setEnabled() {}, setMotion() {}, setProgress() {}, destroy() {} };
  (o.parent || document.body).appendChild(canvas);

  /* Each family is core -> inner halo -> outer bloom. The dark ones matter
     most: a wine core with a rose bloom around it stays visually dark while
     still reading as lit, which is how the deep section gets richer rather
     than merely darker. */
  const FAMILY = {
    pale:   { core: [255, 217, 230], halo: [244, 161, 188], bloom: [225, 108, 150] },
    rose:   { core: [225, 108, 150], halo: [200,  74, 120], bloom: [176,  58, 102] },
    wine:   { core: [ 79,  16,  40], halo: [142,  40,  77], bloom: [214,  91, 135] },
    maroon: { core: [104,  23,  47], halo: [142,  40,  77], bloom: [190,  76, 120] }
  };
  const DEBUG_TINT = { small: [90, 200, 255], medium: [120, 255, 150], large: [255, 190, 90], hero: [255, 255, 255] };

  /* one 128px sprite per family, built once */
  const SPRITE = {};
  function buildSprites() {
    for (const name in FAMILY) {
      const f = FAMILY[name];
      const s = document.createElement("canvas");
      s.width = s.height = 128;
      const c = s.getContext("2d");
      const rgb = a => "rgba(" + a[0] + "," + a[1] + "," + a[2] + ",";
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0.00, rgb(f.core) + "1)");
      g.addColorStop(0.13, rgb(f.core) + "0.92)");
      g.addColorStop(0.21, rgb(f.halo) + "0.66)");
      g.addColorStop(0.42, rgb(f.bloom) + "0.26)");
      g.addColorStop(0.70, rgb(f.bloom) + "0.075)");
      g.addColorStop(1.00, rgb(f.bloom) + "0)");
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      SPRITE[name] = s;

      /* A separate, far more diffuse build for the foreground orbs. Scaling
         the sharp sprite up just gives a big hard dot with a ring; something
         passing close to camera has no hard centre at all, so this one has a
         broad soft body -- readable out to about a third of its radius -- and
         a long tail beyond it. */
      const s2 = document.createElement("canvas");
      s2.width = s2.height = 128;
      const c2 = s2.getContext("2d");
      const g2 = c2.createRadialGradient(64, 64, 0, 64, 64, 64);
      g2.addColorStop(0.00, rgb(f.core) + "0.80)");
      g2.addColorStop(0.18, rgb(f.core) + "0.62)");
      g2.addColorStop(0.34, rgb(f.halo) + "0.40)");
      g2.addColorStop(0.58, rgb(f.bloom) + "0.17)");
      g2.addColorStop(0.80, rgb(f.bloom) + "0.055)");
      g2.addColorStop(1.00, rgb(f.bloom) + "0)");
      c2.fillStyle = g2; c2.fillRect(0, 0, 128, 128);
      SPRITE[name + "_soft"] = s2;
    }
    for (const k in DEBUG_TINT) {
      const t = DEBUG_TINT[k];
      const s = document.createElement("canvas");
      s.width = s.height = 128;
      const c = s.getContext("2d");
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0.00, "rgba(" + t[0] + "," + t[1] + "," + t[2] + ",1)");
      g.addColorStop(0.20, "rgba(" + t[0] + "," + t[1] + "," + t[2] + ",0.7)");
      g.addColorStop(1.00, "rgba(" + t[0] + "," + t[1] + "," + t[2] + ",0)");
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      SPRITE["dbg_" + k] = s;
    }
  }
  buildSprites();

  function applyDebug() {
    if (DEBUG) { cfg.MAX_PARTICLES = 56; cfg.MAX_HEROES = 6; cfg.GLOW_MAX = 0.12; canvas.style.zIndex = "20"; }
    else { Object.assign(cfg, base); canvas.style.zIndex = ""; }
  }
  applyDebug();

  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---- the journey's own curve ----
     Atmosphere intensity, keyframed. Everything downstream reads from it:
     how many particles, how large, how bright, how fast, how dark the mix and
     whether the big foreground orbs are allowed through at all. */
  /* Pulled about ten points earlier than it was. The charge belongs to the
     dark descent and the tunnel, and peaks at the gateway; by the time the
     bright cloud world arrives there is very little contrast left to work
     against, so the effect is already on its way out by then. */
  const CURVE = [[0,0.05],[0.12,0.18],[0.24,0.42],[0.36,0.72],[0.48,0.92],
                 [0.56,1.00],[0.66,1.00],[0.74,0.70],[0.82,0.36],[0.90,0.12],[0.96,0.02],[1,0]];
  const COUNT = [[0,6],[0.15,10],[0.22,14],[0.34,22],[0.44,28],[0.56,38],
                 [0.66,42],[0.74,26],[0.82,14],[0.90,6],[1,0]];
  function curve(tbl, p) {
    for (let i = 1; i < tbl.length; i++) {
      if (p <= tbl[i][0]) {
        const a = tbl[i - 1], b = tbl[i];
        const t = (p - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return tbl[tbl.length - 1][1];
  }

  /* pale : rose : wine : maroon, from roughly 55/30/10/5 at the mouth to
     15/25/35/25 deep in -- the scene genuinely darkens as it goes */
  function family(k) {
    const pale = 0.55 - 0.40 * k, rose = 0.30 - 0.05 * k, wine = 0.10 + 0.25 * k;
    const r = Math.random();
    if (r < pale) return "pale";
    if (r < pale + rose) return "rose";
    if (r < pale + rose + wine) return "wine";
    return "maroon";
  }

  let W = 0, H = 0, dpr = 1, glowGrad = null;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, cfg.DPR_CAP);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    glowGrad = ctx.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, Math.max(W, H) * 0.62);
    glowGrad.addColorStop(0, "rgba(225,108,150,1)");
    glowGrad.addColorStop(0.5, "rgba(142,40,77,0.45)");
    glowGrad.addColorStop(1, "rgba(79,16,40,0)");
  }
  resize();
  addEventListener("resize", resize);

  let vpos = 0, vlast = 0, vel = 0, dir = 1;
  let enabled = false, alive = true, rafId = null, last = 0;
  let fade = 0, progress = 0, film = 0, stateName = "";
  let glow = 0, warp = 0, logAt = 0, heroes = 0;
  const parts = [], pool = [];

  function onWheel(e) { vpos += e.deltaY; if (enabled) start(); }
  let ty = null;
  function onTouchStart(e) { ty = e.touches[0].clientY; }
  function onTouchMove(e) { if (ty === null) return; const y = e.touches[0].clientY; vpos += (ty - y); ty = y; if (enabled) start(); }
  function onTouchEnd() { ty = null; }
  addEventListener("wheel", onWheel, { passive: true });
  addEventListener("touchstart", onTouchStart, { passive: true });
  addEventListener("touchmove", onTouchMove, { passive: true });
  addEventListener("touchend", onTouchEnd, { passive: true });

  /* R is the bloom radius; the sprite puts the readable core at about 0.18 of
     it, so these give roughly 2-5px, 5-9px, 9-16px and 16-28px of visible body
     with the bloom reaching well past it. */
  function spawn(k) {
    if (parts.length >= cfg.MAX_PARTICLES) return;
    /* Mostly small. The depth comes from how far apart the classes sit, not
       from how many of the big ones there are -- three or four foreground orbs
       at a time do more for it than twenty extra dots. */
    const roll = Math.random();
    let cls;
    if (roll < 0.60) cls = "small";
    else if (roll < 0.90) cls = "medium";
    else if (roll < 0.96) cls = "large";
    else cls = (k > 0.45 && heroes < cfg.MAX_HEROES) ? "hero" : "large";

    const q = pool.pop() || {};
    q.cls = cls;
    /* R is the bloom radius. Small keeps the size it had; medium is close to
       twice it; the foreground pair are far beyond both, and drawn from the
       soft sprite so they read as out-of-focus rather than merely big. */
    if (cls === "small")       { q.R = rand(7, 13);   q.speed = 0.28; }
    else if (cls === "medium") { q.R = rand(16, 30);  q.speed = 0.85; }
    else if (cls === "large")  { q.R = rand(22, 34);  q.speed = 1.90; }
    else                       { q.R = rand(30, 46);  q.speed = 2.80; heroes++; }
    q.soft = (cls === "large" || cls === "hero");

    /* Brightness is deliberately lopsided: most are barely there, a handful
       read clearly, and roughly one in twenty comes through as a focal point.
       Uniform brightness is what made the field look like a flat layer of
       identical dots however large they got. */
    /* The hierarchy is: many subtle, several clearly read, a few dramatic --
       so which tier a particle draws from depends on its class. The small ones
       are mostly the subtle layer; the foreground pair never draw from it at
       all, because a big soft orb at low opacity is just a smudge, and those
       few are meant to be the moments the visitor actually notices. */
    const lumRoll = Math.random();
    const fore = (cls === "large" || cls === "hero");
    const lum = fore
      ? (lumRoll < 0.55 ? rand(1.00, 1.35) : rand(1.55, 2.05))
      : (lumRoll < (cls === "small" ? 0.70 : 0.55) ? rand(0.55, 0.88)
         : lumRoll < 0.93 ? rand(1.00, 1.30)
         : rand(1.50, 1.95));
    const bandBase = cls === "small" ? 0.32 : cls === "medium" ? 0.46 : cls === "large" ? 0.55 : 0.62;
    q.alpha = Math.min(0.95, bandBase * lum);
    /* the rare one that blooms up through its middle life */
    q.focal = lumRoll > 0.95;

    q.fam = family(k);
    /* Heroes lean dark: a big pale orb reads as a smudge on the lens, a big
       wine one reads as something passing close to camera. */
    if (cls === "hero" && Math.random() < 0.7) q.fam = Math.random() < 0.5 ? "wine" : "maroon";

    if (cls === "hero" || cls === "large") {
      /* Out at the edges and often past them, so they are cropped by the
         viewport and read as existing beyond the frame rather than floating
         inside it -- and so they keep clear of the astronaut. */
      q.x = (Math.random() < 0.5 ? rand(-0.14, 0.24) : rand(0.76, 1.14)) * W;
      q.y = rand(-0.14, 1.14) * H;
      q.lean = (q.x < W / 2 ? -1 : 1) * rand(0.20, 0.65);   /* drift further out */
    } else if (parts.length && Math.random() < 0.20) {
      const n = parts[(Math.random() * parts.length) | 0];
      q.x = n.x + rand(-90, 90); q.y = n.y + rand(-90, 90);
      q.lean = rand(-0.45, 0.45);
    } else {
      q.x = rand(-0.06, 1.06) * W; q.y = rand(-0.06, 1.06) * H;
      q.lean = rand(-0.45, 0.45);
    }
    q.drift = rand(0.0005, 0.0016);
    q.phase = Math.random() * Math.PI * 2;
    q.sway = rand(0.05, 0.22);
    q.vy = rand(-0.10, 0.10);            /* its own slow vertical wander */
    q.age = 0;
    q.life = rand(1800, 4200) * (cls === "small" ? 1.3 : cls === "hero" ? 1.5 : 1);
    parts.push(q);
  }

  function frame(now) {
    const raw_dt = now - last; last = now;
    const dt = Math.min(raw_dt, 64);      /* ageing */
    const cdt = Math.min(raw_dt, 250);    /* control signals */
    const k_ = t => 1 - Math.exp(-t * cdt / 1000);

    const rawVel = (vpos - vlast) * 1000 / Math.max(cdt, 1);
    vlast = vpos;
    vel += (rawVel - vel) * k_(6);
    if (Math.abs(vel) > 3) dir += ((vel > 0 ? 1 : -1) - dir) * k_(6.5);

    fade += ((enabled ? 1 : 0) - fade) * k_(enabled ? 6 : 3.2);

    const scrollPush = Math.min(1, Math.abs(vel) / cfg.SCROLL_SCALE);
    const travel = enabled ? Math.min(1, film * cfg.FILM_WEIGHT + scrollPush) : 0;
    const K = curve(CURVE, progress);                  /* atmosphere intensity */
    const A = fade * (0.35 + 0.65 * K);                /* what actually reaches the screen */

    if (DEBUG && now - logAt > 250) {
      logAt = now;
      console.log("[ATMOSPHERE]", "state:", stateName, "| vel:", vel.toFixed(0),
        "| progress:", progress.toFixed(3), "| intensity:", K.toFixed(2),
        "| travel:", travel.toFixed(2), "| particles:", parts.length,
        "| heroes:", heroes, "| target:", Math.round(curve(COUNT, progress)));
    }

    glow += (travel - glow) * k_(travel > glow ? 3.2 : 1.6);
    warp += (travel * dir - warp) * k_(travel > Math.abs(warp) ? 4 : 2.2);
    if (travel === 0 && Math.abs(warp) < 0.006) warp = 0;

    if (cfg.DISTORT && cfg.target) {
      const px = -warp * cfg.DISTORT_MAX;
      const sc = 1 + Math.abs(warp) * 0.0022;
      cfg.target.style.transform = (Math.abs(px) < 0.02 && sc < 1.0001)
        ? "" : "translate3d(0," + px.toFixed(2) + "px,0) scale(" + sc.toFixed(5) + ")";
    }

    ctx.clearRect(0, 0, W, H);
    if (A > 0.002) {
      const ga = cfg.GLOW_MAX * A * (0.3 + glow * 0.7);
      if (ga > 0.002) {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = ga; ctx.fillStyle = glowGrad; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = "source-over";

      const wantP = Math.round(curve(COUNT, progress) * (DEBUG ? 1.25 : 0.88 + travel * 0.24));
      let budget = 6;
      while (enabled && budget-- > 0 && parts.length < Math.min(cfg.MAX_PARTICLES, wantP)) spawn(K);

      /* far first, so the big near ones land on top and read as foreground */
      parts.sort((a, b) => a.speed - b.speed);
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.age += dt;
        const gone = q.age >= q.life;
        if (!gone) {
          const f = dt / 16.667;
          /* Parallax: the near ones travel several times faster than the far
             ones, which is what makes this read as a camera moving through a
             field rather than dots over a video. Speed only -- never shape. */
          const push = (0.14 + travel * 4.6) * q.speed;
          q.y -= push * dir * f;
          q.x += (push * q.lean * 0.5 + Math.sin(q.age * q.drift + q.phase) * q.sway) * f;
          q.y += q.vy * f;
        }
        if (gone || q.y < -q.R - 20 || q.y > H + q.R + 20 || q.x < -q.R - 20 || q.x > W + q.R + 20) {
          if (q.cls === "hero") heroes--;
          parts.splice(i, 1); pool.push(q); continue;
        }
        const t = q.age / q.life;
        const shape = t < 0.14 ? t / 0.14 : t > 0.72 ? (1 - t) / 0.28 : 1;
        /* a focal particle swells through the middle of its life and settles
           again -- a brief bright moment rather than a permanently bright dot */
        const focal = q.focal ? 1 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.15) / 0.6))) : 1;
        const a = q.alpha * shape * focal * A * (DEBUG ? 1.35 : 1);
        if (a < 0.004) continue;
        /* size rides the journey a little, so the deep section is larger as
           well as busier */
        const R = q.R * (0.72 + 0.28 * K);
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.drawImage(DEBUG ? SPRITE["dbg_" + q.cls] : SPRITE[q.soft ? q.fam + "_soft" : q.fam],
                      q.x - R, q.y - R, R * 2, R * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    if (!alive) { rafId = null; return; }
    if (!enabled && fade < 0.004 && !parts.length && Math.abs(warp) < 0.01) {
      rafId = null; heroes = 0;
      ctx.clearRect(0, 0, W, H);
      if (cfg.target) cfg.target.style.transform = "";
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() { if (rafId === null) { last = performance.now(); rafId = requestAnimationFrame(frame); } }

  const api = {
    setEnabled(on) {
      on = !!on;
      if (on === enabled) return;
      enabled = on;
      if (on) { vlast = vpos; last = performance.now(); }
      else { film = 0; vel = 0; }
      if (DEBUG) console.log("[ATMOSPHERE] enabled:", on);
      start();
    },
    setMotion(p, filmMoving, name) {
      progress = Math.max(0, Math.min(1, p || 0));
      film = filmMoving ? 1 : 0;
      if (DEBUG && name !== stateName) console.log("[ATMOSPHERE] state:", stateName, "->", name);
      stateName = name || stateName;
      if (enabled) start();
    },
    setProgress(p, filmMoving, name) { api.setMotion(p, filmMoving, name); },
    destroy() {
      alive = false; enabled = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      removeEventListener("wheel", onWheel);
      removeEventListener("touchstart", onTouchStart);
      removeEventListener("touchmove", onTouchMove);
      removeEventListener("touchend", onTouchEnd);
      removeEventListener("resize", resize);
      if (cfg.target) cfg.target.style.transform = "";
      canvas.remove();
      window.__atmosphereLive.delete(setDebug);
    }
  };
  function setDebug(on) { DEBUG = !!on; applyDebug(); parts.length = 0; heroes = 0; start(); return DEBUG; }
  window.__atmosphereLive.add(setDebug);
  if (DEBUG) console.log("[ATMOSPHERE] DEBUG ON via ?atmos=debug");
  return api;
};
