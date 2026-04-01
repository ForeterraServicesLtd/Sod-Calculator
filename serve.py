#!/usr/bin/env python3
"""Simple live-reload dev server. Injects a script that polls for changes."""

import http.server
import os
import threading
import time
import json

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))
WATCH_EXTS = {'.html', '.css', '.js'}

# Track modification times
last_change = time.time()

def get_mtime():
    latest = 0
    for f in os.listdir(DIR):
        if os.path.splitext(f)[1] in WATCH_EXTS:
            mt = os.path.getmtime(os.path.join(DIR, f))
            if mt > latest:
                latest = mt
    return latest

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        if self.path == '/__reload':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(json.dumps({'mtime': get_mtime()}).encode())
            return

        # For HTML files, inject the live-reload snippet
        if self.path in ('/', '/index.html'):
            filepath = os.path.join(DIR, 'index.html')
            with open(filepath, 'r') as f:
                content = f.read()
            snippet = """
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
            content = content.replace('</body>', snippet + '</body>')
            data = content.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', len(data))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(data)
            return

        super().do_GET()

    def log_message(self, format, *args):
        pass  # quiet

print(f'Live-reload server at http://localhost:{PORT}')
print('Watching for changes... (Ctrl+C to stop)')
server = http.server.HTTPServer(('', PORT), Handler)
server.serve_forever()
