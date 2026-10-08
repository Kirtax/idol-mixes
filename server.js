const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "mixes.json");
const PORT = Number(process.env.PORT) || 8000;
const MAX_BODY_SIZE = 1_000_000;
const ALLOWED_TAGS = new Set(["kahen-sanren", "konton", "koujou", "gengo"]);
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function normalizeVariant(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = ["title", "readingRomaji", "readingKana"];
  if (!fields.every((field) => typeof value[field] === "string" && value[field].trim())) return null;
  if (value.title.length > 160 || value.readingRomaji.length > 3000 || value.readingKana.length > 3000) return null;
  const titleKana = value.titleKana === undefined ? "" : value.titleKana;
  if (typeof titleKana !== "string" || titleKana.length > 160) return null;
  const startRomaji = value.startRomaji === undefined ? "" : value.startRomaji;
  const startKana = value.startKana === undefined ? "" : value.startKana;
  if (typeof startRomaji !== "string" || typeof startKana !== "string"
    || startRomaji.length > 3000 || startKana.length > 3000) return null;
  const startKanaRomaji = value.startKanaRomaji === undefined ? "" : value.startKanaRomaji;
  const readingKanaRomaji = value.readingKanaRomaji === undefined ? "" : value.readingKanaRomaji;
  if (typeof startKanaRomaji !== "string" || typeof readingKanaRomaji !== "string"
    || startKanaRomaji.length > 3000 || readingKanaRomaji.length > 3000) return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : randomUUID(),
    title: value.title.trim(),
    titleKana: titleKana.trim(),
    startRomaji: startRomaji.trim(),
    startKana: startKana.trim(),
    startKanaRomaji: startKanaRomaji.trim(),
    readingRomaji: value.readingRomaji.trim(),
    readingKana: value.readingKana.trim(),
    readingKanaRomaji: readingKanaRomaji.trim(),
  };
}

