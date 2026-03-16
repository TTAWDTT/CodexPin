# CodexPin Codex Hook Integration Design

## 1. Goals

CodexPin integrates with OpenAI Codex using only official, documented mechanisms. The primary integration point is the Codex `notify` hook, which allows Codex to invoke a local command with JSON payloads describing notable events.

Requirements:
- No dependency on Confirmo or any third-party tooling.
- Work across Codex CLI / IDE / desktop as long as they share the same `~/.codex` state.
- Never rely on internal or undocumented OpenAI APIs.
- Never break or silently discard an existing `notify` chain; CodexPin must be a good citizen.

## 2. Codex `notify` Integration Surface

### 2.1 Trigger and Payload

Codex supports a `notify` configuration in `~/.codex/config.toml`. When configured, on certain events Codex runs:

```text
<notify[0]> <notify[1]> '<JSON payload>'
```

For the Codex CLI, the primary event of interest is:
- `type: "agent-turn-complete"` – emitted when an interactive turn finishes (user input + Codex reasoning + tool calls + assistant reply).

The JSON payload for this event includes (based on current behavior and Confirmo’s reference implementation):
- `"type"` – string, e.g. `"agent-turn-complete"`.
- `"thread-id"` – Codex session/thread identifier.
- `"turn-id"` – current turn identifier within the thread.
- `"cwd"` – current working directory of the Codex session.
- `"input-messages"` – array of messages describing the user input for this turn.
- `"last-assistant-message"` – final assistant reply content for this turn (string or structured content).

CodexPin will treat this payload as the **only source of truth** for what a “turn” is. We do not parse internal HTTP calls or proprietary protocols.

### 2.2 Supported Scenarios

CodexPin assumes:
- Codex CLI, IDE, and desktop apps ultimately write to a common `~/.codex` home directory on the same OS user.
- `notify` is configured at the user level in `~/.codex/config.toml`.

As long as `notify` is respected by the running Codex instance, CodexPin will receive events, irrespective of whether the user interacts via:
- terminal sessions,
- IDE extensions,
- desktop Codex app (if it uses the same CLI/home under the hood).

## 3. CodexPin’s Contract with `notify`

### 3.1 What CodexPin Will Do

When Codex invokes CodexPin’s hook via `notify`:

1. Read the first command-line argument as a JSON string.
2. Parse it, and if `type !== "agent-turn-complete"`, exit immediately with `0`.
3. For `agent-turn-complete`, extract:
   - `sessionId` from `"thread-id"`.
   - `turnId` from `"turn-id"`.
   - `workingDirectory` from `"cwd"`.
   - `inputMessages` from `"input-messages"`.
   - `lastAssistantMessage` from `"last-assistant-message"`.
4. Derive a structured summary (phase + details) from `lastAssistantMessage`.
5. Persist this data into CodexPin’s own state files under `~/.codexpin/codex-status/`.
6. Optionally forward the same JSON to any previously configured `notify` command (to preserve existing chains).

At no point will CodexPin:
- Call undocumented OpenAI endpoints.
- Inspect or mutate internal Codex sqlite databases.
- Block or modify Codex’s internal behavior.

### 3.2 Example Payload and Resulting State

Given a concrete `agent-turn-complete` payload:

```jsonc
{
  "type": "agent-turn-complete",
  "thread-id": "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a6",
  "turn-id": "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a7",
  "cwd": "D:\\\\Github\\\\CodexPin",
  "input-messages": [
    {
      "role": "user",
      "content": "请帮我实装 CodexPin 的 Codex hook 状态展示"
    }
  ],
  "last-assistant-message": "已完成 CodexPin hook 实装\\n1. 解析 agent-turn-complete 事件\\n2. 写入 ~/.codexpin/codex-status/status.json"
}
```

CodexPin hook will:

1. Treat `"thread-id"` as `sessionId` and `"turn-id"` as `turnId`.
2. Run its text segmentation logic on `last-assistant-message`, producing:
   - `phase`: `"已完成 CodexPin hook 实装"`
   - `details`: `["解析 agent-turn-complete 事件", "写入 ~/.codexpin/codex-status/status.json"]`
   - `rawMessagePreview`: first 400 characters of the full assistant message.
3. Update `~/.codexpin/codex-status/status.json`:

