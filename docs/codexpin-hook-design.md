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