function normalizeMix(value) {
  const fields = ["nameRomaji", "nameKana"];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!fields.every((field) => typeof value[field] === "string" && value[field].trim())) return null;
  if (typeof value.readingRomaji !== "string" || typeof value.readingKana !== "string") return null;
  if (value.nameRomaji.length > 120 || value.nameKana.length > 120
    || value.readingRomaji.length > 3000 || value.readingKana.length > 3000) return null;
  const startRomaji = value.startRomaji === undefined ? "" : value.startRomaji;
  const startKana = value.startKana === undefined ? "" : value.startKana;
  if (typeof startRomaji !== "string" || typeof startKana !== "string"
    || startRomaji.length > 3000 || startKana.length > 3000) return null;
  const startKanaRomaji = value.startKanaRomaji === undefined ? "" : value.startKanaRomaji;
  const readingKanaRomaji = value.readingKanaRomaji === undefined ? "" : value.readingKanaRomaji;
  if (typeof startKanaRomaji !== "string" || typeof readingKanaRomaji !== "string"
    || startKanaRomaji.length > 3000 || readingKanaRomaji.length > 3000) return null;
  const sortOrder = value.sortOrder === undefined || value.sortOrder === null || value.sortOrder === "" ? null : Number(value.sortOrder);
  if (sortOrder !== null && (!Number.isSafeInteger(sortOrder) || sortOrder < 1)) return null;
  const mainTitle = value.mainTitle === undefined ? "Versión principal" : value.mainTitle;
  const mainTitleKana = value.mainTitleKana === undefined ? "" : value.mainTitleKana;
  if (typeof mainTitle !== "string" || mainTitle.length > 160) return null;
  if (typeof mainTitleKana !== "string" || mainTitleKana.length > 160) return null;
  const rawVariants = value.variants === undefined ? [] : value.variants;
  if (!Array.isArray(rawVariants) || rawVariants.length > 50) return null;
  const variants = rawVariants.map(normalizeVariant);
  if (variants.some((variant) => !variant)) return null;
  const hasRomaji = Boolean(value.readingRomaji.trim());
  const hasKana = Boolean(value.readingKana.trim());
  if (hasRomaji !== hasKana || (!hasRomaji && variants.length === 0)) return null;

  const barCounts = value.barCounts === undefined ? [] : value.barCounts;
  const tags = value.tags === undefined ? [] : value.tags;
  if (!Array.isArray(barCounts) || !barCounts.every((count) => Number.isInteger(count) && count >= 1 && count <= 999)) return null;
  if (!Array.isArray(tags) || !tags.every((tag) => ALLOWED_TAGS.has(tag))) return null;

  const now = new Date().toISOString();
  return {
    id: typeof value.id === "string" && value.id ? value.id : randomUUID(),
    ...(sortOrder === null ? {} : { sortOrder }),
    nameRomaji: value.nameRomaji.trim(),
    nameKana: value.nameKana.trim(),
    startRomaji: startRomaji.trim(),
    startKana: startKana.trim(),
    startKanaRomaji: startKanaRomaji.trim(),
    mainTitle: mainTitle.trim() || "Versión principal",
    mainTitleKana: mainTitleKana.trim(),
    readingRomaji: value.readingRomaji.trim(),
    readingKana: value.readingKana.trim(),
    readingKanaRomaji: readingKanaRomaji.trim(),
    variants,
    barCounts: [...new Set(barCounts)].sort((a, b) => a - b),
    tags: [...new Set(tags)],
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

async function readMixes() {
  const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("data/mixes.json debe contener una lista JSON.");
  return parsed;
}

async function writeMixes(mixes) {
  const temporaryFile = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(mixes, null, 2)}\n`, "utf8");
  await fs.rename(temporaryFile, DATA_FILE);
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) tooLarge = true;
      else chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("El archivo enviado supera el tamaño permitido."), { status: 413 }));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("El cuerpo de la petición no es un JSON válido."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

async function handleApi(request, response, pathname) {
  if (pathname !== "/api/mixes") {
    sendJson(response, 404, { error: "Ruta API no encontrada." });
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, await readMixes());
    return;
  }

  if (request.method === "PUT") {
    const value = await readRequestJson(request);
    if (!Array.isArray(value) || value.length > 10_000) {
      sendJson(response, 400, { error: "Se esperaba una lista de mixes." });
      return;
    }
    const mixes = value.map(normalizeMix);
    if (mixes.some((mix) => !mix)) {
      sendJson(response, 400, { error: "Una entrada tiene datos incompletos o no válidos." });
      return;
    }
    await writeMixes(mixes);
    sendJson(response, 200, { saved: mixes.length });
    return;
  }

  response.setHeader("allow", "GET, PUT");
  sendJson(response, 405, { error: "Método no permitido." });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(request, response, url.pathname);
    return;
  }

  const file = STATIC_FILES.get(url.pathname);
  if (!file || request.method !== "GET") {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("No encontrado.");
    return;
  }

  const content = await fs.readFile(path.join(ROOT, file[0]));
  response.writeHead(200, {
    "content-type": file[1],
    "cache-control": "no-cache",
    "x-content-type-options": "nosniff",
  });
  response.end(content);
}

async function start() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeMixes([]);
  }

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error);
      if (!response.headersSent) sendJson(response, error.status || 500, { error: error.message || "Error interno." });
      else response.destroy();
    });
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`El puerto ${PORT} ya está ocupado. Detén el otro servidor local e inténtalo de nuevo.`);
    } else {
      console.error("No se pudo iniciar el servidor:", error);
    }
    process.exitCode = 1;
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Idol Mixes está disponible en http://localhost:${PORT}`);
    console.log(`Los mixes se guardan en ${DATA_FILE}`);
  });
}

start().catch((error) => {
  console.error("No se pudo iniciar Idol Mixes:", error);
  process.exitCode = 1;
});
