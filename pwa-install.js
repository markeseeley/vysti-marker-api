// Vysti Marker — PWA install + service-worker bootstrap
// Loaded on the React shell pages.  Two jobs:
//   1. Register /sw.js — required for installability in Chromium browsers
//      (Chrome/Edge will not surface an install option without a SW).
//   2. Surface an unobtrusive "Install Vysti" button when the browser
//      reports the app is installable (the `beforeinstallprompt` event),
//      or an "Add to Home Screen" hint on iOS Safari where that event
//      never fires.
//
// Self-contained: injects its own styles and markup, no dependencies.

(function () {
  "use strict";

  // ── 1. Register the service worker ──────────────────────────────────
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function (err) {
        console.warn("[vysti] service worker registration failed:", err);
      });
    });
  }

  // ── Skip the prompt if already installed / running standalone ────────
  var isStandalone =
    (window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  // ── Respect a recent dismissal (don't nag — re-offer after 14 days) ──
  var DISMISS_KEY = "vysti-install-dismissed";
  var DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
  try {
    var last = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    if (last && Date.now() - last < DISMISS_MS) return;
  } catch (e) {
    /* localStorage unavailable — proceed without dismissal memory */
  }

  // ── iOS Safari detection (beforeinstallprompt never fires there) ─────
  // iPadOS 13+ reports a Mac UA, so also treat a touch-capable Mac as iOS.
  var ua = navigator.userAgent || "";
  var isIOS =
    /iphone|ipod|ipad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);

  var deferredPrompt = null;

  // ── Styles + button markup, injected once on first need ─────────────
  function injectStyles() {
    if (document.getElementById("vysti-install-styles")) return;
    var css =
      "#vysti-install{position:fixed;right:18px;bottom:18px;z-index:9998;" +
      "display:flex;align-items:center;gap:2px;" +
      "font-family:'DM Sans',system-ui,-apple-system,sans-serif;" +
      "opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}" +
      "#vysti-install.vi-show{opacity:1;transform:translateY(0)}" +
      "#vysti-install .vi-btn{display:flex;align-items:center;gap:8px;" +
      "background:#141414;color:#fff;border:none;cursor:pointer;" +
      "padding:11px 16px;border-radius:999px 0 0 999px;" +
      "font-size:14px;font-weight:600;line-height:1;" +
      "box-shadow:0 6px 22px rgba(0,0,0,.22);transition:background .15s}" +
      "#vysti-install .vi-btn:hover{background:#A90D22}" +
      "#vysti-install .vi-btn svg{flex:none}" +
      "#vysti-install .vi-close{background:#141414;color:#fff;border:none;" +
      "cursor:pointer;padding:11px 12px 11px 6px;border-radius:0 999px 999px 0;" +
      "font-size:16px;line-height:1;box-shadow:0 6px 22px rgba(0,0,0,.22);" +
      "transition:background .15s}" +
      "#vysti-install .vi-close:hover{background:#A90D22}" +
      "#vysti-install-tip{position:fixed;right:18px;bottom:74px;z-index:9999;" +
      "max-width:280px;background:#fff;color:#1a1a1a;border-radius:12px;" +
      "padding:16px 18px;font-family:'DM Sans',system-ui,sans-serif;" +
      "font-size:14px;line-height:1.5;box-shadow:0 8px 30px rgba(0,0,0,.2);" +
      "opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}" +
      "#vysti-install-tip.vi-show{opacity:1;transform:translateY(0)}" +
      "#vysti-install-tip b{color:#A90D22}";
    var style = document.createElement("style");
    style.id = "vysti-install-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (e) {}
    removeUI();
  }

  function removeUI() {
    var el = document.getElementById("vysti-install");
    if (el) el.remove();
    var tip = document.getElementById("vysti-install-tip");
    if (tip) tip.remove();
  }

  var downloadIcon =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/>' +
    '<path d="M5 21h14"/></svg>';

  function showButton(onClick) {
    if (document.getElementById("vysti-install")) return;
    injectStyles();
    var wrap = document.createElement("div");
    wrap.id = "vysti-install";

    var btn = document.createElement("button");
    btn.className = "vi-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Install Vysti as an app");
    btn.innerHTML = downloadIcon + "<span>Install Vysti</span>";
    btn.addEventListener("click", onClick);

    var close = document.createElement("button");
    close.className = "vi-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss install prompt");
    close.innerHTML = "&times;";
    close.addEventListener("click", dismiss);

    wrap.appendChild(btn);
    wrap.appendChild(close);
    document.body.appendChild(wrap);
    requestAnimationFrame(function () {
      wrap.classList.add("vi-show");
    });
  }

  // ── Chromium / Android path: one-tap native install ─────────────────
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showButton(function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        removeUI();
      });
    });
  });

  window.addEventListener("appinstalled", function () {
    removeUI();
  });

  // ── iOS Safari path: instructions (no programmatic install exists) ──
  if (isIOS && isSafari) {
    function toggleTip() {
      var existing = document.getElementById("vysti-install-tip");
      if (existing) {
        existing.remove();
        return;
      }
      injectStyles();
      var tip = document.createElement("div");
      tip.id = "vysti-install-tip";
      tip.innerHTML =
        "To install Vysti: tap the <b>Share</b> icon, then " +
        "<b>Add to Home Screen</b>.";
      document.body.appendChild(tip);
      requestAnimationFrame(function () {
        tip.classList.add("vi-show");
      });
    }
    // Defer slightly so it appears after the app paints, not on cold load.
    window.addEventListener("load", function () {
      setTimeout(function () {
        showButton(toggleTip);
      }, 1500);
    });
  }
})();
