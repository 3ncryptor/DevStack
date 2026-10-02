---
'create-devstack-app': minor
---

Session auth (M4): a new Authentication choice, **Email + password (sessions in Redis)**. It works
like the JWT option, but the access token is a session id kept in Redis, so logging out (or a
stolen refresh token being reused) ends sessions immediately. Adds Redis to the stack.
