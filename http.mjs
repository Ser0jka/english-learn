/** HTTP policy shared by development and production; keys are never sent here. */
/** @param {import('express').Express} app @param {boolean} isDev */
export function configureHttp(app, isDev = false) {
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    if (!isDev)
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
    if (
      req.path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)
    ) {
      const origin = req.get("Origin");
      if (origin) {
        try {
          const url = new URL(origin);
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.host !== req.get("host")
          )
            throw new Error("Origin mismatch");
        } catch {
          return res
            .status(403)
            .json({ error: "Запрос с другого сайта запрещён." });
        }
      }
      if (req.get("Sec-Fetch-Site") === "cross-site")
        return res
          .status(403)
          .json({ error: "Запрос с другого сайта запрещён." });
    }
    next();
  });
}
/** @type {import('express').ErrorRequestHandler} */
export const handleHttpError = (error, _req, res, _next) => {
  const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
  return res.status(status).json({
    error:
      status === 413
        ? "Запрос слишком большой."
        : status === 400
          ? "Не удалось обработать запрос."
          : "Внутренняя ошибка сервера. Попробуйте позже.",
  });
};
