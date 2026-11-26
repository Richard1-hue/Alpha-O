# Task: Fix broken issue templates

## Goal
The issue templates in `.github/ISSUE_TEMPLATE/` were written badly and do not work (they are missing from GitHub's
"New issue" chooser or render incorrectly). Inspect every template, fix what is wrong, and keep each template's original
purpose, titles and field labels wherever they are not themselves broken.

## Inputs
- Every file in `.github/ISSUE_TEMPLATE/`: `*.yml`, `*.yaml`, `*.md`, and `config.yml` if present.

## Variables and secrets
None.

## Requirements and boundaries
1. Read every file in `.github/ISSUE_TEMPLATE/` and note its problems before editing.
2. Fix files in place, keeping the same file names.
3. Issue forms (`.yml`/`.yaml`):
   - indentation uses spaces only (no tabs);
   - top-level keys: `name`, `description`, `body` are required; `title`, `labels`, `assignees` are optional;
   - `body` is a list; every item has a `type` (`markdown`, `textarea`, `input`, `dropdown` or `checkboxes`) and `attributes`;
   - every item except `markdown` needs `attributes.label`; `markdown` items need `attributes.value` and no `validations`;
   - `dropdown` needs a non-empty `options` list; `checkboxes` need `options` entries that each have a `label`;
   - any `id` must be unique and use only letters, numbers, `-` or `_`;
   - quote any text value that contains `:` or `#`.
4. Markdown templates (`.md`) must start with a `---` front-matter block containing `name` and `about`
   (optional: `title`, `labels`, `assignees`), closed by `---`, followed by the template body.
5. `config.yml` may only contain `blank_issues_enabled` (true/false) and `contact_links`
   (each with `name`, `url` starting with `https://`, and `about`).
6. If a file is beyond repair, rewrite it from scratch with the same purpose.
7. Do NOT delete or rename files, do NOT create new templates, and do NOT edit anything outside `.github/ISSUE_TEMPLATE/`.

## Result and delivery
Corrected files in `.github/ISSUE_TEMPLATE/`. The change log must list, for each file, what was wrong and what was changed.
If no template needed a change, say so and change nothing.

## Completion criteria
- [ ] Every template file follows the rules in "Requirements and boundaries"
- [ ] Only files inside `.github/ISSUE_TEMPLATE/` were modified
- [ ] No file was deleted or renamed
- [ ] The change log states, per file, the problems found and the fixes made

## Tests
No automated tests configured; verify by inspection.

## Dependencies
None.

## Task owner
@Richard1-hue
