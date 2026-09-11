/* Pure decision logic for the "install Architech" affordance.

   This module owns *whether* and *how* the install entry point shows; the DOM
   glue lives in `src/components/architech/InstallAppButton.tsx`. Everything
   here takes plain values and returns plain values so it is unit-testable in
   the Node runtime vitest uses (vitest.config.ts only includes `*.test.ts`, so
   no JSX belongs in this file).

   Platform reality this encodes:
     - Chromium (Android/desktop) hands us a `beforeinstallprompt` event; that
       is the only reliable "install is available" signal, so the button is
       hidden until it fires.
     - iOS Safari fires no such event. Installed apps are created manually via
       Share → Add to Home Screen, so on iOS we show instructions instead —
       but only when the app is not already installed. */

export type InstallPlatform = "chromium" | "ios" | "other";

export type InstallAction = "prompt" | "ios-instructions" | "hidden";

export interface InstallState {
  /** True once the browser has handed over a `beforeinstallprompt` event. */
  deferredPromptAvailable: boolean;
  /** True when the page is running in an installed (standalone) window. */
  standalone: boolean;
  /** Detected platform bucket from the user agent. */
  platform: InstallPlatform;
  /** The user dismissed the entry point at this epoch-ms, or null. */
  dismissedAt: number | null;
  /** Epoch-ms "now". */
  now: number;
}

/** How long a dismissal hides the button again. Two weeks: long enough to stop
    nagging, short enough to survive a device change of heart. */
export const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export const INSTALL_DISMISS_KEY = "architech.install.dismissedAt";

/* `standalone` is the value the spec defines for display-mode: standalone;
   iOS Safari additionally reports `uiwebview`/`minimal-ui` for home-screen web
   apps, and both are accepted as "installed" here. */
const STANDALONE_DISPLAYS = new Set(["standalone", "fullscreen", "uiwebview"]);

/** Classify a user agent string alone. iPadOS 13+ reports a desktop
    "Macintosh" UA, so that case needs the touch signal — use
    `detectInstallPlatformWithTouch` when the caller can supply it. */
export function detectInstallPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (ua.includes("android")) return "chromium";
  if (
    ua.includes("chrome") ||
    ua.includes("edg/") ||
    ua.includes("opera") ||
    ua.includes("samsungbrowser")
  )
    return "chromium";
  return "other";
}

/** Same classification with the iPadOS touch signal supplied by the caller. */
export function detectInstallPlatformWithTouch(
  userAgent: string,
  hasTouch: boolean
): InstallPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (ua.includes("macintosh") && ua.includes("mac os x") && hasTouch)
    return "ios";
  return detectInstallPlatform(userAgent);
}

/** True when a `display-mode` value means the app is already installed. */
export function isStandaloneDisplay(displayMode: string | null): boolean {
  return displayMode !== null && STANDALONE_DISPLAYS.has(displayMode);
}

/** Read the display mode without touching `window` at import time. */
export function readDisplayMode(
  matchStandalone: (query: string) => boolean
): string | null {
  for (const mode of ["standalone", "fullscreen", "minimal-ui"]) {
    if (matchStandalone(`(display-mode: ${mode})`)) return mode;
  }
  return null;
}

/** Decide what the install entry point does right now. */
export function resolveInstallAction(state: InstallState): InstallAction {
  if (state.standalone) return "hidden";
  if (
    state.dismissedAt !== null &&
    state.now - state.dismissedAt < DISMISS_COOLDOWN_MS
  )
    return "hidden";
  if (state.deferredPromptAvailable) return "prompt";
  if (state.platform === "ios") return "ios-instructions";
  return "hidden";
}

/** Step list for the iOS manual install path, as i18n string keys. */
export const IOS_INSTALL_STEPS = [
  "share",
  "addToHomeScreen",
  "confirm",
] as const;

export type IosInstallStep = (typeof IOS_INSTALL_STEPS)[number];
