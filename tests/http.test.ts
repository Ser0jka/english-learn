import express from "express";
import { beforeEach, afterEach, it, expect } from "vitest";
import type { Server } from "node:http";
import { configureHttp, handleHttpError } from "../http.mjs";
let server: Server, base: string;
beforeEach(async () => {
  const app = express();
  configureHttp(app);
  app.use(express.json({ limit: "24kb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/test", (_req, res) => res.json({ ok: true }));
  app.get("/api/failure", () => {
    throw new Error("private diagnostic");
  });
  app.use(handleHttpError);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("No test port");
  base = `http://127.0.0.1:${addr.port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
it("serves security headers and prevents caching API responses", async () => {
  const res = await fetch(base + "/api/health");
  expect(res.status).toBe(200);
  expect(res.headers.get("x-powered-by")).toBeNull();
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("x-frame-options")).toBe("DENY");
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("content-security-policy")).toContain(
    "object-src 'none'",
  );
});
it("accepts same-origin requests but rejects foreign origins and cross-site requests", async () => {
  const send = (headers: Record<string, string>) =>
    fetch(base + "/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: "{}",
    });
  expect((await send({ Origin: base })).status).toBe(200);
  expect((await send({ Origin: "https://attacker.test" })).status).toBe(403);
  expect((await send({ Origin: "null" })).status).toBe(403);
  expect((await send({ "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
});
it("returns correct status codes without leaking private diagnostics", async () => {
  const invalid = await fetch(base + "/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad",
  });
  expect(invalid.status).toBe(400);
  const large = await fetch(base + "/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "x".repeat(25000) }),
  });
  expect(large.status).toBe(413);
  const failure = await fetch(base + "/api/failure");
  expect(failure.status).toBe(500);
  expect(await failure.text()).not.toContain("private diagnostic");
});
