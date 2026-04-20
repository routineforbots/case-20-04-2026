---
name: documentation-skill
description: >-
  Writes clear, concise documentation with examples for functions, modules, API
  endpoints, and UI components. Use when the user wants to document code,
  explain behavior for other developers, add README sections, JSDoc/TSDoc,
  OpenAPI snippets, or component usage notes.
---

# Documentation

Produces **clear, concise** documentation that answers **what it does**, **when to use it**, and **how to use it**, with **minimal examples** that match the project’s language and style.

## When to apply

- Document a **function** or **method** (params, return value, errors, side effects).
- Document a **module** or **package** (purpose, exports, setup, conventions).
- Document an **API endpoint** (method, path, auth, request/response, errors).
- Document a **component** (props, slots, events/callbacks, accessibility notes).

## Core principles

1. **Audience first**: Internal teammates vs public API — adjust depth and tone; avoid redundant restatement of obvious types if types are already explicit.
2. **One primary job per block**: Summary line, then details only where non-obvious.
3. **Examples over prose**: Short, copy-pastable snippets; use realistic but minimal data.
4. **Match the codebase**: Same naming, file paths, and doc tooling already in use (TSDoc, JSDoc, docstrings, Storybook, OpenAPI, etc.).
5. **Stable facts**: Document behavior the code guarantees; avoid marketing language and vague words (“robust,” “powerful”) without specifics.

---

## Functions and methods

Include when useful:

- **Summary** (one line): what it returns or what effect it has.
- **Parameters**: only when names/types don’t tell the full story (units, valid ranges, default behavior).
- **Returns**: non-obvious shapes, `null`/`undefined` cases, discriminated unions.
- **Throws / errors**: when callers must handle or when the function asserts.
- **Side effects**: I/O, globals, mutating arguments, caching.

**Example pattern (TSDoc-style)**

```ts
/**
 * Merges user preferences with defaults; does not mutate the input.
 *
 * @returns A new object; missing keys are filled from `defaults`.
 */
```

Add a **Usage** example only if usage is not obvious from signature + name.

---

## Modules and files

For a module README or top-of-file overview:

- **Purpose**: one short paragraph.
- **Exports**: what to import for common cases (not every symbol if huge).
- **Prerequisites**: env vars, prior initialization, peer dependencies.
- **Conventions**: error handling style, async expectations, threading if relevant.

Avoid duplicating what a generated API reference already lists unless adding context.

---

## API endpoints

Align with **api-creation** / OpenAPI when the project uses contracts. Per endpoint, document:

| Item | Content |
|------|---------|
| **Purpose** | What the operation does in domain terms |
| **Auth** | Required scheme/scopes |
| **Request** | Method, path, query/body fields (required vs optional) |
| **Response** | Success shape and **meaningful** status codes |
| **Errors** | Stable `code` or type identifiers clients can branch on |

Include **one** request/response example (redact secrets; use placeholders like `YOUR_API_KEY`).

---

## UI components

For React/Vue/Svelte (adapt to stack):

- **Purpose** and **when to use** vs a sibling component.
- **Props** (or attributes): table or list — name, type, default, description.
- **Events / callbacks**: payload shape.
- **Slots / children**: composition pattern if non-obvious.
- **A11y**: labels, keyboard, focus trap, if the component owns that behavior.

Optional: minimal render example showing the most common case.

---

## Style

- Prefer **imperative or descriptive** summaries: “Returns …”, “Renders …”, “Sends …”.
- Use **backticks** for code identifiers; link to paths with repo-relative links when helpful.
- Keep line length readable; use lists for multiple constraints.
- **Do not** document implementation trivia unless it affects correct use (performance traps, required call order).

---

## Anti-patterns

- Restating the type system line-by-line with no added meaning.
- Examples that don’t compile or use APIs that don’t exist in the repo.
- Docs that contradict the code — update or remove.
- Wall-of-text paragraphs where a table or list would suffice.

---

## Agent checklist

When documenting for the user:

1. Detect **artifact type** (function, module, endpoint, component) and **existing doc format** in the file or sibling files.
2. Add **summary + non-obvious details + one example** unless the user asks for API-style tables only.
3. Place docs where the project expects them (inline vs `docs/` vs Storybook) — follow existing patterns.
4. If the user’s request is ambiguous, prefer **concise** output and offer to expand specific sections only if needed.
