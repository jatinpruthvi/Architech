import type { ExternalToast } from "sonner";

/* Performance audit 2026-09-06 (finding F1): sonner used to ride the universal
   first-load shell because root-level code (providers' compare context,
   property cards) imported it statically. This helper defers the library to
   first use — the call fire-and-forgets a dynamic import, and the dynamically
   imported <Toaster> island (Providers) renders anything queued before it
   hydrates. Route-level code may keep importing sonner directly; only
   components reachable from the universal shell must go through here. */

type ToastMessage = Parameters<typeof import("sonner")["toast"]>[0];

export function lazyToast(message: ToastMessage, options?: ExternalToast): void {
  void import("sonner").then((module) => {
    module.toast(message, options);
  });
}
