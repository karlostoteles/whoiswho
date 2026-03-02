# WhoisWho — AI Agent Guide

## What Is This?

WhoisWho is a browser-based "Guess Who?" game built for Starknet NFT collections. Players pick a secret character, ask yes/no questions about traits, and eliminate characters until they guess the opponent's pick. Supports local (vs CPU), and online (vs player via Supabase realtime + on-chain commit-reveal).

## Role Context

You are the CTO and CSO of the project, acting also as game designer and product manager. It's imperative that this game works and it's beautiful. Use any resource you need and ask when needed.

## Tech Stack

- **Runtime:** React 19 + TypeScript 5.9, Vite 7
- **3D:** Three.js 0.183 via @react-three/fiber 9 + drei 10
- **State:** Zustand 5 (single store with immer middleware)
- **Blockchain:** Starknet 9 + starkzap, Cartridge Controller wallet
- **Backend:** Supabase (Postgres + Realtime channels)
- **Animation:** Framer Motion 12

## Project Structure

```
src/
  ai/          → CPU opponent logic (cpuAgent.ts)
  audio/       → Procedural SFX engine (sfx.ts)
  canvas/      → 2D portrait rendering (PortraitRenderer, drawFace/Hair/Accessories)
  data/        → Game data: characters, questions, traits, NFT adapter
  hooks/       → React hooks: grid, CPU, textures, online sync
  scene/       → 3D scene: Board, CharacterGrid, CharacterTile, Camera, Environment
  starknet/    → Wallet, NFT fetching, commit-reveal, collection service
  store/       → Zustand game store, selectors, types (GamePhase state machine)
  supabase/    → Supabase client, game service, realtime subscriptions
  utils/       → Constants (board/tile/camera), evaluateQuestion
  ui/
    screens/   → Full-page views (Menu, CharacterSelect, OnlineLobby, Result, etc.)
    panels/    → Docked gameplay panels (Question, Answer, Guess, Elimination, SecretCard)
    overlays/  → Transient auto-dismiss (GuessWrong, AutoEliminating, PhaseTransition)
    widgets/   → Small persistent elements (TurnIndicator, RiskIt, CPUThinking, Wallet)
    common/    → Shared components (Button, Card)
    UIOverlay.tsx → Root UI component, mounts all UI based on GamePhase
  styles/      → global.css
  App.tsx      → Mounts GameScene + UIOverlay
  main.tsx     → Entry point
```

## Import Conventions

- **Cross-module:** Always use `@/module/file` (e.g., `import { usePhase } from '@/store/selectors'`)
- **Intra-module:** Use relative `./file` (e.g., `import { drawFace } from './drawFace'`)
- **Barrel exports:** Every module has an `index.ts`. Prefer importing from barrel when adding new consumers.
- **Path alias:** `@/` maps to `src/` (configured in tsconfig.json + vite.config.ts)

## State Machine (GamePhase)

The game is driven by a `GamePhase` enum in `store/types.ts`. Phases flow:

```
MENU → SETUP_P1 → SETUP_P2 → HANDOFF_START →
  QUESTION_SELECT → ANSWER_PENDING → ANSWER_REVEALED →
  AUTO_ELIMINATING → ELIMINATION → TURN_TRANSITION → (loop back to QUESTION_SELECT)
  GUESS_SELECT → GUESS_WRONG (loop) | GUESS_RESULT → GAME_OVER
```

Online mode adds: `ONLINE_WAITING`, `HANDOFF_TO_OPPONENT`

All phase transitions go through `useGameStore` actions. Never set phase directly.

## Key Patterns

1. **Zustand selectors** — Use the pre-built selector hooks from `store/selectors.ts` (`usePhase()`, `useGameCharacters()`, etc.). Don't access the raw store.
2. **LOD system** — `CharacterTile` renders at 3 tiers (minimal/flat/full) based on tile width. `getTileLOD()` in utils decides.
3. **Procedural portraits** — `canvas/PortraitRenderer.ts` generates character face textures from trait data. Runs on Canvas 2D, returns THREE.CanvasTexture.
4. **Commit-reveal** — Client-side for now. `starknet/commitReveal.ts` hashes (characterId + salt) to create commitments. On-chain submission is stubbed for Phase 2.
5. **Online sync** — `hooks/useOnlineGameSync.ts` bridges Supabase realtime events ↔ Zustand store. It's the single hook that manages online game state.

## Common Tasks

### Add a new UI component
1. Create file in the appropriate `ui/` subdirectory
2. Export from the subdirectory's `index.ts`
3. Import in `UIOverlay.tsx` if it needs to appear based on GamePhase
4. Use `@/store/selectors` for state, `@/data/` for game data

### Add a new game phase
1. Add to `GamePhase` enum in `store/types.ts`
2. Add transition logic in `store/gameStore.ts`
3. Create selector if needed in `store/selectors.ts`
4. Add UI rendering in `UIOverlay.tsx`

### Add a new character trait
1. Add type to `data/traits.ts`
2. Update `data/characters.ts` entries
3. Add question in `data/questions.ts`
4. Update `utils/evaluateQuestion.ts` matcher
5. Update `canvas/drawFace.ts` or `drawHair.ts` or `drawAccessories.ts` for rendering

### Add a new Starknet feature
1. Add to appropriate file in `starknet/`
2. Export from `starknet/index.ts`
3. Reference contracts: `SCHIZODIO_CONTRACT` in `starknet/config.ts`
4. Cairo tools available: `mcp__cairo-coder__assist_with_cairo`

## Scripts

- `npm run dev` — Start dev server
- `npm run build` — TypeScript check + Vite production build
- `npm run preview` — Preview production build

## Known Issues (from review)

### Critical
- Hardcoded bypass secret `'starknethas8users'` in OnlineLobbyScreen.tsx:39
- Supabase RLS wide open (`for all using (true)`)
- Texture memory leak — old Three.js textures never `.dispose()`'d
- O(n²) elimination checks — `eliminatedIds.includes()` should be `Set`

### High Priority
- Commit-reveal is client-side only (anti-cheat is theater until Phase 2 contracts)
- Answer evaluation on receiver's client (opponent can lie)
- No event authorization on Supabase game_events

### Dead Code (~777 lines, preserved intentionally)
- `useNFTTextures.ts`, `SchizodioPickerScreen.tsx`, `NoNFTScreen.tsx` — never imported
- `HANDOFF_TO_OPPONENT` + `ELIMINATION` phases — unreachable states
- 4 unused Supabase functions, Phase 2 stubs in commitReveal.ts

## Starknet/Cairo Tools

| Tool | Purpose |
|---|---|
| `mcp__cairo-coder__assist_with_cairo` | Write Cairo contracts, debug, refactor |
| `/projects/beefchain-zypherpunk/starknet/src/` | Reference Cairo contracts |
| `/projects/tu-vaca/packages/snfoundry/` | More Cairo patterns (ERC721, factory, oracle) |
