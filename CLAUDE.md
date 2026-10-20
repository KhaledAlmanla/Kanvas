# Kanvas

A desktop moodboard app: place images and text boxes on an infinite dot-grid canvas, save each board as a folder (`MyBoard/MyBoard.kanvas` JSON + `MyBoard/Images/`). Tauri 2 (Rust backend) + React 19 + TypeScript + Vite. Free, vibe-coded: the user designs, directs and tests; AI assistants write the code.

## Read first

- `MoodBoard App/Codebase Guide.md`: folder map, what each file does, where data lives, recipes for new toolbar buttons / OS features / item types / settings. Keep it accurate when you change structure.
- `MoodBoard App/APP design.md`: the user's intent for the app. Read it to understand a feature request.
- `MoodBoard App/Roadmap.md` (planned) and `MoodBoard App/CHANGELOG.md` (shipped).

`MoodBoard App/` is an Obsidian vault. Notes there may use `[[wikilinks]]`, but CHANGELOG, Roadmap and README use standard Markdown links so they also work on GitHub.

## Note permissions (hard rule)

Every note in `MoodBoard App/` has a `Permission:` line in its frontmatter.

- `Permission: User only. No AI`: **never edit**, by any tool. Reading is fine. Currently: `APP design.md`, `AI prompt.md`, `MoodBoard.md`.
- `Permission: AI allowed`: you may edit. Currently: `CHANGELOG.md`, `Roadmap.md`, `AI output.md`, `Settings Panel.md`, `Codebase Guide.md`.

Check the frontmatter of any note before editing it; new notes may appear.

## After every change: log it

Run `/log-changes` (the `log-changes` skill) when a piece of work is done. It updates:

1. `MoodBoard App/AI output.md`: append an H4 entry, exactly `#### Changes by "Claude"_ Date[dd.mm.yyyy]_time[hh:mm]:` (local time) followed by `-` bullets in plain language. This format is set by the user in `AI prompt.md`.
2. `MoodBoard App/CHANGELOG.md`: user-facing lines under `## [Unreleased]` (Keep a Changelog: Added / Changed / Fixed / Removed).
3. `MoodBoard App/Roadmap.md`: tick (`- [x]`) finished items.

## Commands

| Command | Use |
|---|---|
| `npm run build` | Type-check + build the frontend. The quick "does it compile" check; run it after frontend changes. |
| `cargo check` / `cargo test` (in `src-tauri/`) | Check / test the Rust side after backend changes. |
| `npm run tauri dev` | Run the app. The user tests visually; say what to try. |
| `npm run tauri build` | Build an installable package locally. |

No linter, formatter or frontend tests are set up.

## Code layout and conventions

- `src/components/C_*.tsx`: React components, `C_` prefix. `C_canvas.tsx` is the brain (board state, mouse, keyboard, save/open).
- `src/lib/*.ts`: logic with no visuals (item types and geometry, board file I/O, settings).
- `src/App.css`: all styling. Themes use CSS variables; don't hard-code colours.
- `src-tauri/src/lib.rs`: Rust `#[tauri::command]`s for anything touching the disk or OS, called from `src/lib/` via `invoke(...)`. New permissions go in `src-tauri/capabilities/default.json`.
- Tauri is only the runtime; all buttons and controls are custom UI code.
- The board file format is versioned. When changing it, bump the version and keep older boards loading.

## Git and releases

- Commit messages: imperative summary line ("Add ...", "Fix ..."), optional bullet body.
- Commit and push only when the user asks.
- Version lives in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`. Use `/release` to bump it; it keeps them in sync.
- Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds Windows, macOS and Linux installers into a **draft** GitHub release. The user publishes it.
