#!/usr/bin/env python3
"""
Custom development HTTP server with static file serving and
API endpoint to permanently bake 3D model transforms to disk.
"""

import os
import sys
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class AgrigateRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/save-transforms':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                transforms = json.loads(body)

                # Format JS module export
                js_content = (
                    "// ============================================================\n"
                    "//  AGRIGATE.ASIA — Canonical Default 3D Model Transforms\n"
                    "//  These transforms are baked into the codebase and loaded\n"
                    "//  automatically by all browsers, incognito windows, and mobile devices.\n"
                    "// ============================================================\n\n"
                    f"export const DEFAULT_TRANSFORMS = {json.dumps(transforms, indent=2)};\n"
                )

                target_file = os.path.join(BASE_DIR, 'modelTransforms.js')
                with open(target_file, 'w', encoding='utf-8') as f:
                    f.write(js_content)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {
                    "status": "ok",
                    "message": f"Successfully baked {len(transforms)} model transforms into modelTransforms.js",
                    "count": len(transforms)
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                print(f"[API] ✓ Baked {len(transforms)} transforms into modelTransforms.js")
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                err_resp = {"status": "error", "message": str(e)}
                self.wfile.write(json.dumps(err_resp).encode('utf-8'))
                print(f"[API] ⚠️ Error saving transforms: {e}")
        else:
            self.send_response(404)
            self.end_headers()

def run(port=8080):
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, AgrigateRequestHandler)
    print(f"Agrigate dev server running on http://localhost:{port}/ (serving {BASE_DIR})")
    httpd.serve_forever()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run(port)
