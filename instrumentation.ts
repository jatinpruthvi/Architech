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
    /* Saved-search alerts (I-12): the `notify` flag is a stored promise, and
       this is the delivery arm. Registered gated-on-envs; when the keys are
       absent it logs once and stays silent rather than pretending a queue
       exists. Same startup-discipline as the SEO spine. */
    const { registerSavedSearchAlertRuntime } = await import("./client/src/lib/saved-search/alerts-runtime");
    registerSavedSearchAlertRuntime();
    /* Lead notifications: same gated contract — without LEAD_NOTIFICATIONS=on
       + Resend + sender, nothing subscribes and the silence is logged once.
       Recipients are prisma BrokerUser memberships; demo inboxes own no real
       addresses, so demo leads log "no recipients", never mail out. */
    const { registerLeadNotificationRuntime } = await import("./client/src/lib/leads/notifications-runtime");
    registerLeadNotificationRuntime();
    /* Retention policy enforcement (M-6): policy alone does not remove stale
       media. Registered at startup, on the same in-process scheduler model as
       the SEO spine; disable with MEDIA_RETENTION_SWEEP=off. */
    const { registerMediaRetentionRuntime } = await import("./client/src/lib/media/retention-runtime");
    registerMediaRetentionRuntime();
  }
}
