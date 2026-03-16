# CodexPin Packaged Hook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the packaged CodexPin app self-sufficient so users can install the EXE, open it once, and have Codex hook setup happen automatically without manual CLI steps.

**Architecture:** The packaged `CodexPin.exe` will serve both as the desktop widget and as the Codex `notify` hook target. On normal launch it auto-registers itself into `~/.codex/config.toml`; on hook launch it runs a no-window handler that processes the JSON payload and exits immediately. The widget will also surface a best-effort “暂无 Codex 进程” state when no active Codex process is detected locally.

**Tech Stack:** Electron, Node.js, `@iarna/toml`, plain HTML/CSS/JS, Windows process inspection, Node assert tests

---

### Task 1: Hook command abstraction

**Files:**
- Modify: `scripts/codexpinConfig.js`
- Modify: `tests/notify-setup.test.js`
- Modify: `tests/codexpin-cli.test.js`

**Step 1: Write the failing test**

Add tests for:

- detecting whether a target hook command is already configured
- building the packaged hook command as `[CodexPin.exe, "--codex-hook"]`
- preserving current CLI-based setup tests for source workflow

**Step 2: Run test to verify it fails**

Run: `node tests/notify-setup.test.js`
Run: `node tests/codexpin-cli.test.js`

Expected: FAIL because packaged command helpers do not exist yet.

**Step 3: Write minimal implementation**

Add reusable helpers for:

- `isNotifyHookConfigured`
- `buildPackagedHookCommand`
- exact command comparison for config setup/uninstall

**Step 4: Run test to verify it passes**

Run: `node tests/notify-setup.test.js`
Run: `node tests/codexpin-cli.test.js`

Expected: PASS

### Task 2: Hook runtime mode

**Files:**
- Create: `electron/runtimeMode.js`
- Create: `electron/hookRuntime.js`
- Modify: `scripts/codexpin-codex-hook.js`
- Create: `tests/runtime-mode.test.js`

**Step 1: Write the failing test**

Add tests for:

- detecting `--codex-hook` mode from argv
- extracting the raw JSON payload argument
- processing hook payload without launching a window

**Step 2: Run test to verify it fails**

Run: `node tests/runtime-mode.test.js`

Expected: FAIL because runtime-mode modules do not exist yet.

**Step 3: Write minimal implementation**

Extract shared hook logic into a reusable function so both:

- `scripts/codexpin-codex-hook.js`
- packaged Electron startup

can use the same implementation.

**Step 4: Run test to verify it passes**

Run: `node tests/runtime-mode.test.js`

Expected: PASS

### Task 3: First-launch auto setup

**Files:**
- Create: `electron/installBootstrap.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`
- Modify: `tests/install-bootstrap.test.js`

**Step 1: Write the failing test**

Add tests for:

- packaged launch auto-configuring the hook when missing
- already-configured launch staying idempotent
- returning a structured failure state when setup fails

**Step 2: Run test to verify it fails**

Run: `node tests/install-bootstrap.test.js`

Expected: FAIL because bootstrap wiring does not exist yet.

**Step 3: Write minimal implementation**

On normal app launch:

- build the correct packaged/dev hook command
- detect current config state
- auto-run setup if needed
- store install state for renderer access

**Step 4: Run test to verify it passes**

Run: `node tests/install-bootstrap.test.js`

Expected: PASS

### Task 4: Codex process detection and status semantics

**Files:**
- Create: `electron/codexProcessState.js`
- Modify: `electron/codexpinStatus.js`
- Modify: `tests/codexpin-status.test.js`
- Create: `tests/codex-process-state.test.js`

**Step 1: Write the failing test**

Add tests for:

- hook installed but no session file => idle/waiting state instead of not-connected
- no active session and no Codex process => phase shows `暂无 Codex 进程`
- parser can detect Codex activity from Windows process snapshots / command lines

**Step 2: Run test to verify it fails**

Run: `node tests/codex-process-state.test.js`
Run: `node tests/codexpin-status.test.js`

Expected: FAIL before process-state logic is added.

**Step 3: Write minimal implementation**

Create a best-effort process detector that looks for Codex-related processes and feed that into session status selection.

**Step 4: Run test to verify it passes**

Run: `node tests/codex-process-state.test.js`
Run: `node tests/codexpin-status.test.js`

Expected: PASS

### Task 5: Renderer onboarding and messaging

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/style.css`
- Modify: `renderer/renderer.js`

**Step 1: Write the failing test**

If logic is extracted, add a small renderer mapping test. Otherwise let new status/bootstrap tests define the expected states first.

**Step 2: Run test to verify it fails**

Run the targeted test file if added.

**Step 3: Write minimal implementation**

Render:

- setup failure messaging with retry
- ready but no active Codex process => `暂无 Codex 进程`
- ready and waiting => `待命中`

Keep the existing widget compactness and quota layout intact.

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS

### Task 6: Packaging and docs

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Update packaging metadata**

Ensure the packaged app includes the files needed for runtime hook mode and has clear product naming.

**Step 2: Update docs**

Document:

- ordinary user flow: install EXE, open app, auto-detect/setup
- developer flow: source usage remains available
- uninstall / retry behavior

**Step 3: Verify**

Run: `npm test`
Run: `npm run build`

Expected: PASS

### Task 7: Commit

**Files:**
- Modify: all touched feature files except user-owned workspace files

**Step 1: Review**

Run: `git diff --stat`

**Step 2: Commit**

```bash
git add README.md package.json electron/main.js electron/preload.js electron/installBootstrap.js electron/runtimeMode.js electron/hookRuntime.js electron/codexProcessState.js electron/codexpinStatus.js renderer/index.html renderer/style.css renderer/renderer.js scripts/codexpinConfig.js scripts/codexpin-codex-hook.js tests/notify-setup.test.js tests/codexpin-cli.test.js tests/install-bootstrap.test.js tests/runtime-mode.test.js tests/codex-process-state.test.js tests/codexpin-status.test.js docs/plans/2026-03-16-packaged-hook-plan.md
git commit -m "feat: auto-configure packaged hook on launch"
```
