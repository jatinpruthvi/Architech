// Empty stand-in for the real `server-only` package so server-mode modules can
// be imported and exercised by Vitest (which is not a React Server Component
// runtime). The real `server-only` guard stays in the production bundle.
export {};
