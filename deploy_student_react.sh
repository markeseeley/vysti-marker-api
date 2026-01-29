#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

fail() {
  echo "Error: $1"
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  ./deploy_student_react.sh          # preflight + build + stage
  ./deploy_student_react.sh --check  # preflight only
  ./deploy_student_react.sh --doctor # preflight only
  ./deploy_student_react.sh -c       # preflight only
  ./deploy_student_react.sh --strict-git
  ./deploy_student_react.sh --no-git-checks
  ./deploy_student_react.sh --allow-dirty
  ./deploy_student_react.sh --allow-non-main
  ./deploy_student_react.sh -h|--help
EOF
}

print_node_fix() {
  local brew_path="$1"
  if [ -n "${brew_path}" ]; then
    echo "Fix (macOS, Homebrew): brew install node"
  else
    echo "Install Node LTS from nodejs.org or install Homebrew then brew install node"
  fi
}

preflight() {
  local doctor="$1"
  local failures=0

  local brew_path node_path npm_path node_version node_major npm_version
  brew_path="$(command -v brew 2>/dev/null || true)"
  node_path="$(command -v node 2>/dev/null || true)"
  npm_path="$(command -v npm 2>/dev/null || true)"

  if [ "${doctor}" = "true" ]; then
    echo "==> Preflight checks"
    echo "Repo root: ${ROOT}"
    echo "CWD: $(pwd)"
    echo "node: ${node_path:-missing}"
  fi

  if [ -z "${node_path}" ]; then
    if [ "${doctor}" = "true" ]; then
      echo "node -v: missing"
      echo "Node >= 18: FAIL (node not found)"
      print_node_fix "${brew_path}"
      failures=1
    else
      echo "Error: node is not installed."
      print_node_fix "${brew_path}"
      exit 1
    fi
  else
    node_version="$(node -v 2>/dev/null || true)"
    node_major="${node_version#v}"
    node_major="${node_major%%.*}"
    if [ "${doctor}" = "true" ]; then
      echo "node -v: ${node_version:-unknown}"
    fi
    if [ -z "${node_major}" ] || [ "${node_major}" -lt 18 ]; then
      if [ "${doctor}" = "true" ]; then
        echo "Node >= 18: FAIL (found ${node_version:-unknown})"
        print_node_fix "${brew_path}"
        failures=1
      else
        fail "Node 18+ required (found ${node_version:-unknown})."
      fi
    else
      if [ "${doctor}" = "true" ]; then
        echo "Node >= 18: PASS"
      fi
    fi
  fi

  if [ "${doctor}" = "true" ]; then
    echo "npm: ${npm_path:-missing}"
  fi
  if [ -z "${npm_path}" ]; then
    if [ "${doctor}" = "true" ]; then
      echo "npm -v: missing"
      print_node_fix "${brew_path}"
      failures=1
    else
      echo "Error: npm is not installed."
      print_node_fix "${brew_path}"
      exit 1
    fi
  else
    npm_version="$(npm -v 2>/dev/null || true)"
    if [ "${doctor}" = "true" ]; then
      echo "npm -v: ${npm_version:-unknown}"
    fi
  fi

  if [ "${doctor}" = "true" ]; then
    if [ -n "${brew_path}" ]; then
      echo "brew: ${brew_path}"
    else
      echo "brew: missing"
      echo "Install Node LTS from nodejs.org or install Homebrew then brew install node"
    fi
  fi

  if [ ! -f "${ROOT}/student-react/package.json" ]; then
    if [ "${doctor}" = "true" ]; then
      echo "student-react/package.json: FAIL (missing)"
      echo "Fix: run from repo root or restore student-react."
      failures=1
    else
      fail "Missing ${ROOT}/student-react/package.json (are you in the repo root?)."
    fi
  else
    if [ "${doctor}" = "true" ]; then
      echo "student-react/package.json: PASS"
    fi
  fi

  if [ "${doctor}" = "true" ]; then
    if [ -f "${ROOT}/student-react/package-lock.json" ]; then
      echo "student-react/package-lock.json: present"
    else
      echo "student-react/package-lock.json: not found (npm install will be used)"
    fi
  fi

  if [ "${doctor}" = "true" ]; then
    if [ -d "${ROOT}/assets/student-react" ]; then
      echo "assets/student-react: PASS (exists)"
    else
      echo "assets/student-react: PASS (will be created on build)"
    fi
  fi

  if [ ! -f "${ROOT}/student_react.html" ]; then
    if [ "${doctor}" = "true" ]; then
      echo "student_react.html: FAIL (missing)"
      echo "Fix: ensure student_react.html exists in repo root."
      failures=1
    else
      fail "Missing ${ROOT}/student_react.html."
    fi
  else
    if [ "${doctor}" = "true" ]; then
      echo "student_react.html: PASS"
    fi
    local missing_refs=0
    if ! grep -q "assets/student-react/main.js" "${ROOT}/student_react.html" 2>/dev/null; then
      missing_refs=1
    fi
    if ! grep -q "assets/student-react/assets/index.css" "${ROOT}/student_react.html" 2>/dev/null; then
      missing_refs=1
    fi
    if [ "${missing_refs}" -eq 1 ]; then
      echo "WARN: student_react.html missing expected asset paths."
      echo "      Expected: assets/student-react/main.js and assets/student-react/assets/index.css"
    fi
  fi

  if [ "${doctor}" = "true" ]; then
    return "${failures}"
  fi
  return 0
}

