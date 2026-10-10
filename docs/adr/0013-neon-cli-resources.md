# ADR-0013: Neon resources declared with the Neon CLI

Status: accepted (2026-10-09). Extends ADR-0011 and ADR-0012; it does not change them.

## Context
The prototype will store user uploads, so it needs an object-storage bucket on the same Neon project that already backs Postgres (ADR-0012). Neon declares such resources in a root `neon.ts` applied with the Neon CLI (`neon config plan` / `neon deploy`, an alias of `neon config apply`).

## Decision
- Link the repo to the **existing Vercel Marketplace Neon project** (`wandering-night-01400631`, org `org-hidden-scene-25338657`), not a second project. `.neon` links the `development` branch (a child of the default `main`) so a first `deploy` never touches `main`. `.neon` is git-ignored.
- `neon.ts` at the repo root declares **only** a private `uploads` bucket. `@neon/config` is 1.8.6 (>= 1.6.0), so the top-level `buckets` form is used, not `preview.buckets`. Neon Auth (`auth: true`, from the `neon config init` template) is not enabled.
- A root `package.json` exists only as a single-dependency toolchain file (`@neon/config` under `devDependencies`) so `neon.ts` can import `@neon/config/v1`. It is **not** a JS workspace: `frontend/` and `backend/` stay installed and tested on their own. Its lockfile is `pnpm-lock.yaml`.
- Vercel stays the only app deploy path. The schema changes only through Alembic. `DATABASE_URL` comes only from the Marketplace env vars; `neon deploy` is limited to the resources in `neon.ts`.
- Always run `neon config plan` and read the diff before `neon deploy`.

## Consequences
Uploads get a private bucket next to the database. Adds a Node toolchain at the repo root and a CLI step to the setup. Whether `neon deploy` is reversible is undocumented, so treat it as not cleanly reversible and remove the bucket in the Neon console if it has to be undone. The effect of the root `package.json` on the Vercel `services` build is verified on a preview deployment before `deploy`.
