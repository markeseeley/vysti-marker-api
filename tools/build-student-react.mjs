import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const studentReactHtmlPath = path.join(repoRoot, "student_react.html");

const buildId = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .slice(0, 13)
  .replace("T", "-");

const replaceOnce = (text, label, pattern, replacement) => {
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one ${label} match, found ${matches.length}.`
    );
  }
  return text.replace(pattern, replacement);
};

execSync("npm --prefix student-react run build", { stdio: "inherit" });

const html = await readFile(studentReactHtmlPath, "utf8");
let updated = html;

updated = replaceOnce(
  updated,
  "app-build-id meta tag",
  /(<meta\s+name="app-build-id"\s+content=")([^"]*)(")/g,
  `$1${buildId}$3`
);
updated = replaceOnce(
  updated,
  "student-react CSS cache-buster",
  /(\x2fassets\x2fstudent-react\x2fassets\x2findex\.css\?v=)([^"]*)/g,
  `$1${buildId}`
);
updated = replaceOnce(
  updated,
  "student-react main.js cache-buster",
  /(\x2fassets\x2fstudent-react\x2fmain\.js\?v=)([^"]*)/g,
  `$1${buildId}`
);

if (updated !== html) {
  await writeFile(studentReactHtmlPath, updated, "utf8");
}

console.log(`buildId: ${buildId}`);
console.log(
  "paths checked: /assets/student-react/main.js, /assets/student-react/assets/index.css"
);
