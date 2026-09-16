# camofox-browser — Installation & Troubleshooting Guide

Setup guide for running **camofox-browser** (stealth headless browser for AI agents) with **opencode** MCP integration on Windows.

> Written from an actual working install (Node 26 + VS 2026 + camofox-browser 1.13.1 + opencode). Every troubleshooting item below was hit and resolved during setup.

---

## 1. What You Are Installing

```
camofox-browser (REST server :9377)
   └─ camoufox-js  (Camoufox Node driver)
        └─ better-sqlite3 v13  (native C++ addon — reads the WebGL fingerprint DB)
             └─ needs MSVC C++ compiler + Windows SDK at install time (ONLY time it is needed)
```

- **REST server** — long-running process that launches the Camoufox browser
- **MCP adapter** (`mcp/server.mjs`) — bridges MCP tool calls (`camofox_create_tab`, etc.) to the REST server
- **Camoufox binary** (~300MB) — downloaded automatically on first `npm install` / server start

---

## 2. Prerequisites

| Requirement | Version | Why |
|---|---|---|
| Node.js | **>= 22** (tested with 26) | camofox-browser runtime |
| Visual Studio with C++ toolset | 2022+ (tested with 2026 / MSVC 14.51) | Compiles `better-sqlite3` |
| Disk space | ~1–2 GB free | Node, VS C++ workload, Camoufox binary |

**Check before starting:**
```powershell
node --version
npm --version
```

---

## 3. Installation Steps

### Step 1 — Install Node.js

Download the LTS installer from <https://nodejs.org/> and install (defaults are fine).

> If you're stuck without a package manager and need a portable install:
> ```powershell
> # download portable zip, extract anywhere, add \node-vXX-win-x64 to PATH
> Invoke-WebRequest "https://nodejs.org/dist/latest-v22.x/node-v22.x.y-win-x64.zip" -OutFile node.zip
> Expand-Archive node.zip -DestinationPath C:\tools
> ```

### Step 2 — Install Visual Studio C++ toolset (MINIMAL selection)

Full VS or Build Tools — the goal is only two components:

1. **MSVC v143/v180 (Latest) — C++ x64/x86 build tools**
2. **Windows 11 SDK** (latest)

Untick everything else (CMake, Clang, vcpkg, Spectre libs, test tools, etc.) to keep the install at **~2–3 GB instead of ~8 GB**.

CLI equivalent:
```powershell
# Build Tools (lightest option):
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# Or add components to an existing VS install:
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" modify `
  --installPath "C:\Program Files\Microsoft Visual Studio\18\Community" `
  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --quiet --wait
```

**Verify the compiler is really there** (this exact check caught an incomplete install):
```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
# must print the VS path (NOT empty)
Test-Path "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
# must print True
```

### Step 3 — Extract camofox-browser

```powershell
Expand-Archive "E:\Jatin-Project\Broker\BrainStrom\automation\camofox-browser-1.13.1.zip" -DestinationPath "E:\Jatin-Project\Broker\BrainStrom\automation" -Force
```

### Step 4 — npm install

```powershell
cd "E:\Jatin-Project\Broker\BrainStrom\automation\camofox-browser-1.13.1"
npm install
```

What happens here:
- `better-sqlite3` is **compiled from source** (first run only, takes a few minutes)
- Camoufox binary download is triggered by `camoufox-js` (postinstall / first launch)

**Verify the native module:**
```powershell
node -e "const D=require('better-sqlite3'); const db=new D(':memory:'); console.log('OK:', db.prepare('select 1 as x').get().x)"
# -> OK: 1
```

### Step 5 — Start the REST server

```powershell
cd "E:\Jatin-Project\Broker\BrainStrom\automation\camofox-browser-1.13.1"
$env:CAMOFOX_CRASH_REPORT_ENABLED = "false"   # optional: disable telemetry
npm start
```

- Server listens on **http://localhost:9377**
- First launch downloads the Camoufox browser (~300MB) — this is normal
- Keep this terminal/window open (or run as a background process)

**Health check:**
```powershell
Invoke-RestMethod "http://localhost:9377/health"
# -> {"ok":true,"engine":"camoufox","browserConnected":true,"browserRunning":true,...}
```

