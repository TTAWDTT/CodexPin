# CodexPin Electron Widget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready Electron desktop widget that shows Codex work session time, weekly 5h budget usage/remaining, and 3–4 lines of status text in an always-on-top, glassmorphism-style panel using the CodexPin design.

**Architecture:** Use a classic Electron structure with a Node-powered main process (window + lifecycle), a secure preload bridge (limited IPC APIs for state and persistence), and a renderer running a lightweight HTML/CSS/JS UI. Business logic for sessions and weekly budget lives in the renderer layer with persistence calls abstracted behind the preload bridge.

**Tech Stack:** Electron (main + preload + renderer), Node.js, plain HTML/CSS/vanilla JS (no framework), JSON file persistence via Node `fs`, custom font (霞鹜文楷) and glassmorphism styling.

---

## Task 1: Initialize Electron Project Skeleton

**Files:**
- Create: `package.json`
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Create: `renderer/index.html`
- Create: `renderer/style.css`
- Create: `renderer/renderer.js`

**Step 1: Initialize npm project**

Run:
```bash
npm init -y
```
Expected:
- A `package.json` file is created at the repo root with default fields.

**Step 2: Install Electron as dev dependency**

Run:
```bash
npm install --save-dev electron
```
Expected:
- `node_modules` is created.
- `package.json` has `electron` under `devDependencies`.

**Step 3: Add basic Electron start script**

Modify `package.json`:
- Add a script:

```json
"scripts": {
  "start": "electron ."
}
```

Expected:
- Running `npm run start` should attempt to start Electron (will fail until `electron/main.js` exists).

**Step 4: Create main process entry file**

Create `electron/main.js` with minimal boilerplate (no complex logic yet), including:
- `app` and `BrowserWindow` imports from `electron`
- `createWindow` function that will later load `renderer/index.html`
- `app.whenReady().then(createWindow)` call
- Standard listeners for `window-all-closed` and `activate`

**Step 5: Configure Electron entry in package.json**

Modify `package.json`:
- Add `"main": "electron/main.js"` at the top level.

Expected:
- Electron knows to use `electron/main.js` as the main process entry.

**Step 6: Create preload script placeholder**

Create `electron/preload.js` with just:
- Basic `contextBridge` import from `electron`
- An empty `contextBridge.exposeInMainWorld('codexpin', { })` which will be filled later

**Step 7: Create renderer HTML and asset placeholders**

Create `renderer/index.html` containing:
- Basic HTML5 skeleton
- A root container for the widget panel
- References to `style.css` and `renderer.js`

Create `renderer/style.css` and `renderer/renderer.js` as empty files for now.

**Step 8: Wire preload in BrowserWindow**

Update `electron/main.js`:
- Configure `webPreferences.preload` to point to the absolute path of `electron/preload.js` using `path.join(__dirname, 'preload.js')`.

**Step 9: Smoke test the bare Electron app**

Run:
```bash
npm run start
```
Expected:
- An Electron window opens, loads `renderer/index.html`, and shows basic content (even if only static text).

---

## Task 2: Implement Always-On-Top Widget Window Behavior

**Files:**
- Modify: `electron/main.js`
- Modify: `renderer/index.html`
- Modify: `renderer/style.css`

**Step 1: Configure BrowserWindow for widget use**

Update `electron/main.js` to:
- Create a small, fixed-size window (e.g., width ~340–380, height ~200–260).
- Set `alwaysOnTop: true`.
- Enable `frame: false` for a frameless look.
- Enable `transparent: true` if supported by the OS to allow glassmorphism (we’ll layer a semi-transparent background in CSS).

**Step 2: Disable default menu and dev tools in production**

Update `electron/main.js`:
- Remove default menu using `Menu.setApplicationMenu(null)` (or equivalent).
- Keep `BrowserWindow.webContents.openDevTools()` disabled by default (can be toggled via environment flag later).

**Step 3: Add basic draggable region**

Update `renderer/index.html` and `renderer/style.css`:
- Add a top-level container for the widget, e.g., `<div id="widget-root">`.
- Add a top bar container inside it, e.g., `<div class="widget-topbar">`.
- Set CSS `-webkit-app-region: drag` on the top bar to allow dragging the frameless window.
- Ensure interactive elements (buttons, etc.) later use `-webkit-app-region: no-drag`.

**Step 4: Verify window behavior**

Run:
```bash
npm run start
```
Expected:
- The window appears without a standard OS frame.
- The window stays on top of other windows.
- Dragging the top bar moves the window around.

---

