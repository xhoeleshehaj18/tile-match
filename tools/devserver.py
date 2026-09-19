"""Local test server for the web game with caching disabled (python3 web/tools/devserver.py)."""
import functools, http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
handler = functools.partial(NoCache, directory=root)
http.server.ThreadingHTTPServer(("0.0.0.0", port), handler).serve_forever()
