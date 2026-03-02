# Plan: WhoisWho Codebase Reorganization + Agent Documentation

**Created:** 2026-02-28
**Status:** Ready to execute
**Scope:** Reorganize only (no deletions) + create comprehensive documentation

## Context

WhoisWho was vibe-coded by a friend who doesn't know how to code. The architecture works but has a flat `src/ui/` with 21 components dumped together, no path aliases (all relative `../` imports), no barrel exports, and a 5-line CLAUDE.md. The goal is to **reorganize** (no deletions) and **create documentation** so the friend can continue vibe-coding with good patterns, and any AI agent knows how to work in the repo.

---

## What Changes

### 1. Add `@/` path alias (tsconfig.json + vite.config.ts)
- `tsconfig.json`: add `"baseUrl": "."` and `"paths": { "@/*": ["src/*"] }`
- `vite.config.ts`: add `resolve.alias` mapping `@` to `src/`
- All imports will be converted from `../../store/selectors` → `@/store/selectors`

### 2. Reorganize `src/ui/` into subdirectories

Move 20 files into 4 semantic groups. **No other directories change.**

| Destination | Files | Why |
|---|---|---|
| `ui/screens/` | MenuScreen, CharacterSelectScreen, SchizodioPickerScreen, NoNFTScreen, OnlineLobbyScreen, OnlineWaitingScreen, ResultScreen | Full-page views, one at a time |
| `ui/panels/` | QuestionPanel, AnswerPanel, AnswerRevealed, GuessPanel, SecretCardPanel, EliminationPrompt | Docked gameplay panels |
| `ui/overlays/` | GuessWrongOverlay, AutoEliminatingOverlay, PhaseTransition | Transient auto-dismiss overlays |
| `ui/widgets/` | RiskItButton, TurnIndicator, CPUThinkingIndicator, WalletButton | Small persistent elements |

`UIOverlay.tsx` and `common/` stay where they are.

### 3. Add barrel exports (`index.ts`) for every module

Create `index.ts` in: `ai/`, `audio/`, `canvas/`, `data/`, `hooks/`, `scene/`, `starknet/`, `store/`, `supabase/`, `utils/`, `ui/screens/`, `ui/panels/`, `ui/overlays/`, `ui/widgets/`, `ui/common/`

### 4. Convert all relative imports to `@/` aliases

Every `../` import across all ~50 files gets converted to `@/module/file`. Intra-module imports (e.g., `./drawFace` inside `canvas/`) stay relative.

### 5. Create documentation (3 files)

- `CLAUDE.md` — Comprehensive AI-agent guide (architecture, patterns, common tasks)
- `docs/ARCHITECTURE.md` — System design, module boundaries, data flows
- `docs/GAME_RULES.md` — Game mechanics for context

---

## Execution Order

### Phase 0: Path alias setup
1. Edit `tsconfig.json` — add `baseUrl` + `paths`
2. Edit `vite.config.ts` — add `resolve.alias`
3. Run `npm run build` to verify

### Phase 1: Create UI subdirectories + move files
4. Create dirs: `src/ui/screens/`, `src/ui/panels/`, `src/ui/overlays/`, `src/ui/widgets/`
5. Move 7 screen files → `ui/screens/`, create `screens/index.ts`
6. Move 6 panel files → `ui/panels/`, create `panels/index.ts`
7. Move 3 overlay files → `ui/overlays/`, create `overlays/index.ts`
8. Move 4 widget files → `ui/widgets/`, create `widgets/index.ts`
9. Update `UIOverlay.tsx` imports from `./FileName` → `./screens/FileName` (etc.)
10. Update `MenuScreen.tsx` import of `OnlineLobbyScreen` (both now in `screens/`, stays `./`)
11. Update moved files: `./common/Button` → `../common/Button`
12. Create `ui/common/index.ts` barrel
13. Run `npm run build` to verify

### Phase 2: Barrel exports for existing modules
14. Create `index.ts` for: `data/`, `store/`, `starknet/`, `supabase/`, `utils/`, `canvas/`, `audio/`, `ai/`, `hooks/`, `scene/`
15. Run `npm run build` to verify

### Phase 3: Convert all imports to `@/` alias
16. Convert imports module by module (store → data → utils → starknet → supabase → canvas → audio → ai → hooks → scene → ui)
17. Rule: cross-module imports use `@/`, intra-module use `./`
18. Run `npm run build` to verify

### Phase 4: Documentation
19. Rewrite `CLAUDE.md` with full agent guide
20. Create `docs/ARCHITECTURE.md`
21. Create `docs/GAME_RULES.md`

### Phase 5: Verify
22. `npm run build` — final type + build check
23. `npm run dev` — smoke test the dev server loads

---

## Critical Files

| File | Role in migration |
|---|---|
| `src/ui/UIOverlay.tsx` | Imports all 18 UI components — biggest import rewrite |
| `tsconfig.json` | Add path alias config |
| `vite.config.ts` | Add resolve alias |
| `src/store/selectors.ts` | Imported by ~15 files, all paths change |
| `src/ui/screens/MenuScreen.tsx` | Imports OnlineLobbyScreen (sibling after move) |
| `src/ui/screens/CharacterSelectScreen.tsx` | Imports from common/, store, starknet, data, hooks |
| `src/ui/screens/OnlineLobbyScreen.tsx` | Highest coupling UI file (starknet, supabase, store) |
| `src/ui/screens/ResultScreen.tsx` | Imports from starknet/commitReveal, hooks, utils, audio |
| `src/ui/widgets/WalletButton.tsx` | Imports from 4 starknet modules |
| `src/hooks/useOnlineGameSync.ts` | Bridges 5 modules (store, supabase, starknet, data, utils) |

