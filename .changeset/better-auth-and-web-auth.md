---
'create-devstack-app': minor
---

Better Auth and login pages (M3, tasks 4.2 and 4.5):

- New **Authentication** choice _Better Auth_, with optional **GitHub** and **Google** sign-in.
  Sessions live in the database behind an httpOnly cookie; writes from untrusted origins are
  refused; `GET /me` and `requireAuth` / `requireRole('ADMIN')` work as with the JWT option.
  OAuth credentials stay blank in `.env`, and the summary lists the callback URL to register.
- The web apps get **login, register, account and logout pages** whenever the API has auth,
  with a button per OAuth provider and `<RequireAuth>` for protected pages. The admin app has
  no registration and admits admins only (`auth:make-admin <email>`).
- Generated tests cover sign-up, sign-in, sign-out, CSRF, roles and a GitHub sign-in against a
  mocked provider, without a database.
