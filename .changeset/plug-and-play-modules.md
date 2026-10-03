---
'create-devstack-app': minor
---

Modules describe themselves: databases their Docker service and SQL dialect, frameworks their
API style, every module where the wizard offers it. A new database, ORM or framework is its own
folder and a registry line; a module that does not support a framework's style says so before
anything is generated. The module contract is frozen for 1.0.
