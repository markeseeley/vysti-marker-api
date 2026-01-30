import { logEvent } from "./logger";

export const buildRedirectTarget = (next) => {
  const target =
    next ||
    `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/signin.html?redirect=${encodeURIComponent(target)}`;
};

export const redirectToSignIn = (next) => {
  const redirectUrl = buildRedirectTarget(next);
  logEvent("auth_redirect", { redirectUrl });
  window.location.replace(redirectUrl);
};
