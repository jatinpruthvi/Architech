import { spawnSync } from "node:child_process";
import process from "node:process";

const command = process.platform === "win32" ? "next.cmd" : "next";
const build = spawnSync(command, ["build"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: "inherit",
});

if (build.error) {
  console.error(build.error);
  process.exit(1);
}
if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1);

const materialize = spawnSync(process.execPath, ["scripts/materialize-static-publish.mjs"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
  stdio: "inherit",
});

if (materialize.error) {
  console.error(materialize.error);
  process.exit(1);
}
process.exit(materialize.status ?? 1);
