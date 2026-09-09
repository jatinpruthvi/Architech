# .skills — Vendored AI Skill Libraries

Skill content vendored from public third-party repos for use by AI coding agents
(Claude Code, Cursor, etc.). Only skill definitions + README/LICENSE are vendored;
upstream build tooling, tests, demos, and per-agent config dirs were dropped to keep
the repo lean (~16MB vs ~80MB full clones).

Originals are kept at `/tmp/skills-originals/` on this machine for future re-sync.

## Contents

| Directory | Source | Vendored |
|---|---|---|
| `genjutsu/` | https://github.com/AThevon/genjutsu | `skills/`, README, LICENSE |
| `gsap-skills/` | https://github.com/greensock/gsap-skills | `skills/`, README, LICENSE |
| `impeccable/` | https://github.com/pbakaus/impeccable | `skill/`, README, LICENSE, NOTICE |
| `motion-design-skill/` | https://github.com/lottiefiles/motion-design-skill | `skills/`, README, LICENSE |
| `skills/` | https://github.com/emilkowalski/skills | `skills/`, README, LICENSE |
| `superpowers/` | https://github.com/obra/superpowers | `skills/`, README, LICENSE |
| `taste-skill/` | https://github.com/Leonxlnx/taste-skill | `skills/`, README, LICENSE |
| `threejs-skills/` | https://github.com/cloudai-x/threejs-skills | `skills/`, README |
| `ui-ux-pro-max-skill/` | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | `.claude/`, `.claude-plugin/` |

## Updating

Re-clone the upstream repo, copy the same paths listed above into the matching
directory here, and commit. Do not add the upstream `.git` folders.
