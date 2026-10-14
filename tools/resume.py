#!/usr/bin/env python3
"""Flatten a resume export into the two files the site serves.

    python3 tools/resume.py ~/Desktop/KrishaMehtaResume.pdf

    -> assets/resume.pdf           the viewer's document and the download
    -> assets/resume-fallback.jpg  what iOS Safari gets instead, since it will
                                   not render a PDF inside an <object>

A design tool's PDF export keeps every layer as its own image. The last one
came out of one at 47.5 MB for a single page -- ten 1024x1536 images stacked
with their masks -- and that is the file a visitor would have been handed for
clicking "Resume". The one it replaced was 0.47 MB: the same page, flattened to
a single JPEG. So this does the flattening rather than trusting the export to.

Which loses nothing that was there. The resume is a full-bleed composition
whose text is set over artwork; it has never had a live text layer on this site
(the file it replaces has no fonts in it at all), so there is no selectable
text, no ATS parsing and no accessibility affordance being given up here --
only ninety-nine per cent of the bytes.

`sips` does the rasterising because it is the only thing on a stock macOS that
can, and it renders a PDF at its MediaBox size, which for this page is exactly
the 1024x1536 the site already serves. The wrapper below is then the smallest
legal PDF that can hold a JPEG: the image goes in whole, as DCTDecode, with no
re-encoding, so the PDF and the fallback are the same pixels at the same
quality rather than two separate compressions of one picture.
"""
import os, re, struct, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PDF = os.path.join(ROOT, "assets", "resume.pdf")
OUT_JPG = os.path.join(ROOT, "assets", "resume-fallback.jpg")
QUALITY = 82                      # see the note at the foot of this file
TITLE = "Krisha Mehta - Resume"


def page_box(path):
    """The source's MediaBox, so the rebuilt page is the same size as the one
       it replaces rather than whatever the raster happens to measure."""
    with open(path, "rb") as f:
        m = re.search(rb"/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)", f.read())
    if not m:
        raise SystemExit("no MediaBox in " + path)
    x0, y0, x1, y1 = (float(v) for v in m.groups())
    return round(x1 - x0, 3), round(y1 - y0, 3)


def rasterise(src, dst, quality):
    subprocess.run(["sips", "-s", "format", "jpeg",
                    "-s", "formatOptions", str(quality),
                    "--out", dst, src],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def jpeg_size(data):
    """Width, height and component count, off the frame header. Everything
       between the markers is skipped rather than parsed -- only SOFn carries
       what the PDF image dictionary has to declare."""
    i = 2
    while i < len(data) - 1:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        (seg,) = struct.unpack(">H", data[i + 2:i + 4])
        # SOF0..SOF15, minus the four that are not frame headers
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h, data[i + 9]
        i += 2 + seg
    raise SystemExit("no JPEG frame header")


def build_pdf(jpeg, box, title):
    w, h, comps = jpeg_size(jpeg)
    space = {1: "/DeviceGray", 3: "/DeviceRGB", 4: "/DeviceCMYK"}[comps]
    pw, ph = box
    content = b"q %g 0 0 %g 0 0 cm /Im0 Do Q\n" % (pw, ph)
    # PDF text strings are Latin-1 here, which the title is; anything outside it
    # would need UTF-16BE with a BOM, and a resume's title does not.
    esc = title.encode("latin-1").translate(None, b"").replace(b"\\", b"\\\\") \
               .replace(b"(", b"\\(").replace(b")", b"\\)")

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %g %g] "
        b"/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>" % (pw, ph),
        b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace %s "
        b"/BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n"
        % (w, h, space.encode(), len(jpeg)) + jpeg + b"\nendstream",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"endstream",
        b"<< /Title (%s) /Author (%s) /Producer (tools/resume.py) >>"
        % (esc, esc.split(b" - ")[0]),
    ]

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for n, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + body + b"\nendobj\n"

    xref = len(out)
    out += b"xref\n0 %d\n" % (len(objs) + 1)
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += (b"trailer\n<< /Size %d /Root 1 0 R /Info %d 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (len(objs) + 1, len(objs), xref))
    return bytes(out), (w, h)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__.strip().splitlines()[2].strip())
    src = os.path.expanduser(sys.argv[1])
    quality = int(sys.argv[2]) if len(sys.argv) > 2 else QUALITY

    box = page_box(src)
    rasterise(src, OUT_JPG, quality)
    with open(OUT_JPG, "rb") as f:
        jpeg = f.read()
    pdf, (w, h) = build_pdf(jpeg, box, TITLE)
    with open(OUT_PDF, "wb") as f:
        f.write(pdf)

    print("source      %8.2f MB  page %g x %g" % (os.path.getsize(src) / 1e6, *box))
    print("resume.pdf  %8.2f MB  image %dx%d at q%d" % (len(pdf) / 1e6, w, h, quality))
    print("fallback    %8.2f MB" % (len(jpeg) / 1e6))
    print("saved       %8.1f%%" % (100 - len(pdf) / os.path.getsize(src) * 100))

# Quality: 82 lands this page at about the size of the file it replaces, which
# was the bar it was already meeting on screen. Pass a second argument to try
# another -- `python3 tools/resume.py <pdf> 90` -- and look at the lettering in
# the right-hand column before deciding, since that is the first thing to go.
