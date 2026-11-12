import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

export function createStaticServer({ root, base = "" }) {
  const rootPath = path.resolve(root);
  const normalizedBase = base
    ? `/${String(base).replace(/^\/+|\/+$/g, "")}`
    : "";

  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      sendText(response, 400, "bad request");
      return;
    }
    if (normalizedBase) {
      if (pathname !== normalizedBase && !pathname.startsWith(`${normalizedBase}/`)) {
        sendText(response, 404, "not found");
        return;
      }
      pathname = pathname.slice(normalizedBase.length) || "/";
    }
    let relative = pathname.replace(/^\/+/, "");
    if (relative === "" || relative.endsWith("/")) relative += "index.html";
    const filePath = path.resolve(rootPath, relative);
    if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
      sendText(response, 403, "forbidden");
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      response.writeHead(302, { location: `${url.pathname.replace(/\/$/, "")}/` });
      response.end();
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        fs.readFile(path.join(rootPath, "404.html"), (notFoundError, page) => {
          response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
          response.end(notFoundError ? "not found" : page);
        });
        return;
      }
      const type = TYPES[path.extname(filePath)] || "application/octet-stream";
      response.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
      response.end(data);
    });
  });

  return {
    server,
    listen(port = 0) {
      return new Promise((resolve) => {
        server.listen(port, "127.0.0.1", () => {
          const address = server.address();
          resolve(`http://127.0.0.1:${address.port}${normalizedBase}/`);
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function sendText(response, status, body) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}
