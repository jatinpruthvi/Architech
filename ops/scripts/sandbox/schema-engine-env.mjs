/** Build the Prisma subprocess environment around an engine that exists here. */
export function schemaEngineEnvironment(baseEnv, installedBinary) {
  const binary = baseEnv.PRISMA_SCHEMA_ENGINE_BINARY ?? installedBinary;
  return {
    ...baseEnv,
    ...(binary
      ? {
          PRISMA_SCHEMA_ENGINE_BINARY: binary,
          PRISMA_MIGRATION_ENGINE_BINARY: binary,
        }
      : {}),
  };
}
