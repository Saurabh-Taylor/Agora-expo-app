# CLAUDE.md

Guidance for AI assistants and developers working in this repository.

---

## Project Overview

**Agora** is a mobile-first society/apartment management app built with Expo and React Native.

### Problem

Apartment communities currently coordinate through gate calls, WhatsApp groups, paper
registers, and manual approvals. A delivery partner arrives, the guard calls the flat,
the resident misses the call, and the visitor waits — a pattern repeated across every
guest approval, complaint, notice, poll, and maintenance payment in the community. These
disconnected, manual workflows don't scale and create friction for residents, guards, and
admins alike.

### Solution

Agora consolidates the society gate, resident communication, and community operations
into a single app with three role-based experiences:

- **Resident** — approve/pre-approve visitors, raise and track helpdesk complaints,
  book amenities, view notices, vote in polls, pay maintenance dues
- **Security Guard** — register visitors, request approvals, verify approvals, log
  entry/exit in real time
- **Society Admin** — manage towers, flats, residents, staff, service providers,
  amenities, notices, polls, and complaints from a centralized dashboard

Core idea: the conversations that used to happen at the society gate now happen inside
the app — replacing manual, call-based coordination with fast, trackable, role-based
workflows.

---

## Coding Rules

These rules are mandatory when writing or modifying any code in this repository.

### Reusability & DRY (non-negotiable)

- **No code duplication anywhere in the codebase.** If the same logic exists in two
  places, it must be extracted. This is a hard rule, not a preference.
- Any function used in **2 or more places** must live in `commonFunctions.ts` and be
  imported where needed — never copy-pasted.
- Any fixed/hardcoded value (config, keys, labels, thresholds, enums, magic numbers/
  strings) used in more than one place must be defined in `commonConstants.ts` and
  referenced from there — no scattered literals.

### Simplicity

- Prefer the simplest solution that solves the problem. Readable, straightforward code
  beats clever or over-engineered code every time.
- Don't add abstraction, layers, or configuration for cases that don't exist yet.
- If a function is hard to name or understand at a glance, it's probably doing too much —
  split it.

### Naming & Structure

- Use clear, descriptive names for functions, variables, and files. Avoid abbreviations
  that aren't obvious.
- One responsibility per function; keep functions small and focused.
- Group related code together; keep the folder structure predictable so anyone can find
  things fast.

---

## Team & GitHub Conventions

### Branching

- Never commit directly to `main`. `main` must always be in a working, deployable state.
- Create a branch per feature/fix using a clear prefix:
  `feature/visitor-approval`, `fix/gate-log-crash`, `chore/deps-bump`.
- Keep branches short-lived — merge or close within a few days to avoid painful conflicts.

### Commits

- Write small, focused commits with meaningful messages (present tense):
  `add visitor pre-approval flow`, not `stuff` or `fixes`.
- Consider a light Conventional Commits style: `feat:`, `fix:`, `chore:`, `refactor:`,
  `docs:` — it makes history skimmable.

### Pull Requests

- All changes go through a PR — no direct merges, even for small fixes.
- Every PR needs **at least one reviewer approval** before merge (in a 2–3 dev team,
  this is what catches duplication and keeps everyone aware of changes).
- Keep PRs small and single-purpose; a 200-line PR gets a real review, a 2,000-line one
  gets rubber-stamped.
- PR description should say **what** changed and **why**, and how to test it.
- Pull/rebase from `main` before opening a PR so it merges cleanly.

### Code Quality Gates

- Run the linter and formatter (e.g. ESLint + Prettier) before every commit — ideally
  automated with a pre-commit hook (Husky + lint-staged).
- Code must build and the app must run before a PR is opened. Don't push broken code to
  shared branches.
- No commented-out dead code and no leftover `console.log`s in merged code.

### Secrets & Config

- Never commit secrets, API keys, or `.env` files. Use `.env` locally and keep a
  committed `.env.example` documenting the required variables.
- Ensure `.gitignore` covers `node_modules/`, `.env`, build artifacts, and IDE files.

### Coordination

- Communicate before starting large or structural changes so two people don't rebuild
  the same thing (this directly supports the no-duplication rule).
- When you add something to `commonFunctions.ts` or `commonConstants.ts`, mention it in
  the PR so others reuse it instead of re-creating it.
