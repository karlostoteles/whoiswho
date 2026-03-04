# Phase 1 Review — WhoisWho On-Chain Contracts

> **Status:** Complete — 24/24 tests passing (`sozo test`)
> **Date:** 2026-03-03
> **Scope:** Cairo contracts + local test suite. No frontend changes.

---

## What Was Built

A fully trustless on-chain game engine for WhoisWho using Dojo on Starknet.

The core security primitive is **commit-reveal**: each player hashes their secret character with a random salt (`pedersen(character_id, salt)`) before the game starts, commits only the hash on-chain, then reveals at the end. The contract verifies the hash matches — nobody can switch characters after seeing the opponent's guess.

---

## File Map

```
contracts/src/
├── constants.cairo          Phase constants (u8) + timeout value
├── errors.cairo             All panic strings as felt252 constants
├── events.cairo             10 Dojo events (GameCreated → GameCompleted)
├── interfaces/
│   └── game_actions.cairo   IGameActions trait — 9 entrypoints
├── models/
│   └── game.cairo           4 Dojo models: Game, Commitment, Board, Turn
├── systems/
│   └── game_actions.cairo   Full implementation
└── tests/
    ├── setup.cairo          Test helpers (world bootstrap, player fixtures)
    └── test_game_flow.cairo 24 integration tests
```

---

## Models at a Glance

| Model | Key | Purpose |
|---|---|---|
| `Game` | `game_id` | Session state: players, phase, turn, timestamps, guess |
| `Commitment` | `(game_id, player)` | Pedersen hash commitment per player |
| `Board` | `(game_id, player)` | Elimination bitmap (u128, OR-accumulated) |
| `Turn` | `(game_id, turn_number)` | Immutable record of each question/guess |

---

## Phase State Machine

```
WAITING_FOR_PLAYER2 (0)
    │ join_game
    ▼
COMMIT_PHASE (1)
    │ both players commit
    ▼
P1_QUESTION_SELECT (2) ◄──────────────────────────┐
    │ ask_question                                   │
    ▼                                                │
P2_ANSWER_PENDING (3)                               │
    │ answer_question                                │
    ▼                                                │
P1_ELIMINATING (4)                                  │
    │ eliminate_characters                           │
    ▼                                                │
P2_QUESTION_SELECT (5)                              │
    │ ask_question                                   │
    ▼                                                │
P1_ANSWER_PENDING (6)                               │
    │ answer_question                                │
    ▼                                                │
P2_ELIMINATING (7) ─────────────────────────────────┘
    │
    │ (from any *_QUESTION_SELECT): make_guess
    ▼
REVEAL_PHASE (9)
    │ both players reveal_character
    ▼
COMPLETED (10)  ◄── also reachable via claim_timeout
```

---

## Entrypoints

| Function | Who calls | Phase required | Effect |
|---|---|---|---|
| `create_game` | anyone | — | Writes Game + Board for player1 |
| `join_game` | anyone (not player1) | WAITING_FOR_PLAYER2 | Writes player2, Board, → COMMIT_PHASE |
| `commit_character(hash)` | both players | COMMIT_PHASE | Stores hash; → P1_QUESTION_SELECT when both done |
| `ask_question(question_id)` | active player | *_QUESTION_SELECT | Records Turn; → *_ANSWER_PENDING |
| `answer_question(answer)` | non-active player | *_ANSWER_PENDING | Fills Turn.answer; → *_ELIMINATING |
| `eliminate_characters(bitmap)` | active player | *_ELIMINATING | OR-merges bitmap into Board; flips turn |
| `make_guess(character_id)` | active player | *_QUESTION_SELECT | Stores guess; → REVEAL_PHASE |
| `reveal_character(char, salt)` | both players | REVEAL_PHASE | Verifies pedersen; resolves winner when both revealed |
| `claim_timeout` | non-active player | any | Requires ≥45s elapsed; caller wins |

---

