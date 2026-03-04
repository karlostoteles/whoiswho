---
title: "feat: Private Online Game with Dojo + Noir + Garaga"
type: feat
status: active
date: 2026-03-03
---

# feat: Private Online Game with Dojo + Noir + Garaga

## Objective

Ship an online mode where:
1. Players cannot change secret character (`commit-reveal`).
2. Players cannot lie in per-turn answers (ZK proof per answer).
3. Game remains responsive with Torii sync and clear proving UX.

## Non-Goals (V1)

- No anonymous identity layer (Semaphore/Sumo out of scope).
- No custom dispute mechanism beyond proof verification and standard game rules.

## Problem Statement

Current online logic does not enforce truthfulness per answer.
Even with commit-reveal, a player could still lie during the game unless each answer is proven.

## Proposed Architecture

- Dojo = game state machine and enforcement.
- Noir = answer-correctness circuit.
- Garaga = on-chain verifier generation/verification.
- Starkzap = wallet/session execution.
- Torii = real-time sync to Zustand/UI.

## Canonical Private Flow

1. `create_game` / `join_game`
2. both players `commit_character` with:
   - `pedersen(game_id, player, character_id, salt)`
3. active player `ask_question(question_id)`
4. responder generates ZK proof locally (or trusted proving service)
5. responder calls `answer_question_with_proof(game_id, turn_id, proof, public_inputs)`
6. contract verifies proof, reads `computed_answer` from proof output, then stores answer and advances phase
7. elimination + next turn
8. guess + dual reveal + finalize winner
9. timeout path remains 45 seconds

## Circuit Spec (V1)

### Public Inputs
- `game_id`
- `turn_id`
- `player`
- `commitment`
- `question_id`
- `traits_root`

### Private Inputs
- `character_id`
- `salt`
- `trait_bitmap`
- `merkle_path`

### Constraints
1. commitment binding:
   - `pedersen(game_id, player, character_id, salt) == commitment`
2. traits membership:
   - `(character_id, trait_bitmap)` belongs to `traits_root`
3. question correctness:
   - circuit computes and outputs `computed_answer = evaluate(question_id, trait_bitmap)`
4. anti-replay binding:
   - proof includes `turn_id` and current `question_id`, matched on-chain before state update

## Implementation Stages

### Stage 1: Question + Traits Canonicalization

- [ ] Define canonical question registry (`question_id -> predicate spec`).
- [ ] Define canonical trait encoding (`trait_bitmap` schema).
- [ ] Build deterministic character leaf format and Merkle tree procedure.
- [ ] Publish `traits_root` derivation script and test vectors.

**Success criteria:**
- Same question and traits dataset produces identical `traits_root` across machines.

### Stage 2: Noir Circuit + Verifier Pipeline

- [ ] Create Noir project for `answer_with_commitment`.
- [ ] Implement constraints for commitment + membership + answer.
- [ ] Generate vk/proof flow with pinned toolchain.
- [ ] Generate Cairo verifier via Garaga and compile verifier project.
- [ ] Add fixture proofs (valid and invalid).

**Success criteria:**
- Local valid proof verifies.
- Invalid answer proof fails.

### Stage 3: Dojo Contract Integration

- [ ] Add verifier contract address/config to Dojo environment.
- [ ] Add `answer_question_with_proof` entrypoint in `game_actions`.
- [ ] Enforce proof verification before persisting answers.
- [ ] Decode `computed_answer` from verified proof output and persist that value.
- [ ] Keep existing turn/phase/timeout checks.
- [ ] Update events for proof-verified answers.

**Success criteria:**
- No answer state update is possible without valid proof.

### Stage 4: Client Integration (Starkzap + Dojo + Proving)

- [ ] Add client-side proof generation pipeline for answer action.
- [ ] Include clear UI states: `PROVING`, `SUBMITTING`, `VERIFIED`.
- [ ] Integrate `answer_question_with_proof` into online flow.
- [ ] Keep Torii sync bridge and refresh recovery.

**Success criteria:**
- Two players complete private game without revealing secret characters mid-game.

### Stage 5: Hardening + E2E

- [ ] Full integration tests (happy path + invalid proof + wrong phase + timeout).
- [ ] Performance pass (proof generation UX and tx latency budget).
- [ ] Security pass on verifier call boundaries and replay resistance.
- [ ] Mainnet/sepolia deployment checklist and runbook.

**Success criteria:**
- End-to-end private match is stable and verifiably truthful.

## Contract API (Target)

- `create_game`
- `join_game`
- `commit_character`
- `ask_question`
- `answer_question_with_proof` (new)
- `eliminate_characters`
- `make_guess`
- `reveal_character`
- `claim_timeout`

## Data/Schema Additions

- `Game.traits_root`
- `Game.question_set_id`
- `Turn.proof_verified` (or equivalent event-driven marker)

## Acceptance Criteria

- [ ] Commit-reveal prevents character switching.
- [ ] Every accepted answer has a valid on-chain verified proof.
- [ ] No plaintext trait data is published on-chain.
- [ ] Timeout remains fixed at 45 seconds.
- [ ] Full online game works with Torii sync and wallet UX.

## Risks and Mitigations

- **Proof latency too high**:
  - mitigate with explicit proving UI and async handling.
- **Version mismatch between Noir/bb/Garaga**:
  - mitigate by pinning exact versions and CI version checks.
- **Question encoding ambiguity**:
  - mitigate with canonical registry and deterministic predicate encoding.

## Execution Workflow (No Commit/PR Without Permission)

1. Work stage-by-stage in order.
2. Validate each stage with runnable checks/tests before moving on.
3. Do not create commits or PRs unless user explicitly asks.

## References

- `/Users/gianfranco/projects/whoiswho/docs/DOJO_ONCHAIN_REFERENCE.md`
- `/Users/gianfranco/projects/tu-vaca/docs/plans/2026-03-03-garaga-fundraising-threshold-proof.md`
- `/Users/gianfranco/projects/tu-vaca/docs/p2p-private/STARKNET_PRIVACY_TECHNICAL_DOC.md`
- https://espejel.bearblog.dev/starknet-privacy-toolkit/
