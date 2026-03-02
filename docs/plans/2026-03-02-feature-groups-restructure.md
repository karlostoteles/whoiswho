# Feature Groups Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize `src/` from 11 flat directories into 5 semantic groups (`core/`, `services/`, `rendering/`, `shared/`, `ui/`) without changing any logic, deleting any files, or breaking the build.

**Architecture:** Pure file moves + import path updates. The `@/` alias already points to `src/`, so after moving `src/store/` to `src/core/store/`, all imports change from `@/store/...` to `@/core/store/...`. Each task moves one directory, updates imports in all consumers, and verifies the build passes.

**Tech Stack:** TypeScript, Vite, React — verified with `npm run build` (runs `tsc` then `vite build`).

---

## Final Structure Reference

```
src/
  core/         store/ · data/ · ai/ · rules/
  services/     starknet/ · supabase/
  rendering/    scene/ · canvas/
  shared/       audio/ · hooks/
  ui/           (unchanged)
  App.tsx · main.tsx · vite-env.d.ts · styles/
```

---

### Task 1: Move `store/` → `core/store/`

**Files to move:** `src/store/` → `src/core/store/`

**Step 1: Move the directory**

```bash
mkdir -p src/core
mv src/store src/core/store
```

**Step 2: Intra-module imports inside `core/store/` are relative (`./types`, `./gameStore`) — no changes needed there.**

**Step 3: Update all consumer imports**

In every file listed below, change `@/store/` → `@/core/store/`:

Files to update (change `'@/store/` to `'@/core/store/` throughout each file):
- `src/ui/UIOverlay.tsx`
- `src/ui/overlays/GuessWrongOverlay.tsx`
- `src/ui/overlays/PhaseTransition.tsx`
- `src/ui/overlays/AutoEliminatingOverlay.tsx`
- `src/ui/panels/QuestionPanel.tsx`
- `src/ui/panels/GuessPanel.tsx`
- `src/ui/panels/EliminationPrompt.tsx`
- `src/ui/panels/AnswerRevealed.tsx`
- `src/ui/panels/AnswerPanel.tsx`
- `src/ui/panels/SecretCardPanel.tsx`
- `src/ui/screens/CharacterSelectScreen.tsx`
- `src/ui/screens/MenuScreen.tsx`
- `src/ui/screens/OnlineLobbyScreen.tsx`
- `src/ui/screens/ResultScreen.tsx`
- `src/ui/screens/OnlineWaitingScreen.tsx`
- `src/ui/widgets/TurnIndicator.tsx`
- `src/ui/widgets/CPUThinkingIndicator.tsx`
- `src/ui/widgets/RiskItButton.tsx`
- `src/ai/cpuAgent.ts`
- `src/hooks/useOnlineGameSync.ts`
- `src/hooks/useCPUPlayer.ts`
- `src/hooks/useCharacterTextures.ts`
- `src/hooks/useAdaptiveGrid.ts`
- `src/hooks/useNFTTextures.ts`
- `src/scene/CameraController.tsx`
- `src/scene/GameScene.tsx`
- `src/scene/CharacterGrid.tsx`
- `src/scene/MysteryCard.tsx`
- `src/scene/CharacterTile.tsx`

One-liner to do it all at once:
```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/store/|'@/core/store/|g"
```

**Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move store/ → core/store/"
```

---

### Task 2: Move `data/` → `core/data/`

**Files to move:** `src/data/` → `src/core/data/`

**Step 1: Move the directory**

```bash
mv src/data src/core/data
```

**Step 2: Fix intra-module import inside `core/data/nftCharacterAdapter.ts`**

This file imports from `@/starknet/types` — that hasn't moved yet, no change needed.
Internal imports like `./characters`, `./traits` stay relative — no change needed.

**Step 3: Update all consumer imports**

Change `'@/data/` → `'@/core/data/` throughout:

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/data/|'@/core/data/|g"
```

Files affected: `src/ui/panels/QuestionPanel.tsx`, `src/ui/screens/CharacterSelectScreen.tsx`, `src/ui/screens/MenuScreen.tsx`, `src/core/store/gameStore.ts`, `src/ai/cpuAgent.ts`, `src/hooks/useOnlineGameSync.ts`, `src/hooks/useNFTTextures.ts`, `src/supabase/gameService.ts`, `src/canvas/PortraitRenderer.ts` (and draw*.ts files).

**Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move data/ → core/data/"
```

---

### Task 3: Move `ai/` → `core/ai/` and `utils/` → `core/rules/`

**Step 1: Move the directories**

```bash
mv src/ai src/core/ai
mv src/utils src/core/rules
```

**Step 2: Update imports from `@/ai/` and `@/utils/`**

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/ai/|'@/core/ai/|g"
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/utils/|'@/core/rules/|g"
```

Files affected for `@/ai/`:
- `src/hooks/useCPUPlayer.ts`

Files affected for `@/utils/`:
- `src/ui/overlays/PhaseTransition.tsx`
- `src/ui/panels/EliminationPrompt.tsx`
- `src/ui/screens/ResultScreen.tsx`
- `src/ui/widgets/TurnIndicator.tsx`
- `src/hooks/useOnlineGameSync.ts`
- `src/hooks/useCharacterTextures.ts`
- `src/hooks/useAdaptiveGrid.ts`
- `src/scene/CameraController.tsx`
- `src/scene/GameScene.tsx`
- `src/scene/CharacterGrid.tsx`
- `src/scene/Board.tsx`
- `src/scene/MysteryCard.tsx`
- `src/core/store/gameStore.ts`
- `src/core/ai/cpuAgent.ts` (its own internal import from utils)

**Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move ai/ → core/ai/, utils/ → core/rules/"
```

---

### Task 4: Move `starknet/` → `services/starknet/`

**Step 1: Move the directory**

```bash
mkdir -p src/services
mv src/starknet src/services/starknet
```

**Step 2: Update all consumer imports**

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/starknet/|'@/services/starknet/|g"
```

Files affected:
- `src/ui/screens/CharacterSelectScreen.tsx`
- `src/ui/screens/OnlineLobbyScreen.tsx`
- `src/ui/screens/ResultScreen.tsx`
- `src/ui/screens/NoNFTScreen.tsx`
- `src/ui/screens/SchizodioPickerScreen.tsx`
- `src/ui/widgets/WalletButton.tsx`
- `src/hooks/useOnlineGameSync.ts`
- `src/core/data/nftCharacterAdapter.ts`
- `src/core/store/gameStore.ts`

**Step 3: Fix the `require()` call in `useOnlineGameSync.ts`**

Open `src/hooks/useOnlineGameSync.ts` and find this line:
```ts
const { useWalletStore } = require('../starknet/walletStore');
```

Change it to:
```ts
const { useWalletStore } = require('@/services/starknet/walletStore');
```

Note: This is the only `require()` in the codebase — it uses a relative path that must be manually updated since `sed` won't catch it.

**Step 4: Fix intra-module imports inside `services/starknet/`**

The `collectionService.ts` imports from `@/core/data/...` — already updated in Task 2.
Internal imports like `./config`, `./types` are relative and need no change.

**Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move starknet/ → services/starknet/"
```

---

### Task 5: Move `supabase/` → `services/supabase/`

**Step 1: Move the directory**

```bash
mv src/supabase src/services/supabase
```

**Step 2: Update all consumer imports**

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/supabase/|'@/services/supabase/|g"
```

Files affected:
- `src/ui/screens/OnlineLobbyScreen.tsx`
- `src/hooks/useOnlineGameSync.ts`

**Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move supabase/ → services/supabase/"
```

---

### Task 6: Move `scene/` → `rendering/scene/`

**Step 1: Move the directory**

```bash
mkdir -p src/rendering
mv src/scene src/rendering/scene
```

**Step 2: Update App.tsx (uses relative import)**

Open `src/App.tsx` and change:
```ts
import { GameScene } from './scene/GameScene';
```
to:
```ts
import { GameScene } from './rendering/scene/GameScene';
```

**Step 3: Update all `@/scene/` imports**

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/scene/|'@/rendering/scene/|g"
```

