import { logEvent } from "./logger";
import {
  buildReturnTo as buildReturnToShared,
  buildSigninUrl as buildSigninUrlShared,
  redirectToSignin as redirectToSigninShared
} from "@shared/auth";

export const buildReturnTo = () => buildReturnToShared();

export const buildSigninUrl = (returnTo) => buildSigninUrlShared(returnTo);

export const redirectToSignin = (returnTo) => {
  const redirectUrl = buildSigninUrl(returnTo);
  logEvent("auth_redirect", { redirectUrl });
  redirectToSigninShared(returnTo);
};
