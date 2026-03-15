# CodexPin Codex State Schema

CodexPin maintains its own view of Codex sessions and turns under a dedicated
directory in the user’s home folder:

```text
~/.codexpin/codex-status/
  status.json
  sessions/
    <sessionId>.json
```

This schema is intentionally simple and forward‑compatible.

## 1. status.json

`status.json` is a summary index of recent Codex sessions.

```jsonc
{
  "version": 1,
  "lastUpdated": 1773595334758, // ms since epoch
  "sessions": {
    "<sessionId>": {
      "sessionId": "<sessionId>",
      "workingDirectory": "D:\\Github\\CodexPin",
      "startedAt": 1773589758091,  // ms since epoch
      "endedAt": 1773595334757,    // optional, ms since epoch
      "status": "completed",       // "active" | "completed" | "error"

      "lastEvent": {
        "type": "turn_complete",
        "timestamp": 1773595334757, // ms since epoch

        "phase": "已把 Codex 状态段落和小图标实装进 CodexPin",
        "details": [
          "现在每一轮只显示当前 turn 的精华段落",
          "阶段（深色）+ 1~2 行细节（浅色）+ 动态小圆点"
        ],

        "rawMessagePreview": "完整助手回复的前 400 字符...",

        "turnId": "019cf283-b513-7cf2-a9ba-7a5f0bf6d3a6"
      }
    }
  }
}
```

Notes:

- `version` is reserved for future schema evolution.
- `lastUpdated` reflects the last time CodexPin hook successfully wrote to
  this file.
- `sessions` is a map keyed by Codex `thread-id` (`sessionId`).
- Each session object is a compact view; more detail can live in the
  per‑session file.

### 1.1 Locating the “current” session for a project

Given a project path such as `D:\Github\CodexPin`, CodexPin’s widget will:

1. Normalize the path in a case‑insensitive way (for Windows).
2. Filter `sessions` entries where `workingDirectory` matches the project
   path (or an equivalent path with `\\?\` prefix).
3. Among those, pick the entry with the largest `lastEvent.timestamp`.

This entry is treated as “the most recent Codex turn” for that project, and
its `lastEvent.phase` + `lastEvent.details[]` are used to populate the
widget’s status lines.

## 2. sessions/<sessionId>.json

Each session gets its own file for richer history. Schema is intentionally
flexible; CodexPin only depends on a small subset.

```jsonc
{
  "sessionId": "<sessionId>",
  "workingDirectory": "D:\\Github\\CodexPin",

  "startedAt": 1773589758091,
  "endedAt": 1773595334757,
  "status": "completed",

  "title": "实现 CodexPin 小部件的 Codex hook 管道",

  "turns": [
    {
      "turnId": "1",
      "timestamp": 1773589758091,
      "phase": "读取项目结构并理解现有 Electron 实现",
      "details": [
        "确保当前 Electron 小部件能独立运行",
        "识别已有 codexSession 逻辑和 UI 绑定"
      ],
      "rawMessagePreview": "第一轮助手回复的前 400 字符..."
    },
    {
      "turnId": "2",
      "timestamp": 1773595334757,
      "phase": "实装 Codex 状态段落与小图标展示",
      "details": [
        "从真实 Codex session 日志中抽取当前段落",
        "只显示一段：阶段 + 1–2 行细节"
      ],
      "rawMessagePreview": "第二轮助手回复的前 400 字符..."
    }
  ]
}
```

CodexPin’s widget primarily uses:

- `workingDirectory` to match the current project,
- latest `turns[*]` to infer the most recent phase/details if needed,
- `startedAt` / `endedAt` for potential future metrics.

## 3. Atomic Writes & Retention

- All writes must be **atomic**:
  - write JSON to `*.tmp.<pid>`,
  - `rename` to the final path.
- Old sessions:
  - Hook implementations should remove sessions older than 24h from both:
    - `status.sessions` map, and
    - `sessions/<sessionId>.json` files.

This keeps CodexPin’s state bounded in size while preserving enough history
for the widget and future tools.

