---
'create-devstack-app': patch
---

`init` asks whether to make the initial git commit before it asks about GitHub; declining it
skips the GitHub question, and git is still set up. Before, the commit was always made, and
declining GitHub only skipped the push.
