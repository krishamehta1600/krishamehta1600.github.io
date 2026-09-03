#!/usr/bin/env python3
"""Rebuild the plate the Project page is drawn from.

The high-res cutout overlay has been removed: the page now shows the frame the
video renders, treasures and all, with the hotspots as click targets over it.
So the plate is simply that frame -- nothing is erased and nothing is drawn
back. Set OVERLAY = True to bring the cutouts back; the machinery below (erase,
inpaint, relight, contact shadows) is kept for that, and everything it needs is
still measured off tools/lastframe.png.

Original note, for when the overlay is on:

The Project page IS the last frame of assets/main.mp4 -- the journey does not
cut to a separate page, it hands over to a live one that looks identical. So
the plate is built from that frame: decode it, erase the ten treasures painted
into it, and let index.html draw the high-res cutouts back over the holes at
the same size and place. Nothing is scaled or re-framed, which is what keeps
the handover invisible.

The cutouts are re-renders of the treasures rather than upscales, so they never
land on the old silhouettes exactly -- laying one over the original leaves the
original poking out around it. Hence erasing first: mask the cutout's alpha
where the cutout will sit, inpaint that away, and only then draw.

The erase has to stay UNDER the cutout that covers it. Inpainted pixels are
smooth and the scene around them is not, so any erased pixel the cutout does
not cover reads as a blurred halo -- which is what an 18px dilation gave every
treasure. So the dilation is 1px, just enough to swallow the old edge, and each
box is sized to cover the object it replaces rather than to match it.

    pip install Pillow numpy opencv-python-headless
    python3 tools/treasures.py

Writes assets/proj/*.webp and assets/bg/project.jpg (1920x1080). Both are
derived from the video and the source PNGs, so it is safe to re-run.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, cv2, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/"
SRC = os.path.expanduser(
    "~/Desktop/KRISHAS PORTFOLIO WEBSITE /FRAMES/CLICKABLE PROJECT IMAGES/")
OVERLAY = False       # draw high-res cutouts over the plate?
MAXEDGE, QUALITY, DILATE = 1400, 76, 1
# method=4, not 6. libwebp's exhaustive search goes pathological on cutouts with
# a lot of partial alpha -- Knorr, at 8% partial, takes 613s at method=6 and
# 0.3s at 4, for 6% more bytes. The whole rebuild is seconds instead of 20min.
METHOD = 4

# id -> (source PNG, art box in the video's 1920x1080 frame). The art boxes are
# also in HOTSPOTS in index.html and the two have to agree -- the box is where
# the cutout is drawn, and it is what decides which part of the plate is erased.
# They were found by template-matching each treasure into the frame, one at a
# time: the frame and the old 1920x1248 plate are the same scene but not one
# rigid transform apart, so a single global mapping does not fit all ten.
TREASURES = {
    "wipro":           ("WIPRO CHAIR.png",       [1042, 238, 1198, 498]),
    "youlry":          ("YOULRY.png",            [1567, 592, 1920, 890]),
    "wewe-uzuri":      ("WEWE UZURI.png",        [697, 379, 865, 591]),
    "stasis":          ("THESIS & STASIS.png",   [261, 553, 573, 821]),
    "tcs":             ("TCS.png",               [1647, 260, 1879, 448]),
    "godrej":          ("GODREJ HOMES.png",      [1124, 521, 1482, 723]),
    "royal-sundaram":  ("ROYAL SUNDARAM.png",    [1319, 190, 1517, 466]),
    "knorr":           ("KNORR.png",             [364, 119, 734, 374]),
    "amarula":         ("AMARULA.png",           [1480, 626, 1604, 1004]),
    "phonepe":         ("PHONE PE.png",          [137, 231, 273, 558]),
}

# Treasures that stand on something, and so cannot just be dropped in place: a
# cutout with no ground under it and no shadow on it reads as pasted on however
# well it is placed.
#
#   ground  the contact line. The erase stops here, leaving the pedestal and
#           the flowers untouched, and the contact shadow is drawn along it.
#   grade   how far to pull the cutout's colour toward the light around it.
#           These are studio-lit product shots going into a warm, hazy scene.
#   lift    how much haze to put back into the shadows, same reason.
# The Stasis box is sized off the pair it replaces -- 289x239 at (303, 556),
# measured off the frame -- but scaled to the cutout's own aspect by WIDTH, so
# it comes out 10px taller and covers that footprint whole. Matching the height
# instead left the old white bottle sticking out to the right of it.
# Emptied for the new render: every ground line, shadow and relight below was
# measured off the old frame, and none of those measurements survive a new
# scene. They get re-derived once the plain pass shows what needs them.
GROUNDED = {}

# Treasures whose replacement is a different SHAPE, not just a different size.
# The Wipro chair is the case: its box already matches the one the render
# painted to within 2px, but the two chairs have different armrests, headrest
# and base spread, so a quarter of the old chair falls outside the new cutout
# and shows around it -- one chair behind the other. No scaling fixes that;
# even at 1.12x, 5% of the old chair still escapes.
#
# So for these, erase what the render actually painted rather than what we are
# about to draw: inpaint a generous region to estimate the background behind
# the object, then take whatever the frame disagrees with by more than
# `thresh`. Scored against the chair segmented by colour, this finds all of it.
#
# `grow` then takes the rim light with it. The chair is backlit, so a bright
# 1-2px line traces its edge just outside the body -- too thin to survive the
# open(3), and left behind it read as a pale outline of the old chair standing
# next to the new one. Widening the erase past it is what finally cleared it.
# Only where a remnant actually shows. Running it on all ten put the halo back
# up from 10% of the erase to 22%: on a treasure whose cutout already covers
# the old one, the detector just finds the scene around it and erases that too.
DETECT = {}

# Which picture the plate is built on depends on which mode we are in.
#
# With OVERLAY off the plate IS the Project page, and the page wants the
# high-res composite -- tools/lastframe-highres.png, a copy of the Desktop's
# "LAST FRAME - HIGH RES PROJECTS.png". Building it from the video frame
# instead is what this script used to do, and it is why the page shipped with
# the treasures at the video's own detail. Nothing is erased in this mode, so
# there is no reason to start from anything softer.
#
# With OVERLAY on we need the pristine frame instead: tools/lastframe.png is
# the video's last frame as it was BEFORE the finished composite was baked into
# the mp4, and the erase step has to cut treasures out of a frame that does not
# already have high-res ones in it, or the script erases its own output.
PLATE_SRC = ROOT + ("tools/lastframe.png" if OVERLAY
                    else "tools/lastframe-highres.png")
if os.path.exists(PLATE_SRC):
    bg = np.asarray(Image.open(PLATE_SRC).convert("RGB"))
elif os.path.exists(ROOT + "tools/lastframe.png"):
    bg = np.asarray(Image.open(ROOT + "tools/lastframe.png").convert("RGB"))
else:
    cap = cv2.VideoCapture(ROOT + "assets/main.mp4")
    frame = None
    while True:                   # the frame the player freezes on is the last one
        ok, f = cap.read()
        if not ok: break
        frame = f
    cap.release()
    if frame is None:
        raise SystemExit("could not decode assets/main.mp4")
    bg = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
H, W = bg.shape[:2]


def scene_light(box, ring=70):
    """The ambient colour around a box, and the direction it brightens in.

    Measured off the frame rather than chosen, so a treasure is lit by whatever
    is actually around it.
    """
    x0, y0, x1, y1 = box
    bx0, by0 = max(0, x0 - ring), max(0, y0 - ring)
    bx1, by1 = min(W, x1 + ring), min(H, y1 + ring)
    band = bg[by0:by1, bx0:bx1].astype(np.float64)
    outside = np.ones(band.shape[:2], bool)
    outside[y0 - by0:y1 - by0, x0 - bx0:x1 - bx0] = False
    amb = band[outside].reshape(-1, 3).mean(0)
    lum = band @ np.array([0.2126, 0.7152, 0.0722])
    ys, xs = np.nonzero(outside)
    A = np.c_[xs - lum.shape[1] / 2, ys - lum.shape[0] / 2, np.ones(xs.size)]
    coef, *_ = np.linalg.lstsq(A, lum[outside], rcond=None)
    L = np.array([coef[0], coef[1]])
    n = np.hypot(*L)
    return amb, (L / n if n > 1e-9 else np.array([0.0, -1.0]))


def relight(im, box, key, rim, rimpx, haze, contrast, ao, aopx):
    """Relight a studio cutout with the scene's own light.

    A flat tint toward the average nearby colour was not enough: what makes a
    product shot read as dropped in is that its key comes from nowhere, its
    blacks are blacker than anything in the scene, and it sits in no occlusion.
    So: veil it to the local haze, compress its range, ramp a key across it
    along the direction the surroundings actually brighten in, wrap a rim onto
    the edges that face that direction, and darken its foot.

    Geometry is in cutout pixels, so the px parameters are scaled from the box
    the cutout will be drawn at -- the asset is stored larger, for the zoom.
    """
    x0, y0, x1, y1 = box
    s = im.width / float(x1 - x0)
    a = np.asarray(im.getchannel("A"), np.float64) / 255.0
    c = np.asarray(im.convert("RGB"), np.float64)
    amb, L = scene_light(box)

    lum = c @ np.array([0.2126, 0.7152, 0.0722])
    mid = lum[a > .6].mean() if (a > .6).any() else 128.0
    c = mid + (c - mid) * contrast                      # the scene has no deep blacks
    # Haze weighted toward the shadows. Veiling everything equally dragged the
    # caps down to grey, and in the frame they are the brightest thing there.
    hw = haze * (1.0 - np.clip(lum / 255.0, 0, 1)[..., None]) ** 1.2
    c = c * (1 - hw) + amb * hw

    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    u = (xx - w / 2) / (w / 2.0)
    v = (yy - h / 2) / (h / 2.0)
    # L points the way the surroundings get brighter, so a pixel offset that way
    # from the centre gets more light. (Signing this the other way lit the object
    # from the dark side and flattened the caps.)
    c *= np.clip(1.0 + key * (u * L[0] + v * L[1]), 0.55, 1.75)[..., None]

    dist = cv2.distanceTransform((a > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    gy, gx = np.gradient(dist)
    gn = np.hypot(gx, gy) + 1e-9
    facing = np.clip(-(gx / gn * L[0] + gy / gn * L[1]), 0, 1)
    band = np.clip(1.0 - dist / (rimpx * s), 0, 1) ** 2
    c += (amb * 1.3)[None, None, :] * (rim * band * facing * a)[..., None]

    foot = np.clip((v - (1 - 2 * aopx)) / (2 * aopx), 0, 1)
    c *= (1 - ao * foot ** 2)[..., None]

    c = np.where(a[..., None] > 0, c, np.asarray(im.convert("RGB"), np.float64))
    return Image.fromarray(np.dstack([np.clip(c, 0, 255), a * 255]).astype(np.uint8))


def grade_to_scene(im, box, amount, lift):
    """Pull a cutout's colour toward the light in the ring around where it sits."""
    x0, y0, x1, y1 = box
    scene = bg[max(0, y0 - 60):min(H, y1 + 60),
               max(0, x0 - 60):min(W, x1 + 60)].reshape(-1, 3).mean(0)
    a = np.asarray(im.getchannel("A"), float) / 255
    rgb = np.asarray(im.convert("RGB"), float)
    gain = 1 + (np.clip(scene / np.maximum(rgb[a > .6].mean(0), 1e-6), .75, 1.35) - 1) * amount
    g = rgb * gain
    g = g + (scene - g) * lift * (1 - g.mean(2, keepdims=True) / 255)
    # leave the fully transparent pixels alone: grading them turns the flat RGB
    # under the cutout into noise, which the encoder then has to store
    g = np.where(a[..., None] > 0, g, rgb)
    return Image.fromarray(np.dstack([np.clip(g, 0, 255), a * 255]).astype(np.uint8))


