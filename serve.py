#!/usr/bin/env python3
"""
Fallback server if Node.js is not installed.
Run: python serve.py
Then open: http://localhost:3000
"""
import http.server, socketserver, os, webbrowser, threading

PORT = 3000
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "public"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args): pass  # silent

def open_browser():
    import time; time.sleep(0.6)
    webbrowser.open(f"http://localhost:{PORT}")

print(f"\n  ⚡  Electromagnetism Suite  →  http://localhost:{PORT}\n")
threading.Thread(target=open_browser, daemon=True).start()
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
