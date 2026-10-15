import express from "express";
import { aiAvailable, registerAi } from "./ai.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes("--dev");
app.disable("x-powered-by");
app.use(express.json({ limit: "24kb" }));
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, aiAvailable: aiAvailable() }),
);
registerAi(app);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Неизвестный запрос" }),
);
if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
}
app.use((error, _req, res, _next) => {
  res
    .status(error.status === 413 ? 413 : 400)
    .json({ error: "Не удалось обработать запрос." });
});
const port = Number(process.env.PORT || 5173);
const server = app.listen(port, "0.0.0.0", () =>
  console.log(
    `Lexi listening on port ${port} (${isDev ? "development" : "production"})`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