## Task 3: Design Renderer UI Layout for CodexPin

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/style.css`

**Step 1: Define HTML structure for the widget**

Update `renderer/index.html`:
- Inside `#widget-root`, create:
  - A top bar, e.g., `<div class="widget-topbar">`
    - Left span: `<span id="session-time"></span>`
    - Right span: `<span id="weekly-remaining"></span>`
  - A status text area, e.g., `<div class="widget-status">`
    - 3–4 lines, e.g., `<div id="status-line-1"></div>` ... `<div id="status-line-4"></div>`

**Step 2: Apply glassmorphism base styles**

Update `renderer/style.css`:
- Style `body` and `#widget-root`:
  - Set full window background to transparent.
  - For `#widget-root`, use:
    - `background: rgba(0, 0, 0, 0.6);`
    - `backdrop-filter: blur(16px);`
    - `border-radius: 16px;`
    - `box-shadow` for subtle elevation.
- Use flexbox/column layout to separate top bar and status area.

**Step 3: Integrate 霞鹜文楷字体**

Add font file later to `assets/fonts/LXGWWenKai-Regular.ttf` (placeholder for now).

In `renderer/style.css`:
- Add `@font-face` pointing to `../assets/fonts/LXGWWenKai-Regular.ttf`.
- Set `font-family: "LXGW WenKai", -apple-system, system-ui, sans-serif;` on `body` or `#widget-root`.

**Step 4: Define typography and color hierarchy**

- Top bar (`#session-time`, `#weekly-remaining`):
  - Slightly larger font size, near-white color.
- Status lines:
  - Smaller font size, light gray color.
  - Appropriate `line-height` and spacing.

**Step 5: Visual smoke test**

Run:
```bash
npm run start
```
Expected:
- Widget shows a glassy dark panel with a top bar and 3–4 status lines.
- Fonts and spacing look reasonably close to the design (exact font will be refined once the file is added).

---

## Task 4: Implement Session & Weekly Budget State Logic (Renderer)

**Files:**
- Modify: `renderer/renderer.js`
- Create: `renderer/state.js`

**Step 1: Implement a simple in-memory state module**

Create `renderer/state.js` that exports:
- In-memory state object containing:
  - `currentSession` with `status`, `startTime`, `elapsedSeconds`, `phase`, etc.
  - `weeklyBudget` with `weekStartDate`, `weeklyLimitMinutes`, `weeklyUsedMinutes`.
  - `statusLines` array (max length 4).
- Functions:
  - `startSession(title)` / `stopSession()`
  - `setIdle(isIdle)`
  - `setPhase(phase)`
  - `appendStatusLine(line)`
  - `getState()`
  - Internal helper to enforce `statusLines` max length.

**Step 2: Implement weekly budget calculations**

In `renderer/state.js`:
- Add helpers to:
  - Determine current week’s start date (e.g., Monday).
  - Reset weekly budget when the stored `weekStartDate` is not in the current week.
- On `stopSession()`:
  - Calculate session duration in minutes.
  - Add to `weeklyUsedMinutes`.

**Step 3: Connect state module to DOM rendering**

Update `renderer/renderer.js`:
- Import state module.
- Implement `render()` function that:
  - Reads current state via `getState()`.
  - Updates `#session-time`, `#weekly-remaining`, and the 4 status line elements.
- Implement `formatTime` helpers:
  - Format session elapsed time as `MM:SS` or `H:MM`.
  - Format weekly remaining minutes as `XhYm`.

**Step 4: Add timer loop for active sessions**

In `renderer/renderer.js`:
- Use `setInterval` (e.g., every 1s) to:
  - If session is `active`, compute `elapsedSeconds` (`now - startTime`) and update state.
  - Call `render()` after each update.

**Step 5: Seed initial dummy data for visual testing**

Temporarily, on load:
- Call `startSession("Dummy Session")`.
- Append a few dummy status lines via `appendStatusLine`.
- Render and confirm time ticking works.

**Step 6: Manual verification**

Run:
```bash
npm run start
```
Expected:
- Session time increments every second when active.
- Weekly remaining changes after calling `stopSession()` (can be simulated for now).
- Status lines display in order, with older ones dropping when more than 4 are added.

---

## Task 5: Implement JSON Persistence via Preload Bridge

**Files:**
- Modify: `electron/preload.js`
- Modify: `electron/main.js`
- Create: `electron/storage.js`
- Modify: `renderer/renderer.js`
- Modify: `renderer/state.js`

**Step 1: Implement Node-side storage helper**

Create `electron/storage.js`:
- Use `fs` and `path` to:
  - Determine a config directory (e.g., under `app.getPath('userData')` — passed in from `main.js`).
  - Define a JSON file path like `codexpin-state.json`.
- Export functions:
  - `loadState(): Promise<object | null>`
  - `saveState(state: object): Promise<void>`

**Step 2: Wire storage into main process**

