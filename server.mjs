import compression from "compression";
import express from "express";
import { configureHttp, handleHttpError } from "./http.mjs";
import { createServer } from "node:http";
import { aiAvailable, imageAvailable, registerAi } from "./ai.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes("--dev");
configureHttp(app, isDev);
app.use(compression());
app.use(express.json({ limit: "24kb" }));
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    aiAvailable: aiAvailable(),
    imageAvailable: imageAvailable(),
  }),
);
registerAi(app);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Неизвестный запрос" }),
);
const server = createServer(app);
/** @type {import('vite').ViteDevServer | undefined} */
let vite;
if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  if (!existsSync(path.join(root, "dist", "index.html")))
    throw new Error(
      "Production build missing. Run npm run build before npm start.",
    );
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
}
app.use(handleHttpError);
const port = Number(process.env.PORT || 5173);
const host = process.env.LEXI_HOST || "0.0.0.0";
server.listen(port, host, () =>
  console.log(
    `Lexi listening on port ${port} (${isDev ? "development" : "production"})`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, async () => {
    await vite?.close();
    server.close(() => process.exit(0));
  });
