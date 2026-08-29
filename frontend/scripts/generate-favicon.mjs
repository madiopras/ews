import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptsDirectory, "..");
const inputPath = path.join(frontendDirectory, "public", "favicon.png");
const outputPath = path.join(frontendDirectory, "public", "favicon.ico");
const png = fs.readFileSync(inputPath);

// ICO supports a PNG payload. This wraps the existing brand image without
// recompressing it, keeping the favicon deterministic and lossless.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

const directory = Buffer.alloc(16);
directory.writeUInt8(128, 0);
directory.writeUInt8(128, 1);
directory.writeUInt8(0, 2);
directory.writeUInt8(0, 3);
directory.writeUInt16LE(1, 4);
directory.writeUInt16LE(32, 6);
directory.writeUInt32LE(png.length, 8);
directory.writeUInt32LE(header.length + directory.length, 12);

fs.writeFileSync(outputPath, Buffer.concat([header, directory, png]));
console.log(`Generated ${path.relative(frontendDirectory, outputPath)}`);
