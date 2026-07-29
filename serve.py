#!/usr/bin/env python3
# 开发用极简静态服务器: 每个响应都带 no-store, 浏览器永不缓存, 改完代码正常刷新即可。
# 用法:  python3 serve.py        (默认 8123)
#        python3 serve.py 9000   (自定义端口)
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    # 确保 .js/.mjs 用正确的 MIME(ES 模块要求), 避免个别系统把 js 判成 text/plain
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".mjs": "application/javascript",
    }


if __name__ == "__main__":
    print(f"▶ 开发服务器(禁缓存)已启动:  http://localhost:{PORT}")
    print("  改完代码正常刷新即可, 不用再硬刷。Ctrl+C 停止。")
    HTTPServer(("0.0.0.0", PORT), NoCacheHandler).serve_forever()
