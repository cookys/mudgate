#!/usr/bin/env python3
"""LAN docs server for assmud markdown.

  python3 tools/docs-viewer/serve.py
  → http://0.0.0.0:8765/  (and LAN IP)
"""
from __future__ import annotations

import json
import mimetypes
import os
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]  # repo root
DOCS = ROOT / "docs"
VIEWER = Path(__file__).resolve().parent
HOST = os.environ.get("DOCS_HOST", "0.0.0.0")
PORT = int(os.environ.get("DOCS_PORT", "8765"))


def list_markdown() -> list[str]:
    out: list[str] = []
    for p in sorted(DOCS.rglob("*.md")):
        rel = p.relative_to(DOCS).as_posix()
        # skip huge review packs noise optional — keep all for now
        out.append(rel)
    return out


def lan_ips() -> list[str]:
    ips: list[str] = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print("[docs]", fmt % args)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path in ("/", "/index.html"):
            return self._send_file(VIEWER / "index.html", "text/html; charset=utf-8")

        if path == "/api/list":
            body = json.dumps(list_markdown(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return

        if path.startswith("/files/"):
            rel = path[len("/files/") :]
            # path traversal guard
            target = (DOCS / rel).resolve()
            if not str(target).startswith(str(DOCS.resolve())):
                self.send_error(403, "forbidden")
                return
            if not target.is_file():
                self.send_error(404, "not found")
                return
            ctype = mimetypes.guess_type(str(target))[0] or "text/plain"
            if target.suffix == ".md":
                ctype = "text/markdown; charset=utf-8"
            return self._send_file(target, ctype)

        self.send_error(404, "not found")

    def _send_file(self, file_path: Path, content_type: str) -> None:
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    if not DOCS.is_dir():
        raise SystemExit(f"docs not found: {DOCS}")
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"assmud docs server")
    print(f"  local:  http://127.0.0.1:{PORT}/")
    for ip in lan_ips():
        print(f"  lan:    http://{ip}:{PORT}/")
    print(f"  root:   {DOCS}")
    print("  tip:    open ★ zMUD 功能 Matrix first")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