if not OVERLAY:
    Image.fromarray(bg).save(ROOT + "assets/bg/project.jpg", quality=91, optimize=True)
    print("overlay off: wrote assets/bg/project.jpg %dx%d straight from the frame"
          % (W, H))
    raise SystemExit

out = ROOT + "assets/proj/"
os.makedirs(out, exist_ok=True)
lit = {}                          # the relit cutouts, kept for their reflections
for cid, (fn, box) in TREASURES.items():
    im = Image.open(SRC + fn).convert("RGBA")
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    cfg = GROUNDED.get(cid)
    if cfg and cfg.get("relight"):     # at full resolution, before the downscale
        im = relight(im, box, **cfg["relight"])
    elif cfg and cfg.get("grade"):
        im = grade_to_scene(im, box, cfg["grade"], cfg["lift"])
    lit[cid] = im
    if max(im.size) > MAXEDGE:
        s = MAXEDGE / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(out + cid + ".webp", "WEBP", quality=QUALITY, method=METHOD)

def ellipse(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1,) * 2)


def painted_by_render(alpha, cfg):
    """What the render actually put here, whatever shape it was."""
    gen = cv2.dilate(alpha, ellipse(cfg["gen"]))
    est = cv2.inpaint(cv2.cvtColor(bg, cv2.COLOR_RGB2BGR), gen, 12, cv2.INPAINT_TELEA)
    dev = np.abs(cv2.cvtColor(est, cv2.COLOR_BGR2RGB).astype(float) - bg.astype(float)).max(2)
    obj = ((dev > cfg["thresh"]) & (gen > 0)).astype(np.uint8)
    obj = cv2.morphologyEx(obj, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return cv2.morphologyEx(obj, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)) * 255