### Step 6 — Install the MCP adapter

```powershell
cd "E:\Jatin-Project\Broker\BrainStrom\automation\camofox-browser-1.13.1\mcp"
npm install
```

> The MCP adapter is a **separate lightweight package** — only depends on `@modelcontextprotocol/sdk`. It does NOT contain the browser.

### Step 7 — Register with opencode

Create `opencode.json` in your project root (`E:\Jatin-Project\Broker\BrainStrom\automation\opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "camofox-browser": {
      "type": "local",
      "command": [
        "node",
        "E:/Jatin-Project/Broker/BrainStrom/automation/camofox-browser-1.13.1/mcp/server.mjs"
      ],
      "enabled": true
    }
  }
}
```

**Restart opencode** (config is loaded only at startup). Verify with `/mcp` or:
```powershell
opencode mcp list
```

You should see **11 tools**: `camofox_create_tab`, `camofox_snapshot`, `camofox_click`, `camofox_type`, `camofox_navigate`, `camofox_scroll`, `camofox_screenshot`, `camofox_evaluate`, `camofox_list_tabs`, `camofox_close_tab`, `camofox_import_cookies`.

### Step 8 — End-to-end smoke test (REST)

```powershell
$tab = Invoke-RestMethod -Method Post -Uri "http://localhost:9377/tabs" -ContentType "application/json" -Body '{"userId":"test","sessionKey":"smoke","url":"https://example.com"}'
$snap = Invoke-RestMethod -Uri "http://localhost:9377/tabs/$($tab.tabId)/snapshot?userId=test"
$snap.snapshot   # accessibility tree with element refs (e1, e2, ...)
```

---

## 4. Useful Configuration

| Env var | Purpose | Default |
|---|---|---|
| `CAMOFOX_PORT` | Server port | `9377` |
| `CAMOFOX_API_KEY` | Required to enable cookie import (`camofox_import_cookies`) | unset |
| `CAMOFOX_ACCESS_KEY` | Bearer auth for all routes (remote deployments) | unset |
| `CAMOFOX_CRASH_REPORT_ENABLED` | Set `false` to disable telemetry | `true` |
| `CAMOFOX_COOKIES_DIR` | Netscape cookie files for import | `~/.camofox/cookies` |
| `CAMOFOX_PROFILE_DIR` | Persisted sessions (cookies + localStorage) | `~/.camofox/profiles` |
| `PROXY_HOST` / `PROXY_PORT` / `PROXY_USERNAME` / `PROXY_PASSWORD` | Route traffic through a proxy (GeoIP auto-syncs locale/timezone) | unset |

**Keeping the browser up to date:** the anti-bot engine (Camoufox binary) is separate from the wrapper. To always use the latest engine without waiting for a camofox-browser release:
```
npm install -g camoufox-js   # or npx camoufox fetch
# and point the server at it:
$env:CAMOUFOX_EXECUTABLE = "path\to\camoufox-bin"
```

---

## 5. Troubleshooting (issues hit during setup)

### 5.1 `gyp ERR! find VS — Could not find any Visual Studio installation`

**Symptom:** `npm install` fails in `better-sqlite3` with `node-gyp rebuild` and "You need to install the latest version of Visual Studio".

**Cause:** better-sqlite3 v13 dropped prebuilt binaries — the C++ addon MUST be compiled. No compiler found.

**Fix:**
1. Install the C++ workload (Step 2 above) — minimum: MSVC x64/x86 tools + Windows 11 SDK
2. **Verify** with `vswhere ... -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64` — an empty result means the workload is NOT installed even if VS itself is present
3. Re-run `npm install`

### 5.2 VS shows installed but C++ still missing (partial install)

**Symptom:** `vswhere` finds VS, but `Test-Path ...\VC\Auxiliary\Build\vcvars64.bat` is `False` and there's no `VC\Tools\MSVC\<version>` folder.

**Cause:** the C++ workload was never added (VS default install has no compiler). During the actual install, the `VC\Tools\Llvm` folder appears first — MSVC arrives last, so a `True` check can wait until the installer has fully finished (`setup.exe` still running).

**Fix:** add `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` + `Microsoft.VisualStudio.Component.Windows11SDK.*` via `setup.exe modify`, wait for completion, re-verify.

### 5.3 `npm.ps1 cannot be loaded because running scripts is disabled`

**Symptom:** calling `npm` in PowerShell throws a SecurityError.

**Fix:** use the cmd shim:
```powershell
npm.cmd install
```

### 5.4 `'node' is not recognized` when node-gyp spawns a child process

**Symptom:** npm itself runs, but `node-gyp rebuild` fails with "node is not recognized" — even though `node --version` works.

**Cause:** the shell session PATH doesn't include the Node.js directory (typical right after installing Node; PATH refreshes only in new terminals).

**Fix:** add Node to the current session PATH, then retry:
```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm.cmd install
```

### 5.5 `EPERM: operation not permitted` during npm install cleanup

**Symptom:** warnings like `npm warn cleanup [Error: EPERM ... rmdir node_modules\ua-parser-js\dist]` after a failed install.

**Fix:** delete `node_modules` and reinstall cleanly:
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm.cmd install
```

### 5.6 `camofox-browser-mcp` command not found in opencode

**Cause:** the `camofox-browser-mcp` bin is only on PATH if you ran `npm link` (needs admin on `C:\Program Files\nodejs`) or installed globally.

**Fix (recommended):** don't rely on the bin — point opencode at the script directly (see Step 7):
```json
"command": ["node", "E:/Jatin-Project/Broker/BrainStrom/automation/camofox-browser-1.13.1/mcp/server.mjs"]
```

### 5.7 Server starts but `/health` fails / connection refused

**Fix:**
1. Confirm the process is alive: `Get-Process node`
2. Confirm the port: `netstat -ano | findstr 9377`
3. Check logs (if started with redirects): `server.log` / `server.err.log` in the camofox-browser dir
4. Browser killed on idle after 5 min with no sessions — first request relaunches it automatically (lazy launch)

### 5.8 `503 session_expired` / `tab create timed out`

**Cause:** the browser session died (common after a previous call destabilized it).

**Fix:** restart the server (`Ctrl+C`, `npm start`). Normal for a long-running agent session.

### 5.9 Cookie import returns 403

**Cause:** `CAMOFOX_API_KEY` not set on the REST server (cookie import is disabled by default).

**Fix:** start the server with the key set, then set the same key in the MCP adapter env:
```powershell
$env:CAMOFOX_API_KEY = "your-generated-key"   # openssl rand -hex 32
npm start
```

### 5.10 Missing `~/.cache/camoufox/version.json` (binary download issues)

**Fix:** force the browser download:
```powershell
npx camoufox fetch
```

### 5.11 Windows + long paths / `docker build` issues (Linux containers)

- Use `build.ps1 up` (included in the repo) instead of `make` on Windows
- PowerShell 5.1 works, but `pwsh` (7+) is recommended
- If `sh: not found` during docker build, the shell scripts have CRLF line endings — the repo's `.gitattributes` fixes this on clone; for zip extracts convert manually:
  ```powershell
  Get-ChildItem -Recurse *.sh | ForEach-Object { (Get-Content $_) -join "`n" + "`n" | Set-Content $_ -NoNewline }
  ```

---

## 6. Daily Usage Checklist

```powershell
# 1. start the REST server (after reboot)
cd "E:\Jatin-Project\Broker\BrainStrom\automation\camofox-browser-1.13.1"
$env:CAMOFOX_CRASH_REPORT_ENABLED = "false"
npm start

# 2. verify
Invoke-RestMethod "http://localhost:9377/health"

# 3. use from opencode (after restarting opencode)
#    camofox_create_tab → camofox_snapshot → camofox_click/type → camofox_evaluate
```

**Login + JSON extraction workflow:**
1. Log in once (or `camofox_import_cookies` with a cookies.txt file)
2. Session is auto-persisted to `~/.camofox/profiles/` — survives restarts
3. Ask the agent to extract data as JSON (`camofox_evaluate` / snapshot refs)
