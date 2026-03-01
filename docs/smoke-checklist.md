# Smoke checklist

## Local build
- `node tools/build-student-react.mjs`

## Local smoke
- `BASE_URL=http://localhost:XXXX node tools/smoke.mjs`

## What to do when it fails
- Missing `/shared` => static server misconfigured or not serving `/shared`
- Missing `main.js` => React build not run or wrong `outDir`
- Build id placeholder => `student_react.html` not patched by build script
