# Dojo Integration & Privacy Audit
## guessNFT 

This document serves as an architectural index and integration guide for replacing the current local state engine with a **Dojo-based Starknet backend** and **zero-knowledge/privacy** extensions.

### 1. Current State Engine (`src/core/store/gameStore.ts`)
The entire game flow is currently managed by a synchronous Zustand store (`useGameStore`). 
- **Phases:** The game cycles through `GamePhase` states (e.g., `QUESTION_SELECT`, `ANSWER_REVEALED`, `GUESS_SELECT`).
- **Simultaneous Action:** In `free` and `nft-free` modes, player and CPU act simultaneously. In `online` mode, the current implementation relies on a centralized/P2P sync layer (not fully detailed here, but presumed to wrap the store).
- **Integration Target:** To integrate Dojo, you will need to replace the local state mutations inside `gameStore.ts` (like `askQuestion`, `answerQuestion`, `makeGuess`) with **Dojo Torii subscriptions** and **System calls**. The Zustand store should transition from being the "source of truth" to being a local mirror of the Torii indexer state.

### 2. Commit-Reveal Mechanics (`src/services/starknet/commitReveal.ts`)
Currently, `guessNFT` uses a local cryptographic commit-reveal scheme to simulate hidden information without an active backend contract:
- **Commit:** When a player picks a secret character (`selectSecretCharacter`), we generate a cryptographically secure 32-byte salt and compute the `starknet.js` JS implementation of the Pedersen hash: `hash(character_id_felt, salt)`.
- **Storage:** The `Commitment` (containing the plain text character and salt) is currently stored in `localStorage`.
- **Integration Target (Privacy):** The new privacy integration should deprecate `commitReveal.ts`. Instead of a Pedersen hash stored locally, you will likely implement an encrypted on-chain state mechanism (e.g., passing proofs or utilizing a dedicated privacy layer on top of Dojo). If maintaining commit-reveal on Dojo, the `createCommitment` function's logic can be ported to your Dojo system to handle the Stark curve hashing natively.

### 3. Edge Cases to Watch For
- **Simultaneous Turns ("Risk It" Penalty):** In local/free mode, if a player guesses wrong ("Risks it" and fails), the CPU gets a "free question." In a purely asynchronous on-chain model, managing this penalty turn sequence (`GUESS_WRONG` -> `ANSWER_REVEALED` -> `AUTO_ELIMINATING`) requires careful state management to ensure block-time latency doesn't break the UX flow.
- **Card Elimination ("Auto-Elimination"):** The game automatically knocks down cards (`AUTO_ELIMINATING` phase) based on the attributes of the current question. If your Dojo model does not perform this auto-elimination on-chain to save gas, the client must consistently compute the exact same array of remaining characters from the `QUESTION` events.

### 4. Controller Setup (`src/services/starknet/sdk.ts`)
The Cartridge Controller is injected in `sdk.ts`. The implementation correctly uses `starknet.js` and targets SN Mainnet. When switching to Dojo, you will likely need to inject the Dojo `burner` wallets for local development and then bridge the Controller via the Katana sequencer using the presets in `.agents/skills/controller-*`.

### Summary
The repository is strictly typed with `tsc` and ready for branch-off. The immediate work involves gutting `gameStore.ts` reducers to wrap `client.execute()` calls to your deployed Dojo Torii worlds. 
