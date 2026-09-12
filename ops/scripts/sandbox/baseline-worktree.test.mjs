import assert from "node:assert/strict";
import test from "node:test";
import { baselineDir, provisionSteps, removeSteps, verdict } from "./baseline-worktree.mjs";

test("baseline lives beside the repo, never inside it", () => {
  const dir = baselineDir("/home/user/Architech");
  assert.equal(dir, "/home/user/Architech-baseline");
  assert.equal(dir.startsWith("/home/user/Architech/"), false);
  assert.equal(dir.startsWith("/home/user/Architech-baseline"), true);
});

test("provisioning creates a detached worktree and does a real install", () => {
  const steps = provisionSteps({ repoRoot: "/home/user/Architech" });
  assert.deepEqual(
    steps.map(([command, args]) => [command, ...args].join(" ")),
    [
      "git worktree add --detach /home/user/Architech-baseline origin/main",
      "pnpm install --frozen-lockfile",
    ],
  );
  assert.deepEqual(steps[0][2], { cwd: "/home/user/Architech" });
  // The install must happen inside the worktree, not the main checkout.
  assert.deepEqual(steps[1][2], { cwd: "/home/user/Architech-baseline" });
});

test("provisioning never symlinks node_modules — Turbopack rejects it", () => {
  const steps = provisionSteps({ repoRoot: "/home/user/Architech" });
  const flat = JSON.stringify(steps);
  assert.equal(flat.includes("ln -s"), false);
  assert.equal(flat.includes("symlink"), false);
  // A real install is the only way node_modules appears in the worktree.
  assert.equal(
    steps.some(([command, args]) => command === "pnpm" && args.includes("install")),
    true,
  );
});

test("--fetch refreshes the base ref before creating the worktree", () => {
  const steps = provisionSteps({ repoRoot: "/repo", base: "origin/release", fetch: true });
  assert.deepEqual(
    steps.map(([command, args]) => [command, ...args].join(" ")),
    ["git fetch origin release", "git worktree add --detach /repo-baseline origin/release", "pnpm install --frozen-lockfile"],
  );
});

test("teardown removes the worktree and prunes", () => {
  assert.deepEqual(
    removeSteps({ repoRoot: "/home/user/Architech" }).map(([command, args]) => [command, ...args].join(" ")),
    ["git worktree remove --force /home/user/Architech-baseline", "git worktree prune"],
  );
});

test("verdict separates a pre-existing failure from a regression", () => {
  const pre = verdict({ script: "test:perf", baseStatus: 1, headStatus: 1 });
  assert.equal(pre.regression, false);
  assert.match(pre.text, /pre-existing/);

  const reg = verdict({ script: "test:perf", baseStatus: 0, headStatus: 1 });
  assert.equal(reg.regression, true);
  assert.match(reg.text, /this branch introduced it/);

  const fixed = verdict({ script: "test:perf", baseStatus: 1, headStatus: 0 });
  assert.equal(fixed.regression, false);
  assert.match(fixed.text, /this branch fixes it/);

  const clean = verdict({ script: "test:perf", baseStatus: 0, headStatus: 0 });
  assert.equal(clean.regression, false);
  assert.match(clean.text, /passes on both/);
});
