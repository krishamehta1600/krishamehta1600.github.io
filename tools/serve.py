#!/usr/bin/env python3
"""The dev server, because http.server is not enough any more.

`python3 -m http.server` does not answer Range requests. That was fine while
the journey only ran forwards: segments are contiguous, so the film never
seeks -- playback just resumes. The rewind is nothing but seeks, and against a
server with no range support every one of them silently fails and the film
snaps to frame one. `video.seekable` reads `[0, 0]` and nothing says why.

GitHub Pages answers ranges, so the site is fine where it lives. This is so it
is fine here too.

    python3 tools/serve.py          # http://localhost:8433
    python3 tools/serve.py 9000
"""
import http.server, os, re, socketserver, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8433


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        # the header that tells the browser it may seek at all
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")   # editing index.html all day
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
        if not m:
            return super().send_head()
        size = os.path.getsize(path)
        first, last = m.group(1), m.group(2)
        if first == "":                      # "the last N bytes"
            start, end = max(0, size - int(last or 0)), size - 1
        else:
            start, end = int(first), (int(last) if last else size - 1)
        end = min(end, size - 1)
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(remaining, 1 << 16))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        return None

    def log_message(self, fmt, *args):       # one line per request is enough
        sys.stderr.write("%s %s\n" % (self.command, self.path))


# threaded, or one stalled video request blocks the page that asked for it
socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    print("serving %s at http://localhost:%d" % (ROOT, PORT))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
