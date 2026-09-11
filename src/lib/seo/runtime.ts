export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function isPublicIndexingEnabled(env: RuntimeEnvironment = process.env) {
  return env.NODE_ENV !== "production" || env.PUBLIC_INDEXING_ENABLED === "true";
}

export function publicRobots(indexable: boolean, env: RuntimeEnvironment = process.env) {
  if (!indexable || !isPublicIndexingEnabled(env)) return { index: false, follow: false } as const;
  return { index: true, follow: true } as const;
}
