# ForgeNeo + Invoke-SDRender v17 migration

Status: **planning / baseline validation required**. This document records the first compatibility audit; it does **not** assert that the extension runs correctly in ForgeNeo.

## Source and scope

- Source fork: `DrEnnui/PromptsBrowser`.
- Migration branch: `compat/forge-neo-v17`, based on `fix/active-prompt-delimiters` (which is three commits ahead of `main` at branch creation).
- ForgeNeo installation target: `D:\forge-neo\extensions\PromptsBrowser`.
- Invoke-SDRender v17: separate CLI/render orchestrator, using ForgeNeo through its API. No new hard dependency on this browser extension.
- Primary objective: restore the interactive **prompt browser / active prompt cards** to ForgeNeo while retaining the separator-preserving tokenizer changes.
- Secondary, optional objective: later share selected prompt data with v17 through an explicit file/schema interface. Do **not** couple the v17 engine to Gradio DOM or internal extension state.

## Existing work to preserve

The delimiter branch adds `client/synchroniseCurrentPrompts/tokenizePrompt.ts` and updates parsing, prompt-object metadata, and textarea reconstruction. It supports top-level commas, semicolons, sentence punctuation, line breaks/tabs and standalone uppercase `BREAK` while preserving actual separators. Syntax inside parentheses, square brackets and angle brackets is intentionally protected. The branch also contains an updated compiled `javascript/main.js`; source changes must be rebuilt and the compiled bundle inspected before deployment.

## Compatibility audit targets

1. **Loading and assets:** Python extension loads without dependency/import exceptions; JavaScript, CSS and auxiliary files are served without 403/404. Previous development-junction use produced Gradio 403s; for deployment, use a normal clone within the ForgeNeo `extensions` directory rather than a junction to an external working copy.
2. **DOM and initialization:** `client/index.ts` expects `#txt2img_prompt_container` and `#tabs > div:first-child`; `client/main/mountContainer.ts` assumes a specific positive/negative prompt container hierarchy and textarea position. Inspect actual ForgeNeo markup before changing selectors.
3. **Partial initialization:** `tryToHook()` sets `promptsBrowserMounted = true` after calling `mountContainer()`, even when that function returns `false`; failed panel mounts do not automatically retry. Implement retry or idempotent per-panel mount status, ensuring no duplicate event listeners/React roots.
4. **Model detection:** `client/index.ts` looks for `#setting_sd_model_checkpoint` or `#quicksettings .model_selection`. Verify ForgeNeo's actual checkpoint component and change events; model-specific preview lookup must degrade safely if it is absent.
5. **Prompt synchronization:** `syncCurrentPrompts.ts` still performs a replacement around angle-bracket network syntax. Verify it does not rewrite valid Anima/ForgeNeo prompts or interact badly with the delimiter preservation.
6. **Build/tests:** `package.json` currently has no automated test command (only an error placeholder). Add deterministic parser and round-trip regression tests before further refactoring.

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

## Smoke/regression matrix

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

## First validation evidence to capture

- ForgeNeo version/commit and extension branch/SHA.
- Browser developer console errors and failed Network entries (especially `javascript/main.js`, `style.css`, `vendor.js` and `getCaretPos.js`).
- Whether txt2img and img2img prompt containers exist and their relevant DOM structure.
- A before/after prompt string for any tokenizer or card-operation failure.
