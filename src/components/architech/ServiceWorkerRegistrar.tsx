"use client";
/* Registers the offline-shell service worker (public/sw.js).

   Production only, deliberately: a worker that controls the page in `next dev`
   would keep serving cached chunks across edits — the same stale-JS class of
   bug next.config.ts already guards against by forcing no-store on /_next/*
   in dev. Registration waits for `load` so the worker fetch never competes
   with the LCP-critical hero image. */
import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* Registration is an enhancement: a blocked or unsupported worker must
           never surface an error to the user. */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
