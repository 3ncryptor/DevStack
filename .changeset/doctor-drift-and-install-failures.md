---
'create-devstack-app': minor
---

`doctor` run in a project lists the dependencies whose version differs from this DevStack
version's catalog; nothing is changed. When a command fails after the files are written, the
summary now says "Not verified" and lists the commands to run again and what to check.
