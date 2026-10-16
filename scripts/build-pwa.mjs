import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../dist");
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const parts = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : Promise.resolve([path.join(directory, entry.name)]),
    ),
  );
  return parts.flat();
}
const paths = (await walk(root)).filter(
  (file) =>
    !file.includes(path.sep + "data" + path.sep) &&
    !file.endsWith("service-worker.js"),
);
const files = paths
  .map((file) => "/" + path.relative(root, file).split(path.sep).join("/"))
  .sort();
const hash = createHash("sha256");
for (const file of paths.sort()) hash.update(await readFile(file));
const version = hash.digest("hex").slice(0, 16);
const dataHashes = await Promise.all(
  ["word-bank", "phrase-bank"].map(
    async (name) =>
      JSON.parse(
        await readFile(
          path.resolve(
            import.meta.dirname,
            `../src/generated/${name}-manifest.json`,
          ),
          "utf8",
        ),
      ).sha256,
  ),
);
const dataVersion = createHash("sha256")
  .update(dataHashes.join(":"))
  .update(await readFile(path.join(root, "data/books/manifest.json")))
  .digest("hex")
  .slice(0, 16);
const source = await readFile(
  path.resolve(import.meta.dirname, "service-worker.template.js"),
  "utf8",
);
await writeFile(
  path.join(root, "service-worker.js"),
  source
    .replace("__VERSION__", version)
    .replace("__DATA_VERSION__", dataVersion)
    .replace('["__PRECACHE__"]', JSON.stringify(files)),
);
console.log(
  `PWA shell: ${files.length} local assets; vocabulary caches when opened.`,
);