Update `electron/main.js`:
- Import `storage.js`.
- On app ready, ensure the storage path is initialized.
- Provide an IPC handler pair:
  - `ipcMain.handle('codexpin-load-state', ...)`
  - `ipcMain.handle('codexpin-save-state', ...)`

**Step 3: Expose limited APIs via preload**

Update `electron/preload.js`:
- Import `ipcRenderer` and `contextBridge`.
- Expose `window.codexpin` with:
  - `loadState: () => ipcRenderer.invoke('codexpin-load-state')`
  - `saveState: (state) => ipcRenderer.invoke('codexpin-save-state', state)`

**Step 4: Integrate persistence into renderer state**

Update `renderer/state.js`:
- Add:
  - `setInitialState(loadedState)` to hydrate in-memory state from persisted JSON, including weekly budget and last session summary (if any).
  - `getSerializableState()` to return a plain object for saving.

Update `renderer/renderer.js`:
- On startup:
  - Call `window.codexpin.loadState()`.
  - If data exists, call `setInitialState(...)`.
  - Then call `render()` once.
- On key state changes (`stopSession`, weekly updates, status changes):
  - Call `window.codexpin.saveState(getSerializableState())` (with throttling or debouncing if needed later).

**Step 5: Manual persistence test**

Run:
```bash
npm run start
```
Steps:
- Start a dummy session, let it run a bit, stop it.
- Close the app.
- Reopen the app.

Expected:
- Weekly used and remaining minutes should reflect previous runs.
- Any persisted configuration (e.g., week start) should be restored.

---

## Task 6: Add Window Position Persistence and Modes

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/storage.js`
- Modify: `renderer/renderer.js`

**Step 1: Track window position in main process**

Update `electron/main.js`:
- After creating `BrowserWindow`, listen to `move`/`resize`/`close` events.
- Capture the window bounds (`getBounds()`).

**Step 2: Store position in JSON state**

Update `electron/storage.js`:
- Extend the stored state structure to include:
  - `windowBounds` with `x`, `y`, `width`, `height`.
- When saving state from renderer, include `windowBounds` from main process (or use a dedicated save call).

**Step 3: Restore window position on startup**

Update `electron/main.js`:
- Before creating the window, load stored state via storage helper.
- If `windowBounds` is available, pass these to `BrowserWindow` constructor.
- Fallback to default size/position if not available.

**Step 4: Implement full vs compact mode**

Renderer:
- Add a mode flag to state: `mode: "full" | "compact"`.
- In `renderer/renderer.js`, add a double-click handler on the top bar:
  - Toggle mode between `"full"` and `"compact"`.
- In `renderer/style.css`, define:
  - Full mode: shows full status area.
  - Compact mode: hides status lines, shows only top bar.

Persistence:
- Include `mode` in the serialized state and restore it on startup.

**Step 5: Manual verification**

Run:
```bash
npm run start
```
Expected:
- Window reopens at last position after close/reopen.
- Double-click on top bar switches between full and compact modes and persists across restarts.

---

## Task 7: Polish Visual Design and Behavior

**Files:**
- Modify: `renderer/style.css`
- Modify: `renderer/renderer.js`

**Step 1: Fine-tune glassmorphism and typography**

Update `renderer/style.css`:
- Adjust blur radius, background opacity, and box-shadow for a refined glass look.
- Ensure font sizes and weights match the intended hierarchy (top bar > status lines).

**Step 2: Add low-budget visual cue**

Renderer logic:
- In `render()`, compute remaining minutes vs total weekly limit.
- If remaining < 60 (minutes), add a `low-budget` CSS class to the top bar.

CSS:
- Define `.low-budget` styles:
  - Slightly warmer accent color for remaining time text.
  - Optional subtle glow/underline.

**Step 3: Ensure idle state reads clearly**

Renderer display logic:
- When session is idle:
  - Show `0` / `待命` in the left time area.
  - Optionally adjust text color or style to convey "not counting time".

**Step 4: Final manual QA pass**

Verify:
- Session timing, weekly budget calculations, and persistence all function correctly.
- Widget window feels smooth to drag and does not flicker.
- Glassmorphism looks acceptable on your primary OS.

---

## Task 8: Developer Experience & Packaging (Optional Next Step)

**Files:**
- Modify: `package.json`
- Create: packaging config (if using `electron-builder` or similar later)

**Step 1: Add linting/formatting scripts (optional)**

- Add ESLint/Prettier as needed and scripts to `package.json`.

**Step 2: Add basic build/package pipeline**

- Choose an Electron packaging tool (e.g., `electron-builder`).
- Add configuration and scripts:
  - `"build"` to package the app for local OS.

**Step 3: Confirm packaged app behaves like dev version**

- Run packaging command.
- Install/run the packaged app.

Expected:
- Widget behaves the same as in `npm run start`, including persistence and always-on-top behavior.

