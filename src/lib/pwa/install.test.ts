import { describe, expect, it } from "vitest";
import {
  DISMISS_COOLDOWN_MS,
  detectInstallPlatform,
  detectInstallPlatformWithTouch,
  isStandaloneDisplay,
  readDisplayMode,
  resolveInstallAction,
  type InstallState,
} from "./install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1";
const IPAD_OS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DESKTOP_FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0";

function state(overrides: Partial<InstallState> = {}): InstallState {
  return {
    deferredPromptAvailable: false,
    standalone: false,
    platform: "chromium",
    dismissedAt: null,
    now: Date.UTC(2026, 8, 11),
    ...overrides,
  };
}

describe("detectInstallPlatform", () => {
  it("routes iPhone Safari to the manual iOS path", () => {
    expect(detectInstallPlatform(IPHONE_SAFARI)).toBe("ios");
  });

  it("routes Android and desktop Chromium builds to the prompt path", () => {
    expect(detectInstallPlatform(ANDROID_CHROME)).toBe("chromium");
    expect(detectInstallPlatform(DESKTOP_CHROME)).toBe("chromium");
  });

  it("does not claim Chromium can prompt on a browser that cannot", () => {
    expect(detectInstallPlatform(DESKTOP_FIREFOX)).toBe("other");
  });

  it("needs the touch signal to recognise iPadOS, which spoofs a desktop UA", () => {
    expect(detectInstallPlatform(IPAD_OS)).toBe("other");
    expect(detectInstallPlatformWithTouch(IPAD_OS, true)).toBe("ios");
    expect(detectInstallPlatformWithTouch(IPAD_OS, false)).toBe("other");
  });
});

describe("isStandaloneDisplay", () => {
  it("treats standalone, fullscreen and the iOS uiwebview alias as installed", () => {
    expect(isStandaloneDisplay("standalone")).toBe(true);
    expect(isStandaloneDisplay("fullscreen")).toBe(true);
    expect(isStandaloneDisplay("uiwebview")).toBe(true);
  });

  it("treats browser and minimal-ui as not installed", () => {
    expect(isStandaloneDisplay("browser")).toBe(false);
    expect(isStandaloneDisplay("minimal-ui")).toBe(false);
    expect(isStandaloneDisplay(null)).toBe(false);
  });
});

describe("readDisplayMode", () => {
  it("returns the first matching display mode and null when none match", () => {
    expect(readDisplayMode(query => query.includes("standalone"))).toBe(
      "standalone"
    );
    expect(readDisplayMode(query => query.includes("minimal-ui"))).toBe(
      "minimal-ui"
    );
    expect(readDisplayMode(() => false)).toBeNull();
  });
});

describe("resolveInstallAction", () => {
  it("hides the entry point once the app is installed", () => {
    expect(
      resolveInstallAction(
        state({ standalone: true, deferredPromptAvailable: true })
      )
    ).toBe("hidden");
  });

  it("offers the native prompt when the browser handed one over", () => {
    expect(resolveInstallAction(state({ deferredPromptAvailable: true }))).toBe(
      "prompt"
    );
  });

  it("falls back to Add-to-Home-Screen instructions on iOS", () => {
    expect(resolveInstallAction(state({ platform: "ios" }))).toBe(
      "ios-instructions"
    );
  });

  it("stays hidden on platforms that can neither prompt nor instruct", () => {
    expect(resolveInstallAction(state({ platform: "other" }))).toBe("hidden");
  });

  it("respects a recent dismissal and expires it after the cooldown", () => {
    const now = Date.UTC(2026, 8, 11);
    expect(
      resolveInstallAction(
        state({ deferredPromptAvailable: true, dismissedAt: now - 1000, now })
      )
    ).toBe("hidden");
    expect(
      resolveInstallAction(
        state({
          deferredPromptAvailable: true,
          dismissedAt: now - DISMISS_COOLDOWN_MS,
          now,
        })
      )
    ).toBe("prompt");
  });

  it("prefers the native prompt over iOS instructions when both apply", () => {
    expect(
      resolveInstallAction(
        state({ platform: "ios", deferredPromptAvailable: true })
      )
    ).toBe("prompt");
  });
});
