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
  try {
    const content = await fs.readFile(filePath, "utf8");
    const next = updateBuildIdInHtml(content, buildId);
    if (next === content) return false;
    await fs.writeFile(filePath, next, "utf8");
    return { updated: true, path: filePath };
  } catch (err) {
    if (err && err.code === "ENOENT") return { updated: false, path: filePath };
    throw err;
  }
}

async function main() {
  const buildId = getBuildId();
  const results = [await updateStudentReactHtml(buildId)];
  const updatedCount = results.filter((item) => item.updated).length;

  console.log(
    `[build] APP_BUILD_ID=${buildId} (${updatedCount} file${
      updatedCount === 1 ? "" : "s"
    } stamped)`
  );
  if (!updatedCount) {
    console.warn("[build] No files updated. Check student_react.html markers.");
  }
}

main().catch((err) => {
  console.error("[build] failed to stamp build id", err);
  process.exit(1);
});
