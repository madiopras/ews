import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const buildDir = path.resolve("build");
const manifestPath = path.join(buildDir, "asset-manifest.json");
if (!fs.existsSync(manifestPath)) {
  throw new Error("Production build not found. Run npm run build first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const jsEntrypoints = manifest.entrypoints.filter((name) => name.endsWith(".js"));
const sizes = jsEntrypoints.map((name) => {
  const bytes = fs.readFileSync(path.join(buildDir, name));
  return { name, gzip: zlib.gzipSync(bytes).length };
});
const main = sizes.find((item) => /\/main\.[^.]+\.js$/.test(item.name));
const initial = sizes.reduce((total, item) => total + item.gzip, 0);
const maxMain = Number(process.env.BUDGET_MAIN_GZIP_KB || 220) * 1024;
const maxInitial = Number(process.env.BUDGET_INITIAL_GZIP_KB || 300) * 1024;

const mediaDir = path.join(buildDir, "static", "media");
const oversizedMedia = fs.existsSync(mediaDir)
  ? fs.readdirSync(mediaDir).filter((name) => fs.statSync(path.join(mediaDir, name)).size > 700 * 1024)
  : [];

console.log(`Initial JavaScript: ${(initial / 1024).toFixed(1)} KiB gzip`);
console.log(`Main JavaScript: ${((main?.gzip || 0) / 1024).toFixed(1)} KiB gzip`);
if (!main || main.gzip > maxMain || initial > maxInitial || oversizedMedia.length) {
  if (!main) console.error("Main JavaScript bundle was not found.");
  if (main?.gzip > maxMain) console.error(`Main bundle exceeds ${maxMain / 1024} KiB gzip.`);
  if (initial > maxInitial) console.error(`Initial JavaScript exceeds ${maxInitial / 1024} KiB gzip.`);
  if (oversizedMedia.length) console.error(`Oversized local media: ${oversizedMedia.join(", ")}`);
  process.exit(1);
}
console.log("Performance and local-media budgets passed.");