```jsonc
{
  "version": 1,
  "lastUpdated": 1773595334757,
  "sessions": {
    "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a6": {
      "sessionId": "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a6",
      "workingDirectory": "D:\\\\Github\\\\CodexPin",
      "startedAt": 1773595300000,
      "endedAt": null,
      "status": "active",
      "lastEvent": {
        "type": "turn_complete",
        "timestamp": 1773595334757,
        "phase": "已完成 CodexPin hook 实装",
        "details": [
          "解析 agent-turn-complete 事件",
          "写入 ~/.codexpin/codex-status/status.json"
        ],
        "rawMessagePreview": "已完成 CodexPin hook 实装\\n1. 解析 agent-turn-complete 事件\\n2. 写入 ~/.codexpin/codex-status/status.json",
        "turnId": "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a7"
      }
    }
  }
}
```

4. Append a turn record to `~/.codexpin/codex-status/sessions/019cf283-b513-7cf2-a9ba-7a5f0bf6d3a6.json`:

```jsonc
{
  "sessionId": "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a6",
  "workingDirectory": "D:\\\\Github\\\\CodexPin",
  "startedAt": 1773595300000,
  "endedAt": null,
  "status": "active",
  "title": "请帮我实装 CodexPin 的 Codex hook 状态展示",
  "turns": [
    {
      "turnId": "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a7",
      "timestamp": 1773595334757,
      "phase": "已完成 CodexPin hook 实装",
      "details": [
        "解析 agent-turn-complete 事件",
        "写入 ~/.codexpin/codex-status/status.json"
      ],
      "rawMessagePreview": "已完成 CodexPin hook 实装\\n1. 解析 agent-turn-complete 事件\\n2. 写入 ~/.codexpin/codex-status/status.json"
    }
  ]
}
```

All writes are atomic (temporary file + rename), and older sessions (older than 24h) may be pruned from both `status.json` and the `sessions/` directory as described in the state schema.

### 3.2 What CodexPin Will Not Do

- Will not overwrite `~/.codex` data stores.
- Will not silently drop or break an existing `notify` chain:
  - If an existing `notify` is present, CodexPin will adopt a chain/forward pattern, not a destructive override.
- Will not treat `.confirmo` or any other third-party directory as required input.

## 4. Notify Configuration Strategy

### 4.1 Existing `notify` State

CodexPin must handle three cases when the user runs `codexpin setup`:

1. **No existing `notify`** in `config.toml`  
   - CodexPin sets `notify` to its own hook, e.g.:
     ```toml
     notify = [
       "bun",
       "C:/Users/<user>/.codexpin/hooks/codexpin-codex-hook.js"
     ]
     ```

2. **Existing `notify` list containing other tools**  
   - CodexPin reads the current `notify` array and saves it in its own backup file (e.g. `~/.codexpin/original-notify.json`).
   - CodexPin replaces `notify` in `config.toml` with a **chain hook**:
     - First element: CodexPin hook (the new primary).
     - CodexPin hook script, after updating its state, forwards the JSON to the original `notify` command saved in `original-notify.json`.

3. **CodexPin hook already present in `notify`**  
   - `codexpin setup` is a no-op regarding `notify` (must be idempotent).

In practice, `codexpin setup` is implemented as a small CLI that:

- Locates `~/.codex/config.toml`.
- Parses it via a TOML parser.
- Reads the current `notify` array (if any).
- If the current `notify` is already exactly the CodexPin hook command, it does nothing.
- Otherwise:
  - Saves the current `notify` array to `~/.codexpin/original-notify.json` (if it exists).
  - Sets `notify` to the CodexPin hook command only, letting the hook script forward events to the original command.

### 4.2 Rollback / Uninstall

CodexPin must define how to revert `notify`:
- If `~/.codexpin/original-notify.json` exists and contains a prior `notify` array:
  - Restore that array back to `config.toml`.
- If no backup exists:
  - Remove CodexPin hook entries from `notify` (if any).
  - If `notify` becomes empty, optionally remove it or leave as empty array.

This ensures users are never “locked” into CodexPin; removing it should be safe and predictable.

## 5. Boundaries & Non-Goals

