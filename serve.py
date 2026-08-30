#!/usr/bin/env python3
"""Simple live-reload dev server. Injects a script that polls for changes.

Sends no-store on every response so the browser never serves stale CSS/JS
during development, and watches all .html/.css/.js under the project
(including subdirectories) so editing any page triggers a reload.
"""

import http.server
import os
import time
import json

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))
WATCH_EXTS = {'.html', '.css', '.js'}

RELOAD_SNIPPET = """
<script>
(function(){
  let last = 0;
  setInterval(async () => {
    try {
      const r = await fetch('/__reload');
      const d = await r.json();
      if (last && d.mtime > last) location.reload();
      last = d.mtime;
    } catch(e) {}
  }, 500);
})();
</script>
"""

def get_mtime():
    latest = 0
    for root, dirs, files in os.walk(DIR):
        if '.git' in dirs:
            dirs.remove('.git')
        for f in files:
            if os.path.splitext(f)[1] in WATCH_EXTS:
                mt = os.path.getmtime(os.path.join(root, f))
                if mt > latest:
                    latest = mt
    return latest

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        # Never cache during development.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def _serve_html(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        content = content.replace('</body>', RELOAD_SNIPPET + '</body>')
        data = content.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/__reload':
            body = json.dumps({'mtime': get_mtime()}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Resolve directory index -> index.html and inject reload into any HTML page.
        path = self.path.split('?', 1)[0]
        rel = path.lstrip('/')
        candidate = os.path.join(DIR, rel)
        if path.endswith('/'):
            candidate = os.path.join(candidate, 'index.html')
        if candidate.endswith('.html') and os.path.isfile(candidate):
            self._serve_html(candidate)
            return

        super().do_GET()

    def log_message(self, fmt, *args):
        pass  # quiet

print(f'Live-reload server at http://localhost:{PORT}')
print('Watching for changes (incl. subpages)... Ctrl+C to stop')
http.server.HTTPServer(('', PORT), Handler).serve_forever()
