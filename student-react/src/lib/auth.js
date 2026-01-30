import { logEvent } from "./logger";

export const buildReturnTo = () => {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

export const buildSigninUrl = (returnTo) => {
  const target = returnTo || buildReturnTo();
  return `/signin.html?redirect=${encodeURIComponent(target)}`;
};

export const redirectToSignin = (returnTo) => {
  const redirectUrl = buildSigninUrl(returnTo);
  logEvent("auth_redirect", { redirectUrl });
  window.location.replace(redirectUrl);
};
