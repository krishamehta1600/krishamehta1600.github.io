#!/usr/bin/env python3
"""Downscale the Say hello button to the size the page actually draws it.

    python3 tools/say-hello.py

    tools/say-hello-source.png  (2087x753, 1.16 MB)
        -> assets/ui/say-hello.png  (640 wide)

Same job the other pieces of UI artwork have had done to them, and the same
reason: the page draws this at about 230px, and shipping fourteen times that
many pixels costs a megabyte on the one page every visitor lands on.

No Pillow, no numpy -- this is the only image work in the repo that has to run
on a bare python3, because it is the one a person is most likely to re-run
after a redraw. PNG is `zlib` plus five scanline filters, and a box downscale
is an average; between them that is the whole file.

The averaging is done on **premultiplied** alpha. Averaging straight RGBA mixes
the colour of fully transparent pixels into their neighbours, and around this
artwork those pixels are black -- which is what puts a dark fringe on every
soft edge, of which this button is nothing but: the glow, the orbit ring, the
scatter of little spheres. Premultiplying first weights each pixel's colour by
how much of it there is, which is what "average" was supposed to mean.
"""
import os, struct, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "say-hello-source.png")
OUT = os.path.join(ROOT, "assets", "ui", "say-hello.png")
WIDTH = 640


def read_png(path):
    """-> (w, h, bytearray of RGBA rows). 8-bit RGB/RGBA, non-interlaced."""
    d = open(path, "rb").read()
    if d[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("not a PNG: " + path)
    pos, idat, w = 8, [], None
    while pos < len(d):
        (n,) = struct.unpack(">I", d[pos:pos + 4])
        kind = d[pos + 4:pos + 8]
        body = d[pos + 8:pos + 8 + n]
        if kind == b"IHDR":
            w, h, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", body)
            if depth != 8 or colour not in (2, 6) or interlace:
                raise SystemExit("want an 8-bit non-interlaced RGB/RGBA PNG")
            channels = 4 if colour == 6 else 3
        elif kind == b"IDAT":
            idat.append(body)
        elif kind == b"IEND":
            break
        pos += 12 + n

    raw = zlib.decompress(b"".join(idat))
    stride = w * channels
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    pos = 0
    for y in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos + stride]); pos += stride
        # the five filters, undone. Each reads bytes it has already restored.
        if f == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        elif f != 0:
            raise SystemExit("unknown filter %d on row %d" % (f, y))
        prev = line
        if channels == 4:
            out[y * w * 4:(y + 1) * w * 4] = line
        else:
            for x in range(w):
                out[(y * w + x) * 4:(y * w + x) * 4 + 3] = line[x * 3:x * 3 + 3]
                out[(y * w + x) * 4 + 3] = 255
    return w, h, out


def box_downscale(w, h, px, nw):
    """Area-average onto an nw-wide grid, on premultiplied alpha."""
    nh = max(1, round(h * nw / w))
    dst = bytearray(nw * nh * 4)
    # source column spans, worked out once and reused for every row
    cols = [(x * w // nw, max(x * w // nw + 1, (x + 1) * w // nw)) for x in range(nw)]
    for y in range(nh):
        y0, y1 = y * h // nh, max(y * h // nh + 1, (y + 1) * h // nh)
        for x in range(nw):
            x0, x1 = cols[x]
            r = g = b = a = 0
            for sy in range(y0, y1):
                base = (sy * w + x0) * 4
                for sx in range(x1 - x0):
                    i = base + sx * 4
                    al = px[i + 3]
                    # premultiply: colour counts for as much as there is of it
                    r += px[i] * al
                    g += px[i + 1] * al
                    b += px[i + 2] * al
                    a += al
            n = (y1 - y0) * (x1 - x0)
            o = (y * nw + x) * 4
            if a:
                dst[o] = min(255, (r + a // 2) // a)
                dst[o + 1] = min(255, (g + a // 2) // a)
                dst[o + 2] = min(255, (b + a // 2) // a)
            dst[o + 3] = (a + n // 2) // n
    return nw, nh, dst


def write_png(path, w, h, px):
    """Filter each row five ways and keep the cheapest, which is what every
       encoder does and is worth about a third of the file here."""
    rows = []
    prev = bytearray(w * 4)
    for y in range(h):
        line = px[y * w * 4:(y + 1) * w * 4]
        best = None
        for f in range(5):
            cur = bytearray(w * 4)
            for i in range(w * 4):
                a = line[i - 4] if i >= 4 else 0
                b = prev[i]
                c = prev[i - 4] if i >= 4 else 0
                if f == 0: cur[i] = line[i]
                elif f == 1: cur[i] = (line[i] - a) & 255
                elif f == 2: cur[i] = (line[i] - b) & 255
                elif f == 3: cur[i] = (line[i] - ((a + b) >> 1)) & 255
                else:
                    p = a + b - c
                    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                    pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                    cur[i] = (line[i] - pr) & 255
            # the usual heuristic: smallest sum of signed deviations wins
            cost = sum(v if v < 128 else 256 - v for v in cur)
            if best is None or cost < best[0]:
                best = (cost, f, cur)
        rows.append(bytes([best[1]]) + bytes(best[2]))
        prev = line

    def chunk(kind, body):
        return (struct.pack(">I", len(body)) + kind + body
                + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff))

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(b"".join(rows), 9)))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    w, h, px = read_png(SRC)
    print("source %dx%d" % (w, h))
    nw, nh, small = box_downscale(w, h, px, int(sys.argv[1]) if len(sys.argv) > 1 else WIDTH)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    write_png(OUT, nw, nh, small)
    print("wrote %s  %dx%d  %.1f kB" % (OUT, nw, nh, os.path.getsize(OUT) / 1024))
