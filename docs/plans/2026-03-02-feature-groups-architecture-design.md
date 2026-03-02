# Design: Feature Groups Architecture

**Date:** 2026-03-02
**Status:** Approved
**Type:** Folder restructure — no logic changes, no deletions

## Goal

Reorganize `src/` from 11 flat directories into 5 semantic groups so any developer or AI agent can immediately understand what each part of the codebase is responsible for.

## Approved Structure

```
src/
  core/                 ← game brain (pure game logic)
    store/              ← Zustand state machine
    data/               ← characters, questions, traits
    ai/                 ← CPU opponent
    rules/              ← evaluateQuestion, board/camera constants

  services/             ← external integrations (side-effectful)
    starknet/           ← wallet, NFT, commit-reveal, Cartridge SDK
    supabase/           ← Postgres, realtime, game CRUD

  rendering/            ← visual output (Three.js + Canvas2D)
    scene/              ← R3F scene graph (board, tiles, camera)
    canvas/             ← procedural portrait generation

  shared/               ← cross-cutting utilities
    audio/              ← procedural SFX (Web Audio API)
    hooks/              ← React hooks used across multiple features

  ui/                   ← React UI layer (already organized, no changes)
    screens/
    panels/
    overlays/
    widgets/
    common/
    UIOverlay.tsx
```

## File Moves

| From | To |
|---|---|
| `src/store/*` | `src/core/store/*` |
| `src/data/*` | `src/core/data/*` |
| `src/ai/*` | `src/core/ai/*` |
| `src/utils/*` | `src/core/rules/*` |
| `src/starknet/*` | `src/services/starknet/*` |
| `src/supabase/*` | `src/services/supabase/*` |
| `src/scene/*` | `src/rendering/scene/*` |
| `src/canvas/*` | `src/rendering/canvas/*` |
| `src/audio/*` | `src/shared/audio/*` |
| `src/hooks/*` | `src/shared/hooks/*` |

`src/ui/` — no changes.
`src/App.tsx`, `src/main.tsx`, `src/vite-env.d.ts`, `src/styles/` — no changes.

## Import Path Changes

Since `@/` maps to `src/`, all cross-module imports update as follows:

| Old import | New import |
|---|---|
| `@/store/...` | `@/core/store/...` |
| `@/data/...` | `@/core/data/...` |
| `@/ai/...` | `@/core/ai/...` |
| `@/utils/...` | `@/core/rules/...` |
| `@/starknet/...` | `@/services/starknet/...` |
| `@/supabase/...` | `@/services/supabase/...` |
| `@/scene/...` | `@/rendering/scene/...` |
| `@/canvas/...` | `@/rendering/canvas/...` |
| `@/audio/...` | `@/shared/audio/...` |
| `@/hooks/...` | `@/shared/hooks/...` |

## Constraints

- No file deletions
- No logic changes
- No behavioral changes
- `npm run build` must pass after every batch
- Barrel `index.ts` files move with their directories and update their own internal imports
