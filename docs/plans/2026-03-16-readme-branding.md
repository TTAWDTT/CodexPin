# README Branding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a branded README hero with the CodexPin logo, richer badges, and a WenKai-styled title treatment that works on GitHub.

**Architecture:** Keep the README itself GitHub-native and use a generated banner image for the WenKai typography, because GitHub README pages cannot enforce a global custom font. Store the generated asset inside the repo so the README renders consistently for every visitor.

**Tech Stack:** Markdown, GitHub-flavored HTML, PowerShell, System.Drawing, LXGW WenKai font asset

---

### Task 1: Create a reproducible README hero generator

**Files:**
- Create: `D:\Github\CodexPin\scripts\generate-readme-hero.ps1`
- Create: `D:\Github\CodexPin\assets\readme\codexpin-hero.png`

**Step 1:** Write the PowerShell generator that loads the logo PNG and LXGW WenKai font.

**Step 2:** Render a banner image with:
- a dark rounded background,
- the CodexPin logo,
- `CodexPin` title in WenKai,
- a short product subtitle.

**Step 3:** Run the generator and confirm the output image is created.

### Task 2: Productize the README hero section

**Files:**
- Modify: `D:\Github\CodexPin\README.md`

**Step 1:** Replace the plain top section with a centered hero image.

**Step 2:** Add a centered badge row covering:
- Electron
- Windows
- Codex Hook
- Always On Top
- Auto Setup
- Local First
- Streaming Status
- ISC License

**Step 3:** Tighten the opening copy so the value proposition is visible above the fold.

### Task 3: Verify the asset and markdown changes

**Files:**
- Verify: `D:\Github\CodexPin\assets\readme\codexpin-hero.png`
- Verify: `D:\Github\CodexPin\README.md`

**Step 1:** Open the generated banner and visually verify composition.

**Step 2:** Re-read the README top section and confirm the image path and badge links are valid.
