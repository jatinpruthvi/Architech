export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    /* The SEO event spine's consumers are wired here, once, at startup.

       Registering them from a route module instead would mean a write path
       that never imports that module also never notifies anyone — which is
       precisely the hole the spine was built to close. Startup registration
       makes "published but invisible" impossible by construction rather than
       by convention. */
    const { registerSeoDiscovery } = await import("./client/src/lib/seo/discovery");
    registerSeoDiscovery();
    /* Retention policy enforcement (M-6): policy alone does not remove stale
       media. Registered at startup, on the same in-process scheduler model as
       the SEO spine; disable with MEDIA_RETENTION_SWEEP=off. */
    const { registerMediaRetentionRuntime } = await import("./client/src/lib/media/retention-runtime");
    registerMediaRetentionRuntime();
  }
}