git_safety_checks() {
  BRANCH="$(git -C "${ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
  DIRTY=0
  git -C "${ROOT}" diff --quiet || DIRTY=1
  git -C "${ROOT}" diff --cached --quiet || DIRTY=1
  if [ "${DIRTY}" -eq 1 ]; then
    DIRTY_STATUS="yes"
  else
    DIRTY_STATUS="no"
  fi

  if [ "${STRICT_GIT}" = "true" ]; then
    if [ "${BRANCH}" != "main" ] && [ "${ALLOW_NON_MAIN}" != "true" ]; then
      echo "Error: must run on main branch (current: ${BRANCH})."
      exit 1
    fi
    if [ "${DIRTY}" -eq 1 ] && [ "${ALLOW_DIRTY}" != "true" ]; then
      echo "Error: working tree has uncommitted changes. Commit or stash first."
      exit 1
    fi
  else
    if [ "${BRANCH}" != "main" ] && [ "${ALLOW_NON_MAIN}" != "true" ]; then
      echo "WARNING: You're not on main; that's okay. Render deploy will follow whatever you push. If you intended main, switch: git checkout main"
    fi
    if [ "${DIRTY}" -eq 1 ] && [ "${ALLOW_DIRTY}" != "true" ]; then
      echo "WARNING: Working tree is dirty; that's okay. Consider stashing/committing before deploy for reproducibility."
    fi
  fi
}

doctor_mode=false
STRICT_GIT=false
NO_GIT_CHECKS=false
ALLOW_DIRTY=false
ALLOW_NON_MAIN=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    -c|--check|--doctor)
      doctor_mode=true
      shift
      ;;
    --strict-git)
      STRICT_GIT=true
      shift
      ;;
    --no-git-checks)
      NO_GIT_CHECKS=true
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=true
      shift
      ;;
    --allow-non-main)
      ALLOW_NON_MAIN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [ "${doctor_mode}" = "true" ]; then
  if preflight true; then
    if [ "${NO_GIT_CHECKS}" != "true" ]; then
      git_safety_checks
    else
      BRANCH="unknown (git checks skipped)"
      DIRTY_STATUS="unknown (git checks skipped)"
    fi
    echo "All good."
    exit 0
  fi
  echo "One or more checks failed."
  exit 1
fi

preflight false
if [ "${NO_GIT_CHECKS}" != "true" ]; then
  git_safety_checks
else
  BRANCH="unknown (git checks skipped)"
  DIRTY_STATUS="unknown (git checks skipped)"
fi

APP_BUILD_ID="${APP_BUILD_ID:-$(date +%Y%m%d-%H%M)}"
echo "==> Building Student React with APP_BUILD_ID=${APP_BUILD_ID}"

pushd "${ROOT}/student-react" >/dev/null
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
VITE_APP_BUILD_ID="${APP_BUILD_ID}" npm run build
popd >/dev/null

echo "==> Verifying expected outputs..."
test -f "${ROOT}/assets/student-react/main.js"
test -f "${ROOT}/assets/student-react/assets/index.css"

echo "==> Staging deploy artifacts..."
git -C "${ROOT}" add student_react.html assets/student-react

if [ -f "${ROOT}/assets/cache-buster.js" ]; then
  git -C "${ROOT}" add assets/cache-buster.js
fi

echo "✅ Build complete. Build ID: ${APP_BUILD_ID}"
echo "   - assets/student-react/main.js"
echo "   - assets/student-react/assets/index.css"
echo
echo "Next commands:"
echo "  git status"
echo "  git add -A"
echo "  git commit -m \"Build student React Step 1 (dist)\""
echo "  git push"
echo
echo "Current branch: ${BRANCH}"
echo "Working tree dirty: ${DIRTY_STATUS}"
echo "Reminder: Push triggers Render deploy (if auto-deploy enabled)."
echo
echo "Verify: /student_react.html"