def diffuse_fill(img, hole, iters=260, sigma=9):
    """Fill a hole by letting the background either side of it flow together.

    TELEA drags the pixels it finds at the mask boundary inward, so erasing a
    large dark object smears that object's own colour back into the gap -- the
    chair came out as a dark chair-shaped bruise. Diffusion instead lets the
    background meet in the middle, which is what the soft gradients and bokeh
    in this scene actually do.
    """
    known = img.astype(np.float32)
    f = known.copy()
    seed = cv2.inpaint(cv2.cvtColor(img, cv2.COLOR_RGB2BGR),
                       (hole * 255).astype(np.uint8), 20, cv2.INPAINT_TELEA)
    f[hole] = cv2.cvtColor(seed, cv2.COLOR_BGR2RGB).astype(np.float32)[hole]
    for _ in range(iters):
        f = cv2.GaussianBlur(f, (0, 0), sigma)
        f[~hole] = known[~hole]
    return np.clip(f, 0, 255).astype(np.uint8)


mask = np.zeros(bg.shape[:2], np.uint8)
for cid, (_, (x0, y0, x1, y1)) in TREASURES.items():
    a = Image.open(out + cid + ".webp").convert("RGBA").resize((x1 - x0, y1 - y0), Image.LANCZOS)
    cfg = GROUNDED.get(cid)
    layer = np.zeros(mask.shape, np.uint8)
    layer[y0:y1, x0:x1] = (np.asarray(a.getchannel("A")) > 40).astype(np.uint8) * 255
    if cid in DETECT:
        layer |= painted_by_render(layer, DETECT[cid])
    layer = cv2.dilate(layer, ellipse(DETECT[cid]["grow"] if cid in DETECT else DILATE))
    ground = (cfg or {}).get("ground") or (DETECT.get(cid) or {}).get("ground")
    if ground:
        layer[ground:, :] = 0                              # keep the pedestal
    mask |= layer

