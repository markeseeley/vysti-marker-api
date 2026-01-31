const baseUrl = (process.env.BASE_URL || "").replace(/\/+$/, "");
const urlFor = (path) => `${baseUrl}${path}`;

const failures = [];

const recordFailure = (message) => {
  failures.push(message);
  console.error(`FAIL: ${message}`);
};

const assertFetchOk = async (path) => {
  try {
    const response = await fetch(urlFor(path), { cache: "no-store" });
    if (!response.ok) {
      recordFailure(`${path} returned ${response.status}`);
      return null;
    }
    return response;
  } catch (err) {
    recordFailure(`${path} fetch failed: ${err.message}`);
    return null;
  }
};

const assertTextFetch = async (path) => {
  const response = await assertFetchOk(path);
  if (!response) return null;
  return response.text();
};

const requiredAssets = [
  "/student-react-config.json",
  "/assets/student-react/main.js",
  "/assets/student-react/assets/index.css",
  "/shared/runtimeConfig.js",
  "/shared/auth.js",
  "/shared/markingApi.js",
  "/shared/download.js"
];

for (const path of requiredAssets) {
  await assertFetchOk(path);
}

const studentReactHtml = await assertTextFetch("/student_react.html");
if (studentReactHtml) {
  const metaMatch = studentReactHtml.match(
    /<meta\s+name="app-build-id"\s+content="([^"]+)"/i
  );
  const buildId = metaMatch?.[1]?.trim();
  if (!buildId) {
    recordFailure("student_react.html build id is missing");
  }
  if (!studentReactHtml.includes("/assets/student-react/main.js?v=")) {
    recordFailure("student_react.html main.js cache-buster missing");
  }
}

const studentHtml = await assertTextFetch("/student.html");
if (studentHtml) {
  if (!studentHtml.includes("/assets/student-react/main.js")) {
    recordFailure("student.html missing student-react main.js reference");
  }
  if (!studentHtml.includes("getApiBase()")) {
    recordFailure("student.html missing getApiBase() usage");
  }
  if (studentHtml.includes("https://vysti-rules.onrender.com/mark")) {
    recordFailure("student.html contains hardcoded mark API URL");
  }
}

if (failures.length > 0) {
  console.error(`Smoke check failed (${failures.length} issue(s)).`);
  process.exit(1);
}

console.log("Smoke check passed.");
