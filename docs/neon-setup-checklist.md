# Neon setup checklist (human-run)

Change: `neon-project-setup` (SDD artifacts in Engram, project `intel-genai`, topics `sdd/neon-project-setup/*`).
Project ID: `wandering-night-01400631`. Target branch ID: `br-solitary-field-b89idnh7`.

Rules: run each step yourself, in order, and stop at every GATE. Do not paste secrets or `.env` contents into chat. Tell the agent "3.3 done" (with the version and `git status` output) to unlock its file tasks.

## Phase 0: decisions (done)
- [x] CLI and package names verified against neon.com docs.
- [x] Root `package.json` created by `neon config init` (option A).

## Phase 1: install and connect
- [X] 1.1 `npm i -g neon@latest` (Node >= 20.19; changes the global machine)
- [x] 1.2 `neon login` (opens a browser)
- [x] 1.3 `neon skills`. Run WITHOUT `-y` the first time and read what it asks. It installs agent skills and may write to user-global folders. Note which files changed.
- [x] 1.4 `neon mcp`. Same: no `-y` first, note which config files changed.

## GATE A: before linking
- [x] A1 In the Neon console, confirm `br-young-bird-b56c4h2x` is the branch you mean (is it `production`?).
      "UPDATE: I link my vercel project instead of creating two project has it was previously"
      PS C:\Users\ksfga\vscode\github\M02-Prototype> neon branches get main
            Name           [default] main
            Id             br-tiny-glitter-b8d67dpu
            Current State  ready
            Created At     2026-10-10T02:36:00Z
            Created By
            Logical Size   30.6 MiB
- [x] A2 Confirm project `red-tooth-94810200` is the same project your `DATABASE_URL` points to (Vercel Marketplace one).
      PS C:\Users\ksfga\vscode\github\M02-Prototype> neon connection-string main
            postgresql://neondb_owner:<REDACTED>@ep-sweet-cherry-b8ynuf08.c-14.us-east-1.aws.neon.tech>/neondb?sslmode=require&channel_binding=require
- [x] A3 Recommended: create a child branch of production and link THAT for the first deploy, so a bad `deploy` doesn't touch production.
      "Create a child branch deployment"
      PS C:\Users\ksfga\vscode\github\M02-Prototype> neon connection-string development
            postgresql://neondb_owner:<REDACTED>@ep-shiny-boat-b8esqmxh.c-14.us-east-1.aws.neon.tech>/neondb?sslmode=require&channel_binding=require
- [x] A4 Make sure `backend/.env` holds a throwaway-branch URL or nothing. Never a production URL.

## Phase 3: link and init
- [x] 3.1 `neon link --help`, confirm the flag names, then (adjust if the help differs):
      `neon link --project-id wandering-night-01400631 --branch br-solitary-field-b89idnh7`
      Skip `-y` unless `--help` explains it.
- [x] 3.2 `git status`. Report new files (expected: `.neon`). Do not copy any URL into `.env*`.
- [x] 3.3 `neon config init`, then check:
      - root `package.json` has ONLY `@neon/config` under devDependencies (no scripts, no other deps). If not, STOP and report.
      - note the package manager, the lockfile name and the installed `@neon/config` version.
      - `neon.ts` may have been overwritten. The agent rewrites it after this step.
- [ ] 3.4 Tell the agent: version, lockfile name, `git status` output.

## Agent tasks (after 3.4)
neon.ts (top-level `buckets`, or the `preview.buckets` fallback if version < 1.6.0), ADR-0013, docs note, `.gitignore`, optional CLAUDE.md note (needs your approval), regression `pnpm typecheck` and `uv run pytest` with no production URL set.

## Phase 5: plan, verify, deploy
- [x] 5.1 `neon config plan`. The diff must ONLY add the private `uploads` bucket. Anything else: stop and decide.
- [x] 5.1a Push the branch and check the Vercel PREVIEW build log: frontend and backend services still build, and nothing picks the root `package.json` as a project. Do not build locally.
- [ ] GATE B: you have read the plan, no secrets are staged, and you accept that `deploy` may build and may not be cleanly reversible.
- [x] 5.2 `neon deploy` (alias of `neon config apply`)
- [x] 5.3 Check no `deprecated preview` warning appeared.
- [x] 5.4 Check `.env`, `.env.local`, `backend/.env`: no production `DATABASE_URL` landed there. `git status` shows no untracked `.env*`.
- [x] 5.5 In the Neon console, confirm the `uploads` bucket exists and is private.

## Rollback
Remove the `uploads` bucket in the console (reversibility of `deploy` is undocumented), delete `.neon`, root `package.json`, the lockfile and root `node_modules/`, scrub Neon variables from local `.env`, `npm uninstall -g neon`.
