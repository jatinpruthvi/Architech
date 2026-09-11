"use client";
/* "Install app" entry point — quiet by design.

   It renders nothing until the browser proves install is possible:
     * Chromium hands over `beforeinstallprompt`, which we capture and replay on
       click (the native prompt, no custom nag sheet).
     * iOS Safari can only install via Share → Add to Home Screen, so there the
       button opens a three-step instruction dialog instead.
     * Everything else — desktop Firefox, an already-installed window, or a user
       who tapped "Not now" inside the last 14 days — renders nothing.

   All of that decision logic lives in `src/lib/pwa/install.ts` and is unit
   tested there; this file is only the DOM glue. */
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLang } from "@/contexts/LangContext";
import {
  INSTALL_DISMISS_KEY,
  detectInstallPlatformWithTouch,
  isStandaloneDisplay,
  readDisplayMode,
  resolveInstallAction,
  type InstallAction,
} from "@/lib/pwa/install";

/** The subset of the `beforeinstallprompt` event this component uses. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(INSTALL_DISMISS_KEY);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null; // private mode / blocked storage
  }
}

export default function InstallAppButton({
  variant = "header",
  onDark = false,
}: {
  variant?: "header" | "menu";
  onDark?: boolean;
}) {
  const { t } = useLang();
  const [action, setAction] = useState<InstallAction>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  /* Recompute from scratch whenever any input changes. `now` is read at call
     time so a long-lived tab re-evaluates the dismissal cooldown honestly. */
  const recompute = useCallback(
    (nextDeferred: BeforeInstallPromptEvent | null) => {
      const displayMode = readDisplayMode(
        query => window.matchMedia(query).matches
      );
      const standalone = isStandaloneDisplay(displayMode);
      const platform = detectInstallPlatformWithTouch(
        navigator.userAgent,
        "ontouchend" in window && navigator.maxTouchPoints > 0
      );
      setAction(
        resolveInstallAction({
          deferredPromptAvailable: nextDeferred !== null,
          standalone,
          platform,
          dismissedAt: readDismissedAt(),
          now: Date.now(),
        })
      );
    },
    []
  );

  useEffect(() => {
    recompute(null);

    const onPrompt = (event: Event) => {
      /* Letting the event run its default would show Chrome's own mini-infobar
         at a moment we did not choose; we replay it from the button instead. */
      event.preventDefault();
      const captured = event as BeforeInstallPromptEvent;
      setDeferred(captured);
      recompute(captured);
    };
    const onInstalled = () => {
      setDeferred(null);
      setAction("hidden");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [recompute]);

  if (action === "hidden") return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked — the cooldown simply will not persist */
    }
    setDialogOpen(false);
    setAction("hidden");
  };

  const onClick = async () => {
    if (action === "ios-instructions" || deferred === null) {
      setDialogOpen(true);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    /* A declined prompt means "stop asking": apply the same cooldown the
       dialog's Not-now button uses. */
    if (choice.outcome === "dismissed") dismiss();
    else setAction("hidden");
  };

  return (
    <>
      {variant === "header" ? (
        <button
          type="button"
          onClick={() => void onClick()}
          aria-label={t.install.label}
          title={t.install.label}
          className={`hidden h-10 items-center gap-1.5 rounded-xl border px-3 stamp font-bold transition-colors md:inline-flex ${
            /* Semantic ink tokens, not alpha labels: an alpha ink measures
               below AA in one theme and above it in the other, which is what
               the design-token-discipline ratchet exists to stop. `.ink-2`
               carries a per-theme value instead. */
            onDark
              ? "border-cream/25 text-cream hover:border-ember hover:text-ember"
              : "ink-2 border-ink/15 hover:border-brick hover:text-brick"
          }`}
        >
          <Download size={13} aria-hidden="true" />
          {t.install.label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void onClick()}
          className="touch-44 mt-3 flex items-center gap-2 text-left stamp font-semibold text-brick"
        >
          <Download size={15} aria-hidden="true" />
          {t.install.menuLabel} →
        </button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-paper text-ink">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-[-0.02em]">
              {t.install.dialogTitle}
            </DialogTitle>
            <DialogDescription className="ink-2">
              {t.install.dialogDescription}
            </DialogDescription>
          </DialogHeader>
          {action === "prompt" ? (
            <p className="stamp font-semibold text-brick">
              {t.install.installed}
            </p>
          ) : (
            <ol className="grid gap-3">
              <li className="ink-2 stamp font-medium">
                {t.install.stepsTitle}
              </li>
              <li className="ink-2 text-sm">1. {t.install.stepShare}</li>
              <li className="ink-2 text-sm">2. {t.install.stepAdd}</li>
              <li className="ink-2 text-sm">
                3. {t.install.stepConfirm}
              </li>
            </ol>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                onClick={dismiss}
                className="ink-2 touch-44 rounded-xl border border-ink/20 px-5 py-3 stamp font-semibold"
              >
                {t.install.dismiss}
              </button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
