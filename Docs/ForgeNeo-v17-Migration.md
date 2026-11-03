# PromptsBrowser customizations on ForgeNeo (SD-Render v17 era)

Status: **existing ForgeNeo installation works** (user-confirmed, November 2, 2026). This workstream is about retaining and completing our own PromptsBrowser modifications, not porting the upstream extension to ForgeNeo. The GitHub development branch has not yet been tested against the user's local running installation.

## Source and scope

- Source fork: `DrEnnui/PromptsBrowser`.
- Customization branch: `compat/forge-neo-v17`, based on `fix/active-prompt-delimiters` (which is three commits ahead of `main` at branch creation).
- ForgeNeo installation target: `D:\forge-neo\extensions\PromptsBrowser`.
- Invoke-SDRender v17: separate CLI/render orchestrator, using ForgeNeo through its API. No new hard dependency on this browser extension.
- Primary objective: apply and validate our **custom active-prompt delimiter and card-editing behavior** against the already-functioning ForgeNeo extension, without disrupting its existing collections or features.
- Secondary, optional objective: later share selected prompt data with v17 through an explicit file/schema interface. Do **not** couple the v17 engine to Gradio DOM or internal extension state.

## Existing work to preserve

The delimiter branch adds `client/synchroniseCurrentPrompts/tokenizePrompt.ts` and updates parsing, prompt-object metadata, and textarea reconstruction. It supports top-level commas, semicolons, sentence punctuation, line breaks/tabs and standalone uppercase `BREAK` while preserving actual separators. Syntax inside parentheses, square brackets and angle brackets is intentionally protected. The branch also contains an updated compiled `javascript/main.js`; source changes must be rebuilt and the compiled bundle inspected before deployment.

## Targeted code review (only where custom modifications require it)

1. **Loading and assets:** Baseline extension loading is already working. Earlier development via an external junction produced Gradio 403s; prefer a normal clone inside the ForgeNeo `extensions` directory for our branch. Investigate assets only if the customized branch breaks them.
2. **DOM and initialization:** Current installation works; avoid speculative selector changes. `client/index.ts` already includes a wait-until-available Forge startup hook instead of the previous 100-attempt timeout. Verify its behavior only if the modified branch fails on startup.
3. **Potential edge-case:** `tryToHook()` sets `promptsBrowserMounted = true` after calling `mountContainer()`, even when that function returns `false`; failed panel mounts do not automatically retry. Implement retry or idempotent per-panel mount status, ensuring no duplicate event listeners/React roots.
4. **Model detection:** Current installation works. Leave model selectors unchanged unless a reproducible problem appears in our branch.
5. **Prompt synchronization:** `syncCurrentPrompts.ts` still performs a replacement around angle-bracket network syntax. Verify it does not rewrite valid Anima/ForgeNeo prompts or interact badly with the delimiter preservation.
6. **Build/tests:** Basic source-level tokenizer regression tests have been added at `tests/tokenizePrompt.test.cjs` and `npm test` wired in `package.json`; they still need to be run locally. Add full card-to-textarea round-trip tests, because tokenizer tests alone cannot prove drag/drop edits preserve punctuation.

## Local preparation (PowerShell 7)

First inspect **the existing installation**, which may already have important personal collections:

```powershell
$ext = 'D:\forge-neo\extensions\PromptsBrowser'
git -C $ext status --short --branch
git -C $ext remote -v
```

Do **not** blindly delete, replace or pull into this directory. Back up any `prompts_catalogue`, `styles_catalogue`, settings or local changes wherever actually stored; collections and style data are user content, not disposable build artifacts. Confirm the origin points to this fork before switching branches. If the installation is upstream or locally modified, migrate it to a fresh clone under `extensions` after preserving the data and ensuring only one copy is enabled.

For an existing **clean clone of this fork**, after verifying the remote and backing up data:

```powershell
git -C $ext fetch origin
git -C $ext switch --track origin/compat/forge-neo-v17
```

If the branch is already present locally, use `git -C $ext switch compat/forge-neo-v17`. Restart ForgeNeo and inspect server/browser console output. Do not infer successful integration from a clean Python startup alone.

## Customization regression matrix

The extension itself is already operational in ForgeNeo. The following checkboxes concern **our development branch**, not baseline installation health.

- [ ] Extension loads; all static assets return successfully.
- [ ] Browser + active prompt cards appear in **txt2img**.
- [ ] Browser + active prompt cards appear in **img2img**.
- [ ] Typing and pasting changes active cards; clicking a library card changes text without dropping existing text.
- [ ] Commas, semicolons, sentence punctuation, newlines/tabs, terminal punctuation and `BREAK` survive a non-destructive card operation.
- [ ] Decimal values such as `(word:1.25)` and LoRA/network syntax such as `<lora:name:0.8>` are not split or rewritten.
- [ ] Weighted groups, nested groups and `{alternative|syntax}` behave as expected.
- [ ] Prompt ordering, removal, editing and weight changes preserve unrelated delimiters.
- [ ] Negative-prompt input and controls are not affected.
- [ ] Collection browsing, search, tags, styles, save/edit and preview operations work.
- [ ] Changing ForgeNeo checkpoints updates or safely disables model-specific previews.
- [ ] The extension continues to work after switching between txt2img/img2img or refreshing the page.
- [ ] Invoke-SDRender v17 renders normally through ForgeNeo with the extension enabled **and** disabled.

## Integration boundary with SD-Render v17

v17 owns authoritative preset/model data, prompt files, render parameters, generation requests, manifests and batch recovery. PromptsBrowser owns interactive browser-side editing, snippets/collections, styles and their previews. There is **no need** for the render orchestrator to load or invoke the extension to perform normal runs.

If shared prompts are desired later, define a small import/export contract (for example, versioned JSON with source/IDs/text/tags) and an explicit command. Avoid automatic mirroring, direct mutation of extension catalogue internals, model-setting side effects and any hidden synchronization.

## Evidence to capture only if custom branch misbehaves

- ForgeNeo version/commit and extension branch/SHA.
- Browser developer console errors and failed Network entries (especially `javascript/main.js`, `style.css`, `vendor.js` and `getCaretPos.js`).
- Whether txt2img and img2img prompt containers exist and their relevant DOM structure.
- A before/after prompt string for any tokenizer or card-operation failure.