- CodexPin **does not** promise to reproduce server-side Codex quota metrics (5-hour / weekly percentages). Those are not exposed via `notify` and are beyond the scope of this integration.
- CodexPin **only** uses `notify` to mirror:
  - turn boundaries,
  - text content of turns,
  - working directory context.
- Any additional Codex telemetry (usage, billing, internals) must come from officially documented APIs, which are out of scope for this hook integration.

## 6. Summary

The CodexPin hook integration is intentionally narrow:
- Input: Codex `notify` JSON (`agent-turn-complete` events).
- Output: CodexPin’s own state files in `~/.codexpin/codex-status/`.
- Contract: Never break Codex, never override other tools without a reversible plan, and never rely on private OpenAI APIs.

This design gives CodexPin enough signal to:
- Show “current turn” summaries in the Electron widget,
- Highlight whether Codex is “working” or “idle”,
- Do so purely based on local data and officially exposed hooks.

## 7. Text Segmentation Rules

CodexPin does not show the full assistant reply. Instead, it derives a compact
widget-friendly segment:

1. Split `last-assistant-message` by newline.
2. Trim whitespace and drop empty lines.
3. Normalize each line by removing common Markdown wrappers/prefixes:
   - headings like `## Title`
   - bullets like `- item`
   - numbered lists like `1. item`
   - blockquotes like `> note`
   - full-line emphasis like `**Title**`
4. Use the first normalized line as `phase`.
5. Use the next 1–2 normalized lines as `details[]`.
6. Clamp each detail line to roughly 80 characters so the widget stays readable.
7. Preserve the first 400 characters of the raw assistant message as
   `rawMessagePreview`.

### Example A: Long Summary

Input:

```text
## 实装 CodexPin hook
完成了 notify 事件的本地解析与状态落盘。
面板现在可以从专用状态文件读取最近一轮阶段信息。
```

Output:

```json
{
  "phase": "实装 CodexPin hook",
  "details": [
    "完成了 notify 事件的本地解析与状态落盘。",
    "面板现在可以从专用状态文件读取最近一轮阶段信息。"
  ]
}
```

### Example B: Markdown List

Input:

```text
**接入 Electron 状态桥接**
- 新增 codexpin-get-session-status IPC
- 渲染层轮询 status.json 并映射为小面板
```

Output:

```json
{
  "phase": "接入 Electron 状态桥接",
  "details": [
    "新增 codexpin-get-session-status IPC",
    "渲染层轮询 status.json 并映射为小面板"
  ]
}
```

### Example C: One-Line Reply

Input:

```text
已经完成本地 hook 配置修复
```

Output:

```json
{
  "phase": "已经完成本地 hook 配置修复",
  "details": []
}
```

## 8. Electron Data Flow

CodexPin’s Electron widget reads only CodexPin-owned state. The intended flow is:

1. Codex completes a turn.
2. Codex invokes the configured `notify` command with the event JSON.
3. `codexpin-codex-hook.js` parses the payload and writes
   `~/.codexpin/codex-status/status.json`.
4. Electron main process exposes `codexpin-get-session-status` IPC.
5. That IPC reads `status.json`, filters sessions by the current project
   directory, and returns:
   - `hasSession`
   - `isActive`
   - `elapsedSeconds`
   - `statusText`
   - `phase`
   - `details[]`
6. Renderer polls this IPC every 1–2 seconds and maps the result to:
   - top-left: elapsed session time
   - top-right: `工作中` / `待命中` / `未接入`
   - center: `phase` + 1–2 `details`

This keeps the widget fully decoupled from `.codex` internals.

## 9. Behavior Without Hook Data

CodexPin no longer treats `.codex` logs as a fallback rendering source.

Behavior is intentionally explicit:

- **No `~/.codexpin/codex-status/status.json`**
  - Widget shows `未接入`
  - Main phase shows `未接入 Codex Hook`
  - Detail explains that the user should run `codexpin setup`

- **`status.json` exists, but current project has no matching session**
  - Widget shows `待命中`
  - Main phase shows `待命中`
  - Detail explains that the current project has not yet received a Codex hook event

- **Current project has matching session data**
  - Widget shows the latest `phase` + `details[]`
  - Pulse animation is enabled only when the latest event is considered active

This avoids mixing two incompatible data models:
- `.codex` log inference
- CodexPin hook-derived widget state