Files affected: `src/hooks/useCharacterPreviews.ts`, `src/hooks/useCharacterTextures.ts`, `src/hooks/useAdaptiveGrid.ts`, `src/scene/GameScene.tsx` (now at new path, but its internal imports use `./` so they're fine).

**Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move scene/ → rendering/scene/"
```

---

### Task 7: Move `canvas/` → `rendering/canvas/`

**Step 1: Move the directory**

```bash
mv src/canvas src/rendering/canvas
```

**Step 2: Update all consumer imports**

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/canvas/|'@/rendering/canvas/|g"
```

Files affected:
- `src/hooks/useCharacterTextures.ts`
- `src/hooks/useCharacterPreviews.ts`

**Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move canvas/ → rendering/canvas/"
```

---

### Task 8: Move `audio/` → `shared/audio/` and `hooks/` → `shared/hooks/`

**Step 1: Move the directories**

```bash
mkdir -p src/shared
mv src/audio src/shared/audio
mv src/hooks src/shared/hooks
```

**Step 2: Update all `@/audio/` imports**

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/audio/|'@/shared/audio/|g"
```

Files affected:
- `src/ui/common/Button.tsx`
- `src/ui/panels/QuestionPanel.tsx`
- `src/ui/panels/AnswerRevealed.tsx`
- `src/ui/screens/ResultScreen.tsx`

**Step 3: Update all `@/hooks/` imports**

```bash
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|'@/hooks/|'@/shared/hooks/|g"
```

Files affected:
- `src/ui/UIOverlay.tsx`
- `src/ui/screens/CharacterSelectScreen.tsx`
- `src/ui/screens/ResultScreen.tsx`
- `src/ui/panels/GuessPanel.tsx`
- `src/ui/overlays/GuessWrongOverlay.tsx`
- `src/ui/overlays/AutoEliminatingOverlay.tsx`
- `src/ui/screens/NoNFTScreen.tsx`
- `src/ui/screens/SchizodioPickerScreen.tsx`
- `src/ui/widgets/RiskItButton.tsx`
- `src/rendering/scene/GameScene.tsx`

**Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move audio/ → shared/audio/, hooks/ → shared/hooks/"
```

---

### Task 9: Rewrite CLAUDE.md

Replace the current 3-line `CLAUDE.md` with a comprehensive guide for AI agents and vibe-coders. The new file should document:

**Content to include:**

1. **What this is** — 1v1 Guess Who? board game for Starknet NFT collections
2. **Tech stack** — React 19 + TypeScript, Three.js/R3F, Zustand, Supabase, Starknet/Cartridge
3. **Folder structure** — the 5-group architecture with one-line descriptions of each group
4. **Import convention** — `@/` alias for cross-module, `./` for intra-module
5. **State machine** — GamePhase enum, how phases flow, where transitions happen
6. **How to add things:**
   - New question → `core/data/questions.ts`
   - New trait → `core/data/traits.ts` + `core/data/characters.ts` + `rendering/canvas/draw*.ts`
   - New screen → `ui/screens/`, export from `ui/screens/index.ts`, mount in `ui/UIOverlay.tsx`
   - New game phase → `core/store/types.ts` → `core/store/gameStore.ts` → `ui/UIOverlay.tsx`
   - New Starknet feature → `services/starknet/`, export from index
7. **Build/dev commands** — `npm run dev`, `npm run build`, `npm run preview`
8. **Key architectural rules** — state only through Zustand selectors, no direct store access from UI, @/ aliases always for cross-module imports

**File:** `CLAUDE.md` (root of project, replace existing)

**Step: Write the file, then commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md with comprehensive agent guide"
```

---

### Task 10: Final verification

**Step 1: Clean build**

```bash
npm run build
```

Expected: Zero TypeScript errors, zero import errors.

**Step 2: Dev server smoke test**

```bash
npm run dev
```

Open the browser, verify:
- [ ] Menu screen loads
- [ ] Can start a free game vs CPU
- [ ] Characters appear on 3D board
- [ ] Turn phases advance correctly

**Step 3: Check no old paths remain**

```bash
grep -r "from '@/store/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/data/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/utils/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/starknet/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/supabase/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/scene/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/canvas/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/audio/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
grep -r "from '@/hooks/" src && echo "STALE IMPORTS FOUND" || echo "Clean"
```

All should print `Clean`.

**Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: complete feature groups restructure"
```
