/**
 * Detect phones (not tablets) for the stripped-down mobile experience.
 *
 * iPads with iPadOS report as "Macintosh" in the user agent, so we
 * detect them via touch support. However, we intentionally do NOT
 * redirect iPad users to the mobile app — iPads get the full desktop
 * experience (tablet work is a separate future effort).
 *
 * This function returns true ONLY for phones.
 */
export function isMobilePhone() {
  const ua = navigator.userAgent;
  // iPhone, iPod, or Android phone (not tablet)
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  // webOS, BlackBerry, Opera Mini, IEMobile — legacy but included
  if (/webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return true;
  return false;
}
