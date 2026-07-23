import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = process.env.DATA_DIR || "/data";
const STATE_FILE = join(DATA_DIR, "state.json");
const APP_DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = join(APP_DIR, "index.html");
const DEFAULT_STATE = {
  target: 30000,
  saved: 7500,
  displayMode: "both",
  theme: "light"
};

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

await mkdir(DATA_DIR, { recursive: true });

async function loadState() {
  try {
    const saved = JSON.parse(await readFile(STATE_FILE, "utf8"));
    return validateState(saved);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not read saved state:", error.message);
    await saveState(DEFAULT_STATE);
    return { ...DEFAULT_STATE };
  }
}

async function saveState(state) {
  const temporaryFile = `${STATE_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporaryFile, STATE_FILE);
}

function validateState(value) {
  const target = Number(value?.target);
  const saved = Number(value?.saved);
  if (!Number.isFinite(target) || target <= 0) throw new Error("Target must be greater than zero.");
  if (!Number.isFinite(saved) || saved < 0) throw new Error("Saved amount cannot be negative.");
  return {
    target,
    saved,
    displayMode: value.displayMode === "pounds" ? "pounds" : "both",
    theme: value.theme === "dark" ? "dark" : "light"
  };
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    ...securityHeaders,
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), "application/json; charset=utf-8");
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const indexHtml = await readFile(INDEX_FILE);

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  try {
    if (url.pathname === "/healthz" && request.method === "GET") {
      send(response, 200, "ok\n", "text/plain; charset=utf-8");
      return;
    }

    if (url.pathname === "/api/state" && request.method === "GET") {
      sendJson(response, 200, await loadState());
      return;
    }

    if (url.pathname === "/api/state" && request.method === "PUT") {
      const nextState = validateState(await readJsonBody(request));
      await saveState(nextState);
      sendJson(response, 200, nextState);
      return;
    }

    if ((url.pathname === "/" || url.pathname === "/index.html") && (request.method === "GET" || request.method === "HEAD")) {
      response.writeHead(200, {
        ...securityHeaders,
        "Cache-Control": "no-cache",
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": indexHtml.length
      });
      response.end(request.method === "HEAD" ? undefined : indexHtml);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const clientError = error instanceof SyntaxError || /Target|Saved|body/.test(error.message);
    if (!clientError) console.error("Request failed:", error);
    sendJson(response, clientError ? 400 : 500, {
      error: clientError ? error.message : "Unable to save app data."
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`House Deposit Tracker listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
