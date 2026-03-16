# Bilingual README Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the repository documentation so the default README is an up-to-date English product page, with a separate Simplified Chinese companion file.

**Architecture:** Keep `README.md` as the GitHub-default English entry point and add `README.zh-CN.md` as a mirrored Chinese document. Reuse the existing hero image and badge-first layout, then rewrite the content to match the current shipped behavior: packaged auto-hook setup, live local rollout parsing, rate-limit display, idle/working states, and local-only architecture.

**Tech Stack:** Markdown, GitHub-flavored HTML, existing repo assets

---

### Task 1: Refresh the English README

**Files:**
- Modify: `D:\Github\CodexPin\README.md`

**Step 1:** Add a language switch near the top and keep English as the default view.

**Step 2:** Rewrite the sections to reflect the current product:
- overview,
- what the widget shows,
- installation and first launch,
- local architecture,
- development commands,
- project docs.

**Step 3:** Remove outdated wording that still reads like an implementation plan.

### Task 2: Add the Simplified Chinese companion README

**Files:**
- Create: `D:\Github\CodexPin\README.zh-CN.md`

**Step 1:** Mirror the English structure in Simplified Chinese.

**Step 2:** Add the same hero, badges, and language switch, but point back to the English README as the default.

**Step 3:** Keep terminology consistent with the shipped UI labels such as `未接入`, `待命中`, `工作中`, and `暂无 Codex 进程`.

### Task 3: Verify both docs

**Files:**
- Verify: `D:\Github\CodexPin\README.md`
- Verify: `D:\Github\CodexPin\README.zh-CN.md`

**Step 1:** Confirm both files reference valid relative paths.

**Step 2:** Re-read both versions and ensure the stated behavior matches the current app implementation.
