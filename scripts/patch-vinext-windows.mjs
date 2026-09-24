// Vinext shims need three corrections on this project's target environments.
// Ported from the sibling Elfred-Product tree, which hit the same issues.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const viewportFile = path.resolve("node_modules/vinext/dist/shims/document.js");
const viewportSource = await readFile(viewportFile, "utf8");
const defaultViewport = "width=device-width, initial-scale=1";
const iosViewport =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content";
if (!viewportSource.includes(iosViewport)) {
  if (!viewportSource.includes(defaultViewport)) {
    throw new Error("Unsupported vinext document shim; review the viewport patch.");
  }
  await writeFile(
    viewportFile,
    viewportSource.replace(defaultViewport, iosViewport),
    "utf8",
  );
  console.log("Applied vinext iOS viewport-cover patch.");
}

const metadataFile = path.resolve("node_modules/vinext/dist/shims/metadata.js");
const metadataSource = await readFile(metadataFile, "utf8");
const viewportAnchor =
  'if (viewport.userScalable !== void 0) parts.push(`user-scalable=${viewport.userScalable ? "yes" : "no"}`);';
const viewportExtensions = [
  viewportAnchor,
  'if (viewport.viewportFit !== void 0) parts.push(`viewport-fit=${viewport.viewportFit}`);',
  'if (viewport.interactiveWidget !== void 0) parts.push(`interactive-widget=${viewport.interactiveWidget}`);',
].join("\n\t");
if (!metadataSource.includes("viewport-fit=${viewport.viewportFit}")) {
  if (!metadataSource.includes(viewportAnchor)) {
    throw new Error("Unsupported vinext metadata shim; review the viewport field patch.");
  }
  await writeFile(
    metadataFile,
    metadataSource.replace(viewportAnchor, viewportExtensions),
    "utf8",
  );
  console.log("Applied vinext viewport-fit metadata patch.");
}

if (process.platform === "win32") {
  const file = path.resolve("node_modules/vinext/dist/server/static-file-cache.js");
  const source = await readFile(file, "utf8");
  const original = "relativePath: path.relative(base, batch[j]),";
  const replacement = 'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),';
  if (!source.includes(replacement)) {
    if (!source.includes(original)) {
      throw new Error("Unsupported vinext static-file-cache implementation; review the Windows asset patch.");
    }
    await writeFile(file, source.replace(original, replacement), "utf8");
    console.log("Applied vinext Windows static asset path normalization patch.");
  }
}
