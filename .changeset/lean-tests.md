---
'create-devstack-app': patch
---

Vitest projects now declare `vite`, its peer dependency, so they install with yarn classic too
(which does not install peers on its own).