## Security Fixes Applied (P1 Bugs)

These bugs were caught during the compound review and fixed before tests were written.

### Bug 001 — Reveal verification missing
**Before:** `reveal_character` accepted any `(character_id, salt)` with no check.
**After:**
```cairo
assert(salt != 0, errors::ERR_INVALID_REVEAL);
let expected_hash = core::pedersen::pedersen(character_id, salt);
assert(expected_hash == commitment.hash, errors::ERR_INVALID_REVEAL);
```

### Bug 002 — Timeout auth missing for abandoned games
**Before:** Any address could call `claim_timeout` on an unjoined game and win.
**After:**
```cairo
if game.phase == constants::PHASE_WAITING_FOR_PLAYER2 {
    assert(caller == game.player1, errors::ERR_NOT_PLAYER);
    zero
}
```

### Bug 003 — Zero-hash commitment accepted
**Before:** `commit_character(game_id, 0)` was accepted, breaking reveal verification.
**After:**
```cairo
assert(commitment_hash != 0, errors::ERR_INVALID_COMMITMENT);
```

### Bug 004 — Bitmap replaced instead of OR-merged
**Before:** `board.eliminated_bitmap = eliminated_bitmap` — each call wiped the previous state.
**After:**
```cairo
board.eliminated_bitmap = board.eliminated_bitmap | eliminated_bitmap;
```

---

## Type Change: `felt252` → `u128` for Bitmap

`felt252` does not implement `BitOr` in Cairo — the `|` operator is unavailable. Changed:
- `Board.eliminated_bitmap: u128`
- `CharactersEliminated.eliminated_bitmap: u128`
- `IGameActions::eliminate_characters` parameter: `u128`

`u128` supports up to 128 characters per game, which is sufficient for Phase 1.

---

## Test Coverage (24 tests)

### Category breakdown

| Category | Tests | What's verified |
|---|---|---|
| Constants/hash sanity | 4 | Timeout = 45s, phase ordering, Pedersen determinism |
| Happy path | 2 | P1 correct guess wins; P1 wrong guess → P2 wins |
| Turn enforcement | 2 | Wrong player asks/answers → panic |
| Phase enforcement | 2 | Answer before question; commit after commit phase |
| Commit guards | 2 | Double commit; zero-hash commit |
| Reveal guards | 3 | Wrong character; wrong salt; zero salt |
| Bitmap monotonicity | 2 | OR-accumulates; zero send is no-op |
| Timeout | 4 | Abandoned game; mid-game; self-claim blocked; premature claim |
| Join guards | 2 | Join own game; join full game |

### How to run

```bash
sozo test          # runs scarb cairo-test under the hood
```

---

## Known Gotchas for Future Work

### `should_panic` + Dojo dispatcher
Dojo wraps contract panics: the actual panic data is `('ERROR_CODE', 'ENTRYPOINT_FAILED')`.
`#[should_panic(expected: ('ERROR_CODE',))]` **will not match** — use bare `#[should_panic]` instead.

### `sozo test` was self-referencing
`Scarb.toml` had `[scripts] test = "sozo test"` — infinite loop.
Fixed to `test = "scarb cairo-test"`.

### Bitmap type
The plan specified `felt252`; changed to `u128` for bitwise ops. If >128 characters per game are needed in a future phase, migrate to two `u128` fields or a `Span<felt252>`.

---

## What's Next (Phase 2)

1. **Katana local deploy:** `katana --dev --dev.no-fee` + `sozo migrate`
2. **Starkzap wallet:** Replace raw `@cartridge/controller` in `src/services/starknet/sdk.ts`
3. **dojo.js client:** `src/services/dojo/` module — SDK init, action hooks, Torii subscriptions
4. **Online rewire:** `useOnlineGameSync.ts` and `OnlineLobbyScreen.tsx` from Supabase → Dojo

See the full plan: `docs/plans/2026-03-03-feat-dojo-onchain-game-logic-plan.md`
