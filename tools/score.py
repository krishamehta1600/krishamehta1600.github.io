#!/usr/bin/env python3
"""Cut the three soundtrack assets out of the source track.

     python3 tools/score.py "…/Beneath the Abyss Deep Ocean Instrumental Music 2026.mp3"

   Writes assets/audio/{landing,walk,reveal}.m4a and prints the timing table
   that assets/score.js is built around. macOS only: it leans on afconvert for
   both the MP3 decode and the AAC encode, so there is nothing to install.

   ---- why these three cuts

   The source is 3'08" of one continuous piece. Three moments in it were
   chosen by ear, and this script finds the exact edit points around them
   rather than cutting on the round numbers:

   LANDING  the swell at 0:19.1 and the low hit it lands on. The hit is not a
            single transient -- it is a 0.75s riser that arrives, and the low
            band jumps from 2186 to 3899 RMS at 19.8395s, which is the frame
            the astronaut's feet touch. The clip starts 0.9593s before that,
            because that is where the video's contact frame (frame 23 of a
            23.976fps film) sits, so the clip can simply start with the film.

   WALK     the texture at 0:31-0:33. Looping two seconds of it would be
            audible within one pass, so the loop is a whole phrase instead.
            The track's phrase is ~10.43s -- found by correlating three-band
            energy envelopes of the region against themselves -- and the best
            splice in this part of the piece is 32.25s -> 42.69s, which starts
            on the swell the ear was picking out and matches to 2% in level.
            The 1.8s before it (the break at 30.45 and the swell out of it) is
            kept as a one-shot lead-in, so the bed arrives rather than starts.

   REVEAL   the lift at 2:30-2:34. The rise begins at 152.55s and tops out at
            153.00s, and that peak is what the tunnel opening is aimed at. The
            clip runs from 151.85 -- 1.15s of approach, which is the anticipation
            the cue needs -- and then settles into its own phrase loop,
            155.55s -> 165.96s, so a visitor who stops at the last hold hears
            the cloud world go on rather than the music run out.

   ---- how the loops are made seamless

   Each looping asset carries a 0.70s equal-power crossfade baked into the end
   of its loop: the last 0.70s before the loop end is a sin/cos blend of the
   material approaching the loop end with the material approaching the loop
   start. That makes the sample before the wrap the sample before the loop
   start, so the join is continuous in the waveform and not just in the
   phrasing -- and because the two passages are uncorrelated at this length,
   equal power (not linear) is what keeps the level flat across the blend.

   A tenth of a second of true silence is prepended to every asset. AAC
   encoders add priming samples that some decoders hand back and some do not,
   which would shift every offset in this file by ~48ms; score.js finds the
   first audible sample instead and measures everything from there.
"""
import math, os, subprocess, sys, tempfile, wave, array, json

SR = 44100
LEAD = 0.100          # deliberate silence at the head of every asset
HEADFADE = 0.004      # tiny ramp so the first content sample is not a step
TAIL = 0.050
HEADROOM = 0.84       # every asset is played well below unity anyway, and this
                      # keeps the equal-power crossfade sums off the ceiling
XF = 0.70             # the baked loop crossfade

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio")

#            start     loop in   loop out   anchor
LANDING = (18.88071,   None,     23.00,     19.8400)   # anchor: the impact
WALK    = (30.45,      32.25,    42.69,     None)
REVEAL  = (151.85,     155.55,   165.96,    153.00)    # anchor: the bloom


def decode(mp3):
    tmp = tempfile.mktemp(suffix=".wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@44100", "-c", "2", mp3, tmp], check=True)
    w = wave.open(tmp, "rb")
    a = array.array("h"); a.frombytes(w.readframes(w.getnframes())); w.close()
    os.unlink(tmp)
    return a[0::2], a[1::2]


def clamp16(v):
    v = int(round(v))
    return -32768 if v < -32768 else (32767 if v > 32767 else v)


def build(L, R, t0, t1, loop_start=None, loop_end=None, tailfade=0.0):
    a, b = int(round(t0 * SR)), int(round(t1 * SR))
    l = [v * HEADROOM for v in L[a:b]]
    r = [v * HEADROOM for v in R[a:b]]
    n = len(l)
    if loop_start is not None:
        k = int(round(XF * SR))
        e = int(round((loop_end - t0) * SR))    # buffer index of the loop end
        s = int(round((loop_start - t0) * SR))  # buffer index of the loop start
        assert s - k >= 0 and e <= n, "not enough material either side of the splice"
        for i in range(k):
            u = i / (k - 1)
            fin, fout = math.sin(u * math.pi / 2), math.cos(u * math.pi / 2)
            out, inn = e - k + i, s - k + i
            l[out] = l[out] * fout + l[inn] * fin
            r[out] = r[out] * fout + r[inn] * fin
    if tailfade > 0:
        k = int(round(tailfade * SR))
        for i in range(k):
            g = math.cos(i / (k - 1) * math.pi / 2)
            l[n - k + i] *= g; r[n - k + i] *= g
    k = int(round(HEADFADE * SR))
    for i in range(k):
        g = math.sin(i / (k - 1) * math.pi / 2)
        l[i] *= g; r[i] *= g
    peak = max(max(abs(v) for v in l), max(abs(v) for v in r))
    pad, tail = [0] * int(round(LEAD * SR)), [0] * int(round(TAIL * SR))
    return (pad + [clamp16(v) for v in l] + tail,
            pad + [clamp16(v) for v in r] + tail,
            20 * math.log10(peak / 32768.0))


def write_m4a(name, l, r):
    tmp = tempfile.mktemp(suffix=".wav")
    inter = array.array("h", bytes(4 * len(l)))
    inter[0::2] = array.array("h", l); inter[1::2] = array.array("h", r)
    w = wave.open(tmp, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(inter.tobytes()); w.close()
    dst = os.path.join(OUT, name + ".m4a")
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", "-s", "3", tmp, dst], check=True)
    os.unlink(tmp)
    return os.path.getsize(dst)


def main(mp3):
    os.makedirs(OUT, exist_ok=True)
    L, R = decode(mp3)
    meta = {"lead": LEAD}
    for name, (t0, ls, le, anchor) in (("landing", LANDING), ("walk", WALK), ("reveal", REVEAL)):
        l, r, peak = build(L, R, t0, le, ls, le if ls is not None else None,
                           tailfade=0.35 if ls is None else 0.0)
        size = write_m4a(name, l, r)
        m = {"dur": round(le - t0, 4)}
        if ls is not None:
            m["loopStart"] = round(ls - t0, 4)
            m["loopEnd"] = round(le - t0, 4)
        if anchor is not None:
            m["anchor"] = round(anchor - t0, 5)
        meta[name] = m
        print("%-8s %6.2fs  peak %5.1f dBFS  %6.1f kB" % (name, le - t0, peak, size / 1024))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
