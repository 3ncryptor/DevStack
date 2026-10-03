---
'create-devstack-app': minor
---

Remembered defaults and your own presets (M5):

- `config set <key> <value>` remembers defaults in `~/.config/devstack/config.json`: package
  manager, depth, code style, license, author, and wizard answers ("Remember as my defaults" on
  the review screen). The wizard pre-selects them and `--yes` uses them; flags, a `--config` file
  and a preset still win.
- `presets save <name>` keeps a project's stack (modules, options, settings) as a preset; use it
  with `--preset <name>` or pick it in the wizard. `presets list|show|delete` manage them.