---

## New Directory Structure (Final State)

```
src/
  ai/
    cpuAgent.ts
    index.ts
  audio/
    sfx.ts
    index.ts
  canvas/
    PortraitRenderer.ts
    drawFace.ts
    drawHair.ts
    drawAccessories.ts
    index.ts
  data/
    characters.ts
    memeCharacters.ts
    nftCharacterAdapter.ts
    questions.ts
    traits.ts
    index.ts
  hooks/
    useAdaptiveGrid.ts
    useCPUPlayer.ts
    useCharacterPreviews.ts
    useCharacterTextures.ts
    useNFTTextures.ts
    useOnlineGameSync.ts
    index.ts
  scene/
    Board.tsx
    CameraController.tsx
    CharacterGrid.tsx
    CharacterTile.tsx
    Environment.tsx
    GameScene.tsx
    MysteryCard.tsx
    index.ts
  starknet/
    collectionService.ts
    commitReveal.ts
    config.ts
    hooks.ts
    nftService.ts
    sdk.ts
    types.ts
    walletStore.ts
    index.ts
  store/
    gameStore.ts
    selectors.ts
    types.ts
    index.ts
  supabase/
    client.ts
    gameService.ts
    types.ts
    index.ts
  ui/
    screens/          ← NEW
      CharacterSelectScreen.tsx
      MenuScreen.tsx
      NoNFTScreen.tsx
      OnlineLobbyScreen.tsx
      OnlineWaitingScreen.tsx
      ResultScreen.tsx
      SchizodioPickerScreen.tsx
      index.ts
    panels/           ← NEW
      AnswerPanel.tsx
      AnswerRevealed.tsx
      EliminationPrompt.tsx
      GuessPanel.tsx
      QuestionPanel.tsx
      SecretCardPanel.tsx
      index.ts
    overlays/         ← NEW
      AutoEliminatingOverlay.tsx
      GuessWrongOverlay.tsx
      PhaseTransition.tsx
      index.ts
    widgets/          ← NEW
      CPUThinkingIndicator.tsx
      RiskItButton.tsx
      TurnIndicator.tsx
      WalletButton.tsx
      index.ts
    common/
      Button.tsx
      Card.tsx
      index.ts
    UIOverlay.tsx
  utils/
    constants.ts
    evaluateQuestion.ts
    index.ts
  styles/
    global.css
  App.tsx
  main.tsx
  vite-env.d.ts

docs/                 ← NEW
  ARCHITECTURE.md
  GAME_RULES.md
CLAUDE.md             ← REWRITTEN
```

---

## Review Findings (from compound review)

### CRITICAL (fix when executing)
- **C1**: Hardcoded bypass secret `'starknethas8users'` in `OnlineLobbyScreen.tsx:39`
- **C2**: Supabase RLS wide open (`for all using (true)`) in `supabase-schema.sql:72-76`
- **C3**: Texture memory leak — old Three.js textures never `.dispose()`'d
- **C4**: O(n^2) elimination checks — `eliminatedIds.includes()` should be `Set`

### HIGH
- **H1**: Commit-reveal is client-side only (anti-cheat is theater until Phase 2 contracts)
- **H2**: Answer evaluation on receiver's client (opponent can lie)
- **H3**: No event authorization on Supabase game_events
- **H4**: Canvas portrait generation blocks main thread (500-2000ms on LOD transition)

### MEDIUM
- Missing `.env` in `.gitignore`
- Secret character ID logged to console in production
- Wildcard CORS on serverless proxies
- 38 console.log calls leak wallet addresses
- `useOnlineGameSync` is 307 lines mixing 5 concerns
- No React error boundary around the Canvas

### Dead Code (~777 lines, not deleting per user request)
- `useNFTTextures.ts` — never imported
- `SchizodioPickerScreen.tsx` — never imported
- `NoNFTScreen.tsx` — never imported
- `HANDOFF_TO_OPPONENT` + `ELIMINATION` phases — unreachable states
- 4 unused Supabase functions
- Phase 2 stubs in commitReveal.ts
- `TILE` + `CAMERA.player1/player2` constants

### What's Good (keep as-is)
- No circular dependencies — clean import graph
- LOD system — 3-tier minimal/flat/full with InstancedMesh
- Zustand state machine — explicit phase transitions
- Starknet layer isolation — wallet, NFT, commit-reveal separated
- Procedural SFX and portrait systems
- Adaptive grid scales 1-999 tiles

---

## Starknet/Cairo Tools Available

| Tool | Purpose |
|---|---|
| `mcp__cairo-coder__assist_with_cairo` | Write Cairo contracts, debug, refactor |
| Context7 docs | Query Starknet.js, Cairo, Dojo documentation |
| `/projects/beefchain-zypherpunk/starknet/src/` | Reference Cairo contracts |
| `/projects/tu-vaca/packages/snfoundry/` | More Cairo patterns (ERC721, factory, oracle) |

---

## Verification

1. `npm run build` passes (tsc + vite) after each phase
2. `npm run dev` loads the game
3. All import paths use `@/` for cross-module, `./` for intra-module
4. No behavioral changes — pure structural reorganization
