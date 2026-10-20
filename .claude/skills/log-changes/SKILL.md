---
name: log-changes
description: Record finished work in the Kanvas notes - append an entry to AI output.md, add user-facing lines to the CHANGELOG's Unreleased section, and tick done Roadmap items. Use after completing a feature, fix or docs change, or when the user asks to log, record or document changes.
---

# Log changes

Records what was just done in the three "AI allowed" notes in `MoodBoard App/`. Never touch notes marked `Permission: User only. No AI`.

## 1. Work out what changed

- Since the last log: read the last few entries at the bottom of `MoodBoard App/AI output.md`, then compare with `git log` (commits after that date) and `git diff HEAD` plus `git status` (uncommitted work).
- Combine this with what was done in the current conversation. If the user named a scope ("log the paste feature"), log only that.
- Skip anything already logged. If nothing new is found, say so and stop.

## 2. `MoodBoard App/AI output.md`: technical record

Append at the end of the file. Get the local date and time with `date '+%d.%m.%Y %H:%M'`.

```
#### Changes by "Claude"_ Date[20.10.2026]_time[21:05]:
- What changed, in plain language, with file names or formats where useful.
- One bullet per change. Mention notes you updated as [[Note name]].
```

The header format is fixed by the user (`AI prompt.md`): H4, `"Claude"` in quotes, `Date[dd.mm.yyyy]`, `time[hh:mm]`, colon at the end. This note may contain detail: file format versions, what was left undone, decisions the user made.

## 3. `MoodBoard App/CHANGELOG.md`: user-facing

Under `## [Unreleased]`, add lines to the right subsection: `### Added`, `### Changed`, `### Fixed` or `### Removed`. Create a subsection if it's missing, in that order.

- Write for someone using the app, not reading the code: what they can now do, starting with a **bold short name**, plus the shortcut if there is one.
- Leave out internal-only changes (refactors, docs, CI) unless they change something the user sees or downloads.
- Use standard Markdown links, not `[[wikilinks]]` (the file is also read on GitHub).

## 4. `MoodBoard App/Roadmap.md`

If a finished change matches a roadmap item, tick it (`- [ ]` → `- [x]`). Don't delete or reword items the user wrote. If work partly covers an item, leave it unticked and say so in the AI output entry.

## 5. Other docs (only if affected)

- `MoodBoard App/Codebase Guide.md` if files, data locations or "how to add X" changed.
- `README.md` if features, downloads or build steps it mentions changed.

## 6. Report

Tell the user in a few lines which notes were updated and what was added. Don't commit unless asked.
