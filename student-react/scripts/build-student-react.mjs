import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const studentReactDir = path.resolve(repoRoot, "student-react");
const htmlPath = path.resolve(repoRoot, "student_react.html");
const mainJsPath = path.resolve(repoRoot, "assets", "student-react", "main.js");
const indexCssPath = path.resolve(
  repoRoot,
  "assets",
  "student-react",
  "assets",
  "index.css"
);

const pad2 = (value) => String(value).padStart(2, "0");
const buildTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
    now.getDate()
  )}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const updateBuildIdInHtml = (html, buildId) => {
  const metaRegex =
    /(<meta\s+name=["']app-build-id["']\s+content=["'])([^"']*)(["'])/i;
  let next = html;

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

const run = (command, options) => {
  execSync(command, { stdio: "inherit", ...options });
};

const main = () => {
  const buildId = (process.env.APP_BUILD_ID || "").trim() || buildTimestamp();

  run("npm run build", {
    cwd: studentReactDir,
    env: { ...process.env, VITE_APP_BUILD_ID: buildId }
  });

  if (!fs.existsSync(htmlPath)) {
    throw new Error("student_react.html not found.");
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const updated = updateBuildIdInHtml(html, buildId);
  fs.writeFileSync(htmlPath, updated, "utf8");

  if (!fs.existsSync(mainJsPath)) {
    throw new Error("Expected assets/student-react/main.js to exist after build.");
  }
  if (!fs.existsSync(indexCssPath)) {
    throw new Error("Expected assets/student-react/assets/index.css to exist after build.");
  }

  console.log(`[build] Student React built with buildId=${buildId}`);
};

try {
  main();
} catch (err) {
  console.error("[build] Student React build failed:", err?.message || err);
  process.exit(1);
}