plate = diffuse_fill(bg, mask > 0)
# feather the inpainted region back in, so the patch has no edge of its own
al = (np.asarray(Image.fromarray(mask).filter(ImageFilter.GaussianBlur(2)))
      .astype(float) / 255)[..., None]
plate = (bg * (1 - al) + plate * al).astype(np.uint8)

# A contact shadow is cast onto the scene, not carried by the object, so it is
# painted here rather than baked into the cutout -- which also keeps it out of
# the way when a case study zooms 2.7x into the cutout itself.
for cid, cfg in GROUNDED.items():
    if not cfg.get("shadow"):
        continue
    x0, _, x1, _ = TREASURES[cid][1]
    inset, rise, blur, strength = cfg["shadow"]
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse([x0 + inset, cfg["ground"] - rise,
                                x1 - inset, cfg["ground"] + rise * .6], fill=170)
    s = (np.asarray(sh.filter(ImageFilter.GaussianBlur(blur)), float) / 255)[..., None]
    plate = (plate * (1 - s * strength)).astype(np.uint8)

    # what the surface catches: a flipped, squashed, blurred copy fading away
    # from the contact line. Onto the plate, because it belongs to the pedestal.
    if cfg.get("mirror") and cid in lit:
        bx0, _, bx1, by1 = TREASURES[cid][1]
        rw, rh = bx1 - bx0, int((by1 - TREASURES[cid][1][1]) * 0.34)
        flip = lit[cid].transpose(Image.FLIP_TOP_BOTTOM).resize((rw, rh), Image.LANCZOS)
        flip = flip.filter(ImageFilter.GaussianBlur(7))
        fa = (np.asarray(flip.getchannel("A"), float) / 255
              * (np.linspace(1, 0, rh)[:, None] ** 1.6) * cfg["mirror"])
        frgb = np.asarray(flip.convert("RGB"), float)
        g0 = cfg["ground"]
        y1r = min(H, g0 + rh)
        sl = plate[g0:y1r, bx0:bx1].astype(float)
        aa = fa[:y1r - g0, :, None]
        plate[g0:y1r, bx0:bx1] = (sl * (1 - aa) + frgb[:y1r - g0] * aa).astype(np.uint8)
Image.fromarray(plate).save(ROOT + "assets/bg/project.jpg", quality=91, optimize=True)
print("wrote assets/proj/ (%d) and assets/bg/project.jpg %dx%d"
      % (len(TREASURES), plate.shape[1], plate.shape[0]))
