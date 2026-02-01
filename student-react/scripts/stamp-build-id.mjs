import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function getBuildId() {
  const envValue = (process.env.APP_BUILD_ID || "").trim();
  if (envValue) return envValue;

  return String(Date.now());
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractBuildIdFromHtml = (html) => {
  const metaRegex =
    /<meta\s+name=["']app-build-id["']\s+content=["']([^"']*)["']/i;
  const match = html.match(metaRegex);
  return match?.[1]?.trim() || "";
};

const updateBuildIdInHtml = (html, buildId) => {
  let next = html;
  const metaRegex =
    /(<meta\s+name=["']app-build-id["']\s+content=["'])([^"']*)(["'])/i;
  if (metaRegex.test(next)) {
    next = next.replace(metaRegex, `$1${buildId}$3`);
  } else {
    next = next.replace(
      /<\/head>/i,
      `  <meta name="app-build-id" content="${buildId}" />\n  </head>`
    );
  }

  const assets = [
    "/assets/student-react/main.js",
    "/assets/student-react/assets/index.css"
  ];

  assets.forEach((assetPath) => {
    const escaped = escapeRegExp(assetPath);
    const withQuery = new RegExp(`(${escaped}\\?v=)[^"']+`, "g");
    if (withQuery.test(next)) {
      next = next.replace(withQuery, `$1${buildId}`);
      return;
    }
    const noQuery = new RegExp(`(${escaped})(?=["'])`, "g");
    next = next.replace(noQuery, `$1?v=${buildId}`);
  });

  return next;
};

async function updateStudentReactHtml(buildId) {
  const filePath = path.resolve(repoRoot, "student_react.html");
  const content = await fs.readFile(filePath, "utf8");
  const next = updateBuildIdInHtml(content, buildId);
  const updated = next !== content;
  if (updated) {
    await fs.writeFile(filePath, next, "utf8");
  }
  return { updated, path: filePath };
}

async function main() {
  let buildId = getBuildId();
  const htmlPath = path.resolve(repoRoot, "student_react.html");

  let existingBuildId = "";
  try {
    const html = await fs.readFile(htmlPath, "utf8");
    existingBuildId = extractBuildIdFromHtml(html);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      throw new Error("student_react.html not found at repo root.");
    }
    throw err;
  }

  if (existingBuildId && existingBuildId === buildId) {
    const fallbackId = `${buildId}-${Date.now()}`;
    console.warn(
      `[build] APP_BUILD_ID matches current HTML (${buildId}); using ${fallbackId} for cache-bust.`
    );
    buildId = fallbackId;
  }

  const results = [await updateStudentReactHtml(buildId)];
  const updatedFiles = results.filter((item) => item.updated);
  const updatedCount = updatedFiles.length;

  console.log(
    `[build] APP_BUILD_ID=${buildId} (${updatedCount} file${
      updatedCount === 1 ? "" : "s"
    } stamped)`
  );
  if (updatedCount) {
    console.log(
      `[build] Stamped files:\n${updatedFiles
        .map((item) => `- ${path.relative(repoRoot, item.path)}`)
        .join("\n")}`
    );
  } else {
    console.warn("[build] No files updated. Check student_react.html markers.");
  }
}

main().catch((err) => {
  console.error("[build] failed to stamp build id", err);
  process.exit(1);
});
