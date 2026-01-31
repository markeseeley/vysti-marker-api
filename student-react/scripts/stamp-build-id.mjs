import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const PLACEHOLDER = "APP_BUILD_ID_PLACEHOLDER";

function getBuildId() {
  const envValue = (process.env.APP_BUILD_ID || "").trim();
  if (envValue) return envValue;

  try {
    const gitSha = execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
    if (gitSha) return gitSha;
  } catch (_) {
    // Ignore git failures and fall back to timestamp.
  }

  return String(Date.now());
}

async function replaceInFile(filePath, buildId) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    if (!content.includes(PLACEHOLDER)) return false;
    const next = content.split(PLACEHOLDER).join(buildId);
    if (next === content) return false;
    await fs.writeFile(filePath, next, "utf8");
    return true;
  } catch (err) {
    if (err && err.code === "ENOENT") return false;
    throw err;
  }
}

async function main() {
  const buildId = getBuildId();
  const targets = [
    path.resolve(repoRoot, "student_react.html"),
    path.resolve(repoRoot, "assets", "student-react", "main.js"),
    path.resolve(
      repoRoot,
      "assets",
      "student-react",
      "assets",
      "index.css"
    )
  ];

  let updatedCount = 0;
  for (const target of targets) {
    const updated = await replaceInFile(target, buildId);
    if (updated) updatedCount += 1;
  }

  console.log(
    `[build] APP_BUILD_ID=${buildId} (${updatedCount} file${
      updatedCount === 1 ? "" : "s"
    } stamped)`
  );
}

main().catch((err) => {
  console.error("[build] failed to stamp build id", err);
  process.exit(1);
});
