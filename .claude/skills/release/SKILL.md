---
name: release
description: Cut a new Kanvas version - bump the version everywhere, turn the CHANGELOG's Unreleased section into a dated release, update the README, commit, tag and push so GitHub Actions builds the installers. Use when the user asks to release, cut or ship a version.
disable-model-invocation: true
argument-hint: "[version, e.g. 1.0.0 or patch|minor|major]"
---

# Release

Target version: `$ARGUMENTS`. If empty, propose one (SemVer from the current version and what's in Unreleased: fixes only → patch, new features → minor, 1.0 when the user says the Roadmap's 1.0 goal is met) and ask.

Stop and report at any failed check. Never force-push, move a pushed tag or publish the GitHub release.

## 1. Preflight

- `git status`: the tree must be clean and on `main`. If there's uncommitted work, ask whether to commit it first (and run `/log-changes` for it).
- `git fetch` and check `main` isn't behind `origin/main`.
- `git tag --list 'v*'`: the new tag must not exist.
- `MoodBoard App/CHANGELOG.md` `## [Unreleased]` must have entries. If empty, stop.
- `npm run build` and `cargo check` (in `src-tauri/`) must pass.
- Show the user the Unreleased entries and the version, and confirm before editing anything.

## 2. Bump the version (all five, same value)

- `package.json`: `"version"`
- `package-lock.json`: the top-level `"version"` and `packages[""].version`. Change only those two, not dependency versions.
- `src-tauri/tauri.conf.json`: `"version"`
- `src-tauri/Cargo.toml`: `version` under `[package]`
- `src-tauri/Cargo.lock`: the `version` of the package named in Cargo.toml (`the-moodboard`). Running `cargo check` updates it; verify with `git diff`.

Verify: `grep -n '"version"' package.json src-tauri/tauri.conf.json` and `git diff --stat` show exactly these files.

## 3. CHANGELOG

In `MoodBoard App/CHANGELOG.md`:

- Rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` (today) and insert a new empty `## [Unreleased]` above it.
- Optionally add a one-line summary under the heading (e.g. "First stable release."), as 0.9.0 does with "First beta."
- Update the link references at the bottom:
  - `[Unreleased]: https://github.com/KhaledAlmanla/Kanvas/compare/vX.Y.Z...HEAD`
  - add `[X.Y.Z]: https://github.com/KhaledAlmanla/Kanvas/releases/tag/vX.Y.Z` above the previous version's line.

## 4. README and Roadmap

- `README.md`: update the "Current:" version line and the "Next:" line, and the Download section's file names and URLs (`.../releases/download/vX.Y.Z/Kanvas_X.Y.Z_amd64.deb` etc.). The workflow builds Windows (`.exe`, `.msi`), macOS (`.dmg`) and Linux (`.deb`, `.AppImage`). Only list platforms the user has confirmed work, and ask if unsure.
- `MoodBoard App/Roadmap.md`: if this release completes a milestone section (e.g. "1.0"), ask the user before changing or removing it.

## 5. Log it

Append the `AI output.md` entry as in the `log-changes` skill: version bump, files changed, tag name.

## 6. Commit, tag, push (confirm first)

Show `git diff --stat` and ask the user to confirm. Then:

```
git add -A
git commit -m "Release X.Y.Z"      # body: short summary + Co-Authored-By trailer
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

## 7. After pushing

- The tag triggers `.github/workflows/release.yml` ("Build Kanvas"). Watch it with `gh run list --workflow release.yml` / `gh run watch` if `gh` is available.
- When it finishes, it leaves a **draft** release with all installers attached. Tell the user to check the draft and publish it, and suggest pasting the CHANGELOG section into the release notes (the workflow body only says "See the changelog").
- If the build fails, report the failing job and log. Don't retag; fix forward with a patch version, or delete the unpublished tag only with the user's explicit OK.
