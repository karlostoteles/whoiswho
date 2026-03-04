---
title: "feat: ZK-Private Online Game — Complete Implementation Plan"
type: feat
status: active
date: 2026-03-04
supersedes: 2026-03-03-feat-dojo-onchain-game-logic-plan.md
---

# feat: ZK-Private Online Game — Complete Implementation Plan

## Overview

Full implementation of verifiable private gameplay using Noir + Barretenberg + Garaga on Starknet/Dojo.
Players cannot lie about answers because every answer must carry a ZK proof of correctness.
The proof hides the secret character while mathematically guaranteeing the answer is true.

**Current baseline (done before this plan):**
- Dojo state machine: 9 entrypoints, 4 models, 24 passing tests
- Commit-reveal on Cairo: `pedersen(game_id, player, character_id, salt)` verified on reveal
- Commit-reveal on frontend: local Phase 1 (Phase 2 stubs ready)
- SCHIZODIO NFT loading, Cartridge wallet, Supabase online sync — all working

**What this plan adds:** Truthfulness enforcement per answer via ZK proof.

---

## Architecture Recap

```
SCHIZODIO metadata
    │ prepare-collection script (Stage 1)
    ▼
trait_bitmap per character + Merkle tree → traits_root (stored in Game model)
    │
    ▼ Circuit constraints (Stage 2)
┌────────────────────────────────────────────────────────────────────┐
│  NOIR CIRCUIT: answer_with_commitment                              │
│  Public:  game_id, turn_id, player, commitment, question_id,       │
│           traits_root                                              │
│  Private: character_id, salt, trait_bitmap, merkle_path[10]        │
│  Output:  computed_answer (u1) — the ONLY accepted answer          │
└────────────────────────────────────────────────────────────────────┘
    │ nargo build → bytecode
    │ bb write_vk → verification key
    │ garaga gen → Cairo verifier contract
    ▼
Starknet verifier contract (0xVERIFIER_ADDRESS) — deployed once
    │
    ▼ Dojo integration (Stage 3)
answer_question_with_proof(game_id, proof, public_inputs)
    → calls garaga_verifier.verify()
    → reads computed_answer from proof output
    → persists verified answer in Turn model
    │
    ▼ Client integration (Stage 4)
generateAnswerProof(publicInputs, privateInputs) — runs in Web Worker
    → UI states: PROVING → SUBMITTING → VERIFIED
```

---

## Toolchain Pinned Versions

| Tool | Version | Role |
|---|---|---|
| nargo | `1.0.0-beta.16` | Compiles Noir circuit, executes witness |
| bb (Barretenberg) | resolved by `bbup --nargo-version 1.0.0-beta.16` | Generates verification key + proofs |
| garaga (pip) | `1.0.1` | Generates Cairo verifier contract |
| garaga (npm) | `1.0.1` | Formats calldata for contract calls |
| Cairo | `2.12.1` | Contract language |
| Dojo | `v1.7.0-alpha.2` | Game state machine framework |

> **Critical:** All three tools must version-match. `bb` uses `ultra_honk` + `oracle_hash keccak`.
> Garaga uses `--system ultra_keccak_zk_honk`. Any mismatch = silent verification failure.

---

## SCHIZODIO Trait Schema

The collection uses 14 trait types. Each NFT JSON looks like:

```
https://v1assets.schizod.io/json/revealed/{id}.json
```

Example `attributes` array (NFT #0):
```json
[
  { "trait_type": "Background",  "value": "Richard Haynes Boardwalk" },
  { "trait_type": "Body",        "value": "Snowflake" },
  { "trait_type": "Mask",        "value": "No Mask" },
  { "trait_type": "Mouth",       "value": "Happy" },
  { "trait_type": "Eyes",        "value": "Dead Splash" },
  { "trait_type": "Eyebrows",    "value": "Purple Camo" },
  { "trait_type": "Hair",        "value": "Purple Pompadour" },
  { "trait_type": "Eyewear",     "value": "No Eyewear" },
  { "trait_type": "Clothing",    "value": "Apestar Jacket" },
  { "trait_type": "Headwear",    "value": "Frieza Helmet" },
  { "trait_type": "Weapons",     "value": "Man Hunt Bat" },
  { "trait_type": "Sidekick",    "value": "Randall" },
  { "trait_type": "Accessories", "value": "No Accessories" },
  { "trait_type": "Overlays",    "value": "No Overlay" }
]
```

**Note on mock data:** Stages 0–4 use a deterministic mock generator (no IPFS).
Stage 5 replaces the mock with real fetched data and recomputes everything.

---

## Stage 0: Toolchain Setup & Verification

**Agent scope:** Standalone — no code dependencies, can run first.

### 0.1 Install nargo

```bash
# Install noirup (Noir version manager)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
source ~/.bashrc  # or ~/.zshrc

# Install pinned version
noirup --version 1.0.0-beta.16

# Verify
nargo --version
# Expected: nargo version = 1.0.0-beta.16 (exact)
```

### 0.2 Install Barretenberg (bb)

```bash
# Install bbup (bb version manager)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/scripts/bbup.sh | bash
source ~/.bashrc

# Install bb version compatible with nargo 1.0.0-beta.16
# (bbup resolves the exact compatible nightly automatically)
bbup --nargo-version 1.0.0-beta.16

# Verify
bb --version
# Expected: the nightly resolved by bbup for nargo 1.0.0-beta.16
# (typically v3.0.0-nightly.20251104 or equivalent — do NOT hardcode the bb version)
```

### 0.3 Install Garaga (Python)

```bash
pip install garaga==1.0.1

# Verify
pip show garaga | grep Version
# Expected: Version: 1.0.1
```

### 0.4 Install Garaga (npm)

```bash
cd /Users/gianfranco/projects/whoiswho
npm install garaga@1.0.1 @aztec/bb.js

# Verify
node -e "require('garaga'); console.log('garaga npm ok')"
```

> **garaga Python vs garaga npm — roles are different:**
> - **garaga Python**: dev-time tool. `garaga gen` generates the Cairo verifier contract.
>   `garaga deploy` deploys it. Run these once. No role at game runtime.
> - **garaga npm**: runtime library. Its single job is `getZKHonkCallData(proof, publicInputs, vk)`
>   which converts Barretenberg's raw proof bytes into the `Span<felt252>` format (with elliptic
>   curve hints) that the deployed Cairo verifier contract expects. Without it you'd need to
>   manually implement the proof serialization. No `init()` needed — WASM loads automatically.
> - **@aztec/bb.js**: needed separately for `poseidon2Hash` in the preparation scripts.
>   Also used internally by `@noir-lang/backend_barretenberg`.

### 0.5 Verify Starknet tooling

```bash
# Scarb (Cairo package manager — for verifier compilation)
scarb --version
# Expected: 2.x.x compatible with Cairo 2.12.1

# sozo (Dojo deployer — already working from Phase 1)
sozo --version
```

**Stage 0 success criteria:**
- [ ] `nargo --version` = `1.0.0-beta.16`
- [ ] `bb --version` = `0.82.2`
- [ ] `pip show garaga | grep Version` = `1.0.1`
- [ ] `garaga npm` resolves without error

---

## Stage 1: Question Registry + Traits Canonicalization

**Agent scope:** Pure TypeScript. No Starknet, no Noir. Uses mock data.
**Outputs:** `scripts/prepare-collection.ts`, `public/collections/mock.json`, `traits_root` value, test vectors.

### 1.1 Define Canonical Question Schema

Create `scripts/question-schema.ts`:

```typescript
// scripts/question-schema.ts
// One source of truth for question_id → predicate mapping.
// NEVER change the order — changing breaks the circuit.

export type QuestionPredicate = (attrs: Record<string, string>) => boolean;

export const QUESTION_SCHEMA: Record<number, {
  label: string;
  predicate: QuestionPredicate;
}> = {
  0:  { label: 'has_mask',        predicate: (a) => a['Mask'] !== 'No Mask' },
  1:  { label: 'has_eyewear',     predicate: (a) => a['Eyewear'] !== 'No Eyewear' },
  2:  { label: 'has_accessories', predicate: (a) => a['Accessories'] !== 'No Accessories' },
  3:  { label: 'has_overlay',     predicate: (a) => a['Overlays'] !== 'No Overlay' },
  4:  { label: 'mouth_happy',     predicate: (a) => a['Mouth'] === 'Happy' },
  5:  { label: 'hair_purple',     predicate: (a) => a['Hair']?.includes('Purple') ?? false },
  6:  { label: 'hair_blue',       predicate: (a) => a['Hair']?.includes('Blue') ?? false },
  7:  { label: 'hair_red',        predicate: (a) => a['Hair']?.includes('Red') ?? false },
  8:  { label: 'hair_black',      predicate: (a) => a['Hair']?.includes('Black') ?? false },
  9:  { label: 'body_snowflake',  predicate: (a) => a['Body'] === 'Snowflake' },
  // Slots 10–127 reserved for future questions (u128 supports up to 128 bits)
};

export const QUESTION_COUNT = Object.keys(QUESTION_SCHEMA).length; // 10 for now

// Derive trait_bitmap for a given attributes record
export function computeBitmap(attrs: Record<string, string>): bigint {
  let bitmap = 0n;
  for (const [bitPos, { predicate }] of Object.entries(QUESTION_SCHEMA)) {
    if (predicate(attrs)) {
      bitmap |= (1n << BigInt(bitPos));
    }
  }
  return bitmap;
}
```

**Why this order matters:** The `question_id` passed to the circuit directly maps to a bit position in `trait_bitmap`. The Noir circuit does `(trait_bitmap >> question_id) & 1`. If the order ever changes, the verifier contract becomes invalid and must be redeployed.

### 1.2 Create Mock Collection Generator

Create `scripts/mock-collection.ts`:

```typescript
// scripts/mock-collection.ts
// Generates deterministic fake SCHIZODIO data for stages 0-4.
// Replace with real fetch in Stage 5.

import { computeBitmap } from './question-schema';

const TRAIT_VALUES = {
  Mask:        ['No Mask', 'Gas Mask', 'Plague Doctor', 'Anonymous'],
  Eyewear:     ['No Eyewear', 'Round Glasses', 'Sunglasses', 'Monocle'],
  Accessories: ['No Accessories', 'Gold Chain', 'Dog Tag', 'Pocket Watch'],
  Overlays:    ['No Overlay', 'Glitch', 'Matrix', 'Fire'],
  Mouth:       ['Happy', 'Sad', 'Angry', 'Neutral', 'Smirk'],
  Hair:        ['Purple Pompadour', 'Blue Mohawk', 'Red Afro', 'Black Dreads', 'Bald'],
  Body:        ['Snowflake', 'Classic', 'Glitch', 'Neon'],
  Background:  ['Richard Haynes Boardwalk', 'Void', 'City', 'Desert'],
  Eyes:        ['Dead Splash', 'Laser', 'Normal', 'Cyclops'],
  Eyebrows:    ['Purple Camo', 'Normal', 'Thick', 'Thin'],
  Clothing:    ['Apestar Jacket', 'Hoodie', 'Suit', 'Trench'],
  Headwear:    ['Frieza Helmet', 'Crown', 'Cap', 'Beanie'],
  Weapons:     ['Man Hunt Bat', 'Katana', 'Laser Gun', 'None'],
  Sidekick:    ['Randall', 'None', 'Cat', 'Robot'],
};

function pickDeterministic<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function generateMockNFT(id: number): { id: number; name: string; attrs: Record<string, string> } {
  const attrs: Record<string, string> = {};
  let seed = id;
  for (const [traitType, values] of Object.entries(TRAIT_VALUES)) {
    attrs[traitType] = pickDeterministic(values, seed);
    seed = (seed * 31 + 7) % 997; // deterministic hash
  }
  return { id, name: `Schizodio #${id}`, attrs };
}
```

### 1.3 Build Merkle Tree Library

Create `scripts/merkle.ts`:

```typescript
// scripts/merkle.ts
// Poseidon2-BN254 Merkle tree for character membership proofs.
// IMPORTANT: must use @aztec/bb.js — the SAME Poseidon2 as the Noir circuit.
// starknet.js Poseidon is over the Stark field (different curve) and will
// produce different hashes. Never mix these two.

import { BarretenbergSync } from '@aztec/bb.js';

const ZERO_LEAF = 0n;

let _bb: BarretenbergSync | null = null;
async function getBb(): Promise<BarretenbergSync> {
  if (!_bb) _bb = await BarretenbergSync.new();
  return _bb;
}

// Poseidon2 over BN254 — matches std::hash::poseidon2::Poseidon2 in Noir
async function poseidon2Hash(a: bigint, b: bigint): Promise<bigint> {
  const bb = await getBb();
  return bb.poseidon2Hash([a, b]);
}

export async function computeLeaf(characterId: bigint, bitmap: bigint): Promise<bigint> {
  return poseidon2Hash(characterId, bitmap);
}

export interface MerkleTree {
  root: bigint;
  getPath(leafIndex: number): { siblings: bigint[]; isLeft: boolean[] };
}

export async function buildMerkleTree(leaves: bigint[], treeSize: number): Promise<MerkleTree> {
  if (treeSize & (treeSize - 1)) throw new Error('treeSize must be a power of 2');

  // Pad with zero leaves to treeSize
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < treeSize) {
    paddedLeaves.push(ZERO_LEAF);
  }

  // Build bottom-up layer array
  const layers: bigint[][] = [paddedLeaves];
  while (layers[layers.length - 1].length > 1) {
    const current = layers[layers.length - 1];
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(await poseidon2Hash(current[i], current[i + 1]));
    }
    layers.push(next);
  }

  const root = layers[layers.length - 1][0];

  function getPath(leafIndex: number) {
    const siblings: bigint[] = [];
    const isLeft: boolean[] = [];
    let idx = leafIndex;
    for (let depth = 0; depth < layers.length - 1; depth++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      siblings.push(layers[depth][siblingIdx]);
      isLeft.push(idx % 2 === 0);
      idx = Math.floor(idx / 2);
    }
    return { siblings, isLeft };
  }

  return { root, getPath };
}

// Verify a merkle path (for testing)
export async function verifyPath(
  leaf: bigint,
  leafIndex: number,
  siblings: bigint[],
  isLeft: boolean[],
  expectedRoot: bigint
): Promise<boolean> {
  let current = leaf;
  for (let i = 0; i < siblings.length; i++) {
    current = isLeft[i]
      ? await poseidon2Hash(current, siblings[i])
      : await poseidon2Hash(siblings[i], current);
  }
  return current === expectedRoot;
}
```

### 1.4 Write Collection Preparation Script

Create `scripts/prepare-collection.ts`:

```typescript
// scripts/prepare-collection.ts
// Run: npx tsx scripts/prepare-collection.ts [mock|real]
// Outputs: public/collections/mock.json (or {address}.json for real)

import { writeFileSync, mkdirSync } from 'fs';
import { generateMockNFT } from './mock-collection';
import { computeBitmap, QUESTION_SCHEMA } from './question-schema';
import { buildMerkleTree, computeLeaf } from './merkle';

const TOTAL = 999;
const TREE_SIZE = 1024; // next power of 2 above 999 → depth = 10

async function main(mode: 'mock' | 'real' = 'mock') {
  console.log(`Preparing collection in ${mode} mode...`);

  // Step 1: Load NFT data
  const nfts = mode === 'mock'
    ? Array.from({ length: TOTAL }, (_, i) => generateMockNFT(i))
    : await fetchRealCollection(); // implemented in Stage 5

  // Step 2: Compute bitmaps
  const bitmaps = nfts.map(nft => computeBitmap(nft.attrs));
  console.log(`Sample bitmaps: ${bitmaps.slice(0, 5).map(b => b.toString()).join(', ')}`);

  // Step 3: Build Merkle tree
  const leaves = bitmaps.map((bitmap, id) =>
    computeLeaf(BigInt(id), bitmap)
  );
  const tree = buildMerkleTree(leaves, TREE_SIZE);
  const traitsRoot = tree.root;
  console.log(`traits_root: 0x${traitsRoot.toString(16)}`);
  console.log('→ Save this value in the Dojo contract as the collection traits_root.');

  // Step 4: Pre-compute merkle_path for every character
  const characters = nfts.map((nft, id) => {
    const { siblings, isLeft } = tree.getPath(id);
    return {
      id,
      name: nft.name,
      bitmap: bitmaps[id].toString(),
      merkle_path: siblings.map(s => '0x' + s.toString(16)),
      merkle_path_is_left: isLeft,
    };
  });

  // Step 5: Output JSON
  const dataset = {
    mode,
    total: TOTAL,
    tree_size: TREE_SIZE,
    tree_depth: 10,
    traits_root: '0x' + traitsRoot.toString(16),
    question_schema: Object.fromEntries(
      Object.entries(QUESTION_SCHEMA).map(([k, v]) => [k, v.label])
    ),
    characters,
  };

  mkdirSync('public/collections', { recursive: true });
  const outFile = mode === 'mock'
    ? 'public/collections/mock.json'
    : `public/collections/schizodio.json`;

  writeFileSync(outFile, JSON.stringify(dataset, null, 2));
  console.log(`✓ Written: ${outFile} (${Math.round(JSON.stringify(dataset).length / 1024)}KB)`);
  console.log(`✓ traits_root to paste into dojo config: 0x${traitsRoot.toString(16)}`);
}

main(process.argv[2] as 'mock' | 'real' ?? 'mock');
```

### 1.5 Generate Test Vectors

Create `scripts/test-vectors.ts`:

```typescript
// scripts/test-vectors.ts
// Generates fixture inputs for Noir circuit testing.
// Output: circuits/whoiswho_answer/Prover.toml (test witness)
//
// IMPORTANT: ALL hashing uses @aztec/bb.js (Poseidon2 BN254) to match the Noir circuit.
// Never use starknet.js hash functions here — different field, different outputs.

import { computeBitmap } from './question-schema';
import { buildMerkleTree, computeLeaf } from './merkle';
import { generateMockNFT } from './mock-collection';
import { BarretenbergSync } from '@aztec/bb.js';
import { writeFileSync } from 'fs';

const TOTAL = 999;
const TREE_SIZE = 1024;

// Reproducible salt for test vectors
const TEST_SALT = 0x1234567890abcdefn;
const TEST_GAME_ID = 0x42n;
const TEST_TURN_ID = 0x5n;
const TEST_PLAYER  = 0xdeadbeef1234n;
const TEST_CHARACTER_ID = 42; // Carlos-equivalent

async function main() {
  // Build tree with mock data
  const nfts = Array.from({ length: TOTAL }, (_, i) => generateMockNFT(i));
  const bitmaps = nfts.map(nft => computeBitmap(nft.attrs));
  const leaves = bitmaps.map((b, id) => computeLeaf(BigInt(id), b));
  const tree = buildMerkleTree(leaves, TREE_SIZE);
  const traitsRoot = tree.root;

  // Pick test character
  const characterId = BigInt(TEST_CHARACTER_ID);
  const bitmap = bitmaps[TEST_CHARACTER_ID];
  const { siblings } = tree.getPath(TEST_CHARACTER_ID);

  // Compute commitment: poseidon2([game_id, player, character_id, salt]) — BN254
  // Must use @aztec/bb.js to match what the Noir circuit computes.
  const bb = await BarretenbergSync.new();
  const commitment = bb.poseidon2Hash([TEST_GAME_ID, TEST_PLAYER, characterId, TEST_SALT]);

  // Pick question: question_id=0 (has_mask)
  const questionId = 0;
  const expectedAnswer = (bitmap >> BigInt(questionId)) & 1n;

  console.log('Test vector:');
  console.log(`  character_id:    ${characterId}`);
  console.log(`  bitmap:          ${bitmap} (binary: ${bitmap.toString(2)})`);
  console.log(`  question_id:     ${questionId} (has_mask)`);
  console.log(`  expected_answer: ${expectedAnswer}`);
  console.log(`  traits_root:     0x${traitsRoot.toString(16)}`);
  console.log(`  commitment:      0x${commitment.toString(16)}`);

  // Write Prover.toml
  const proverToml = `
# Test witness for WhoisWho answer circuit
# Generated by scripts/test-vectors.ts

# === Public inputs ===
game_id     = "${TEST_GAME_ID}"
turn_id     = "${TEST_TURN_ID}"
player      = "${TEST_PLAYER}"
commitment  = "${commitment}"
question_id = ${questionId}
traits_root = "${traitsRoot}"

# === Private inputs ===
character_id = "${characterId}"
salt         = "${TEST_SALT}"
trait_bitmap = ${bitmap}
merkle_path  = [${siblings.map(s => '"' + s + '"').join(', ')}]
`.trim();

  writeFileSync('circuits/whoiswho_answer/Prover.toml', proverToml);
  console.log('✓ Written: circuits/whoiswho_answer/Prover.toml');
}

main();
```

**Stage 1 success criteria:**
- [x] `npx tsx scripts/prepare-collection.ts mock` completes without error
- [x] `public/collections/mock.json` exists and contains 999 characters
- [x] Each character has `bitmap`, `merkle_path` (10 elements), `merkle_path_is_left` (10 bools)
- [x] All merkle paths verify: `verifyPath(leaf, idx, siblings, isLeft, traitsRoot)` returns true for all 999
- [x] Test vectors written to `circuits/whoiswho_answer/Prover.toml`
- [x] Same script produces identical `traits_root` on re-run (deterministic)

---

## Stage 2: Noir Circuit + Verifier Pipeline

**Agent scope:** Requires Stage 0 (toolchain) and Stage 1 (test vectors). No Starknet deployment.
**Outputs:** compiled circuit bytecode, verification key, Garaga Cairo verifier project.

### 2.1 Create Noir Project

```bash
mkdir -p circuits
cd circuits
nargo new whoiswho_answer
# Creates: circuits/whoiswho_answer/Nargo.toml + src/main.nr
```

Update `circuits/whoiswho_answer/Nargo.toml`:

```toml
[package]
name = "whoiswho_answer"
type = "bin"
authors = []
compiler_version = ">=1.0.0-beta.16"

[dependencies]
std = { git = "https://github.com/noir-lang/noir", tag = "v1.0.0-beta.16", directory = "noir_stdlib" }
```

### 2.2 Implement Merkle Verify Helper

Create `circuits/whoiswho_answer/src/merkle.nr`:

```noir
// circuits/whoiswho_answer/src/merkle.nr
// Recomputes the Merkle root from a leaf + path.
// The `index` parameter encodes the left/right direction at each level.
//
// Uses Poseidon2 (BN254) — must match @aztec/bb.js poseidon2Hash() in the JS scripts.
// Do NOT use dep::std::hash::pedersen_hash here — that is also BN254 Pedersen but the
// JS equivalent requires a different @aztec/bb.js call. Poseidon2 is simpler to match.

use std::hash::poseidon2::Poseidon2;

// Verify a Merkle path and return the computed root.
// index: the leaf's position in the tree (bit 0 = direction at depth 0, etc.)
pub fn merkle_verify(
    leaf:       Field,
    index:      Field,  // leaf index (used to derive left/right at each level)
    path:       [Field; 10],
) -> Field {
    let mut current = leaf;
    let index_bits = index.to_le_bits(10);  // 10 bits for depth 10 tree (1024 leaves)

    for i in 0..10 {
        let sibling = path[i];
        // If this node is a left child (bit=0), hash(current, sibling)
        // If this node is a right child (bit=1), hash(sibling, current)
        current = if index_bits[i] == 0 {
            Poseidon2::hash([current, sibling], 2)
        } else {
            Poseidon2::hash([sibling, current], 2)
        };
    }

    current
}
```

### 2.3 Implement Main Circuit

Create `circuits/whoiswho_answer/src/main.nr`:

```noir
// circuits/whoiswho_answer/src/main.nr
// WhoisWho answer-correctness circuit.
//
// Proves:
// 1. The answerer committed to this character (commitment binding)
// 2. The character's bitmap belongs to the official collection (Merkle membership)
// 3. The answer is what the bitmap actually says (question correctness)
// 4. This proof is bound to this specific game turn (anti-replay via public inputs)
//
// The character identity is NEVER revealed on-chain.

mod merkle;
use std::hash::poseidon2::Poseidon2;

fn main(
    // ── PUBLIC INPUTS ────────────────────────────────────────────
    // Everything here appears in the transaction. All public.
    game_id:      pub Field,   // ID of the game session
    turn_id:      pub Field,   // Current turn number (anti-replay)
    player:       pub Field,   // Starknet address of the answerer
    commitment:   pub Field,   // pedersen(game_id, player, character_id, salt)
    question_id:  pub u8,      // Index of the question asked (maps to a bit in trait_bitmap)
    traits_root:  pub Field,   // Merkle root of the official character collection

    // ── PRIVATE INPUTS ───────────────────────────────────────────
    // These NEVER leave the player's device. Mathematically hidden.
    character_id: Field,       // Which of the 999 NFTs the player chose
    salt:         Field,       // Random blinding factor from commit phase
    trait_bitmap: u128,        // Packed trait attributes (bit N = answer to question_id N)
    merkle_path:  [Field; 10], // Sibling hashes from leaf to root (depth=10 for 1024-leaf tree)
) -> pub u1 {                  // OUTPUT: computed_answer (0=No, 1=Yes) — public

    // ── Constraint 1: Commitment binding ─────────────────────────
    // The commitment on-chain was made with THIS exact character and salt.
    // If the player tries to use a different character_id, this assert fails
    // and the proof cannot be generated.
    // Uses Poseidon2 (BN254) — JS side uses bb.poseidon2Hash([game_id, player, char_id, salt])
    let expected_commitment = Poseidon2::hash([game_id, player, character_id, salt], 4);
    assert(expected_commitment == commitment);

    // ── Constraint 2: Merkle membership ──────────────────────────
    // The (character_id, trait_bitmap) pair is a valid leaf in the official
    // character set. If the player fabricates trait_bitmap values, the
    // computed root will not match traits_root and the assert fails.
    // Uses Poseidon2 (BN254) — JS side uses bb.poseidon2Hash([character_id, bitmap])
    let leaf = Poseidon2::hash([character_id, trait_bitmap as Field], 2);
    let computed_root = merkle::merkle_verify(leaf, character_id, merkle_path);
    assert(computed_root == traits_root);

    // ── Constraint 3: Answer correctness ─────────────────────────
    // The answer is derived directly from trait_bitmap using the question_id.
    // question_id is a public input — the contract checks it matches the
    // question recorded in the Turn model.
    //
    // Example: question_id=0 (has_mask), bitmap=0b0000_0001 (bit 0 is set)
    //   → (bitmap >> 0) & 1 = 1 → answer = Yes
    let shifted = (trait_bitmap >> (question_id as u128));
    let answer_bit = (shifted & 1) as u1;

    // ── Constraint 4: Anti-replay ────────────────────────────────
    // game_id and turn_id are public inputs already bound into the proof.
    // The Dojo contract checks that these match the current game state
    // before accepting the proof. A proof generated for turn 3 cannot
    // be replayed in turn 7 because the contract rejects mismatched turn_ids.
    // No additional constraint needed here — binding is via public inputs.

    answer_bit  // return the computed answer as the circuit's public output
}
```

### 2.4 Copy Test Vectors and Execute Witness

```bash
cd circuits/whoiswho_answer

# Copy test vectors from Stage 1
# (Prover.toml already written by scripts/test-vectors.ts)

# Build the circuit
nargo build
# Outputs: target/whoiswho_answer.json (ACIR bytecode)

# Execute the witness (checks constraints pass with test data)
nargo execute witness
# Expected: no errors, outputs: target/witness.gz
```

If `nargo execute` fails, the test vectors in `Prover.toml` don't satisfy the constraints.
Debug by checking:
- That `commitment` in Prover.toml matches `pedersen(game_id, player, character_id, salt)`
- That `traits_root` matches what `prepare-collection.ts` output
- That `merkle_path` is correct for `character_id=42`

### 2.5 Generate Verification Key

```bash
cd circuits/whoiswho_answer

bb write_vk \
  -s ultra_honk \
  --oracle_hash keccak \
  -b target/whoiswho_answer.json \
  -o target/vk

# Verify the file was created
ls -la target/vk
# Expected: target/vk (binary, ~100-300KB)
```

### 2.6 Generate and Verify a Proof Locally

```bash
# Generate proof from witness
bb prove \
  -s ultra_honk \
  --oracle_hash keccak \
  -b target/whoiswho_answer.json \
  -w target/witness.gz \
  -o target/

# Verify the proof locally
bb verify \
  -s ultra_honk \
  --oracle_hash keccak \
  -p target/proof \
  -k target/vk
# Expected output: "Proof verified successfully"
```

**Test with invalid inputs (must fail):**

```bash
# Create invalid Prover.toml with wrong answer by flipping a bit in trait_bitmap
# Then run nargo execute — should fail with assertion error
# This verifies the circuit actually enforces correctness
```

### 2.7 Generate Cairo Verifier via Garaga

```bash
cd /Users/gianfranco/projects/whoiswho

# Generate the Cairo verifier project
garaga gen \
  --system ultra_keccak_zk_honk \
  --vk circuits/whoiswho_answer/target/vk \
  -o packages/whoiswho-verifier/

# Verify output
ls packages/whoiswho-verifier/
# Expected: Scarb.toml + src/honk_verifier*.cairo + src/lib.cairo
```

### 2.8 Create Scarb.toml for Verifier Package

The generated `packages/whoiswho-verifier/Scarb.toml` may need adjusting:

```toml
[package]
name = "whoiswho_verifier"
version = "0.1.0"

[dependencies]
starknet = "=2.12.1"
garaga = { git = "https://github.com/keep-starknet-strange/garaga", tag = "v0.14.0" }
```

```bash
# Build the verifier
cd packages/whoiswho-verifier
scarb build
# Expected: no errors, outputs compiled Sierra + CASM
```

### 2.9 Verify Proof On-Chain Against Verifier (Sepolia test)

```bash
# This step deploys to Sepolia for smoke testing.
# Can be skipped if Stage 3 contract integration happens first.

garaga declare --network sepolia
garaga deploy --class-hash <CLASS_HASH> --network sepolia
# Save: 0xVERIFIER_ADDRESS_SEPOLIA

# Test the proof against the deployed verifier
garaga verify-onchain \
  --address <VERIFIER_ADDRESS_SEPOLIA> \
  --vk circuits/whoiswho_answer/target/vk \
  --proof circuits/whoiswho_answer/target/proof \
  --network sepolia
# Expected: "Proof verified on-chain ✓"
```

**Stage 2 success criteria:**
- [ ] `nargo build` produces `target/whoiswho_answer.json`
- [ ] `nargo execute witness` succeeds with test vectors (valid inputs)
- [ ] `nargo execute witness` fails with invalid inputs (fabricated answer)
- [ ] `bb verify` outputs `"Proof verified successfully"` for valid proof
- [ ] `bb verify` fails for tampered proof
- [ ] `garaga gen` produces `packages/whoiswho-verifier/` with Cairo files
- [ ] `scarb build` in verifier package succeeds
- [ ] (Optional) `garaga verify-onchain` passes on Sepolia

---

## Stage 3: Dojo Contract Integration

**Agent scope:** Cairo only. Requires Stage 2 (verifier address from Garaga deploy).
**Outputs:** Updated contracts with `answer_question_with_proof`, new Game model fields, updated events.

### 3.1 Update Game Model

In `contracts/src/models/game.cairo`, add two fields to `Game`:

```cairo
#[derive(Drop, Serde)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id:           felt252,
    pub player1:           ContractAddress,
    pub player2:           ContractAddress,
    pub phase:             u8,
    pub current_turn:      u8,
    pub turn_count:        u16,
    pub winner:            ContractAddress,
    pub collection_id:     felt252,
    pub timeout_seconds:   u64,
    pub created_at:        u64,
    pub last_action_at:    u64,
    pub last_question_id:  u8,
    pub last_answer:       bool,
    pub guess_character_id: felt252,
    // NEW: ZK proof verification fields
    // traits_root is a Poseidon2 BN254 hash — may exceed Stark field prime (~16% of outputs)
    // so it MUST be u256, not felt252. Cairo stores it as an opaque u256 and never recomputes it.
    pub traits_root:       u256,     // Poseidon2 BN254 Merkle root of the character collection
    pub question_set_id:   u8,       // Which question schema this game uses (0 = SCHIZODIO v1)
}
```

Also update the existing `Commitment` model to add the ZK commitment as a **separate field**
(the existing `hash: felt252` is Starknet Pedersen — used for `reveal_character`. The new
`zk_commitment: u256` is Poseidon2 BN254 — used for ZK proofs. These are two different
commitment schemes with different purposes and MUST NOT share the same field):

```cairo
#[derive(Drop, Serde)]
#[dojo::model]
pub struct Commitment {
    #[key]
    pub game_id:        felt252,
    #[key]
    pub player:         ContractAddress,
    pub hash:           felt252,   // EXISTING: Starknet Pedersen for reveal_character
    pub zk_commitment:  u256,      // NEW: Poseidon2 BN254 for ZK proof verification
    pub revealed:       bool,
    pub character_id:   felt252,
}
```

Also update `commit_character` to accept both (or add a separate `commit_zk` entrypoint).
The simplest approach: add `zk_commitment_hash: u256` parameter to `commit_character`.

Also update `Turn` to track proof verification:

```cairo
#[derive(Drop, Serde)]
#[dojo::model]
pub struct Turn {
    #[key]
    pub game_id:              felt252,
    #[key]
    pub turn_number:          u16,
    pub action_type:          u8,
    pub question_id:          u8,
    pub answer:               bool,
    pub asked_by:             ContractAddress,
    pub answered_by:          ContractAddress,
    pub guessed_character_id: felt252,
    pub action_timestamp:     u64,
    // NEW: ZK proof tracking
    pub proof_verified:       bool,   // true = answer came from a verified ZK proof
}
```

### 3.2 Add Verifier Config

In `contracts/src/constants.cairo`, add:

```cairo
// ZK Verifier contract addresses
// Set these after deploying the Garaga-generated verifier
pub const VERIFIER_ADDRESS_SEPOLIA: felt252 = 0x0; // TODO: fill after Stage 2.9
pub const VERIFIER_ADDRESS_MAINNET: felt252 = 0x0; // TODO: fill after production deploy

// Question set IDs
pub const QUESTION_SET_SCHIZODIO_V1: u8 = 0;
```

Create `contracts/src/interfaces/verifier.cairo`:

```cairo
// contracts/src/interfaces/verifier.cairo
// Interface for the Garaga-generated UltraKeccakZKHonk verifier contract.
// This matches the ABI produced by `garaga gen`.

use starknet::ContractAddress;

#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState,
        full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;  // NOT Option — Garaga returns Result
}
```

### 3.3 Update `create_game` to Accept `traits_root`

In `contracts/src/interfaces/game_actions.cairo`, update signature:

```cairo
pub trait IGameActions<TContractState> {
    fn create_game(ref self: TContractState, traits_root: u256, question_set_id: u8) -> felt252;
    fn join_game(ref self: TContractState, game_id: felt252);
    // commitment_hash: Starknet Pedersen for reveal (felt252)
    // zk_commitment:   Poseidon2 BN254 for ZK proofs (u256 — may exceed Stark field prime)
    fn commit_character(ref self: TContractState, game_id: felt252, commitment_hash: felt252, zk_commitment: u256);
    fn ask_question(ref self: TContractState, game_id: felt252, question_id: u8);
    fn answer_question(ref self: TContractState, game_id: felt252, answer: bool); // kept for testing
    fn answer_question_with_proof(
        ref self: TContractState,
        game_id: felt252,
        full_proof_with_hints: Span<felt252>,
        public_inputs: Span<felt252>,
    );
    fn eliminate_characters(ref self: TContractState, game_id: felt252, eliminated_bitmap: u128);
    fn make_guess(ref self: TContractState, game_id: felt252, character_id: felt252);
    fn reveal_character(ref self: TContractState, game_id: felt252, character_id: felt252, salt: felt252);
    fn claim_timeout(ref self: TContractState, game_id: felt252);
}
```

### 3.4 Implement `answer_question_with_proof`

In `contracts/src/systems/game_actions.cairo`, add the new entrypoint:

```cairo
// Add to imports at top of game_actions.cairo:
use whoiswho::interfaces::verifier::{
    IUltraKeccakZKHonkVerifierDispatcher,
    IUltraKeccakZKHonkVerifierDispatcherTrait,
};
use starknet::contract_address_const;

// New entrypoint implementation:
fn answer_question_with_proof(
    ref self: ContractState,
    game_id: felt252,
    full_proof_with_hints: Span<felt252>,
    public_inputs: Span<felt252>,
) {
    let mut world = self.world_default();
    let caller = get_caller_address();

    // ── Phase + authorization checks (same as answer_question) ───
    let mut game: Game = world.read_model(game_id);
    assert(
        game.phase == constants::PHASE_P1_ANSWER_PENDING
            || game.phase == constants::PHASE_P2_ANSWER_PENDING,
        errors::ERR_INVALID_PHASE
    );
    let is_p1_answering = game.phase == constants::PHASE_P1_ANSWER_PENDING;
    let expected_answerer = if is_p1_answering { game.player1 } else { game.player2 };
    assert(caller == expected_answerer, errors::ERR_NOT_YOUR_TURN);

    // ── Extract and validate public inputs ───────────────────────
    // Public inputs layout (must match circuit — indices 0..5 are public inputs,
    // index 6 is the circuit's public output: computed_answer).
    //
    // Values are passed as felt252 from the client. NOTE on types:
    //   - game_id, turn_id, player, question_id: always fit in felt252 (Starknet values)
    //   - commitment (u256): Poseidon2 BN254 — passed as two felt252 words (high, low)
    //   - traits_root (u256): same — two felt252 words
    //
    // The client encodes u256 values as two consecutive felt252 (big-endian word order).
    // Layout: [game_id, turn_id, player, commit_hi, commit_lo, root_hi, root_lo, question_id, answer]
    assert(public_inputs.len() >= 9, errors::ERR_INVALID_PROOF_INPUTS);

    let proof_game_id     = *public_inputs[0];
    let proof_turn_id     = *public_inputs[1];
    let proof_player      = *public_inputs[2];
    // commitment and traits_root arrive as u256 (two felt252 words each)
    let proof_commitment  = u256 { high: (*public_inputs[3]).try_into().unwrap(), low: (*public_inputs[4]).try_into().unwrap() };
    let proof_traits_root = u256 { high: (*public_inputs[5]).try_into().unwrap(), low: (*public_inputs[6]).try_into().unwrap() };
    let proof_question_id = *public_inputs[7];
    let computed_answer_raw = *public_inputs[8];

    // ── Anti-replay: bind proof to current game state ─────────────
    assert(proof_game_id == game_id, errors::ERR_PROOF_GAME_MISMATCH);
    assert(proof_turn_id == game.turn_count.into(), errors::ERR_PROOF_TURN_MISMATCH);
    assert(proof_player == caller.into(), errors::ERR_PROOF_PLAYER_MISMATCH);
    assert(proof_question_id == game.last_question_id.into(), errors::ERR_PROOF_QUESTION_MISMATCH);

    // ── Collection integrity check ─────────────────────────────────
    // game.traits_root is u256 — compare directly (no Poseidon computed here)
    assert(proof_traits_root == game.traits_root, errors::ERR_PROOF_TRAITS_ROOT_MISMATCH);

    // ── Commitment consistency check ───────────────────────────────
    // commitment.zk_commitment is the Poseidon2 BN254 commitment (u256)
    // commitment.hash (felt252) is kept for the reveal phase — untouched
    let commitment: Commitment = world.read_model((game_id, caller));
    assert(proof_commitment == commitment.zk_commitment, errors::ERR_PROOF_COMMITMENT_MISMATCH);

    // ── Invoke Garaga verifier ─────────────────────────────────────
    let verifier = IUltraKeccakZKHonkVerifierDispatcher {
        contract_address: contract_address_const::<constants::VERIFIER_ADDRESS_SEPOLIA>()
    };
    let result = verifier.verify_ultra_keccak_zk_honk_proof(full_proof_with_hints);
    assert(result.is_ok(), errors::ERR_PROOF_VERIFICATION_FAILED);  // Result, not Option

    // ── Extract computed_answer from proof output ──────────────────
    let computed_answer: bool = computed_answer_raw != 0;

    // ── Update Turn with verified answer ──────────────────────────
    let mut turn: Turn = world.read_model((game_id, game.turn_count));
    turn.answer = computed_answer;
    turn.answered_by = caller;
    turn.action_timestamp = get_block_timestamp();
    turn.proof_verified = true;
    world.write_model(@turn);

    // ── Advance phase (same logic as answer_question) ─────────────
    game.last_answer = computed_answer;
    game.last_action_at = get_block_timestamp();
    if is_p1_answering {
        game.phase = constants::PHASE_P2_ELIMINATING;
    } else {
        game.phase = constants::PHASE_P1_ELIMINATING;
    }
    world.write_model(@game);

    // ── Emit event ────────────────────────────────────────────────
    world.emit_event(@events::QuestionAnsweredVerified {
        game_id,
        turn_number: game.turn_count,
        question_id: game.last_question_id,
        computed_answer,
        answerer: caller,
        proof_verified: true,
    });
}
```

### 3.5 Add New Error Constants

In `contracts/src/errors.cairo`:

```cairo
pub const ERR_INVALID_PROOF_INPUTS:        felt252 = 'Invalid proof inputs length';
pub const ERR_PROOF_GAME_MISMATCH:         felt252 = 'Proof game_id mismatch';
pub const ERR_PROOF_TURN_MISMATCH:         felt252 = 'Proof turn_id mismatch';
pub const ERR_PROOF_PLAYER_MISMATCH:       felt252 = 'Proof player mismatch';
pub const ERR_PROOF_QUESTION_MISMATCH:     felt252 = 'Proof question_id mismatch';
pub const ERR_PROOF_TRAITS_ROOT_MISMATCH:  felt252 = 'Proof traits_root mismatch';
pub const ERR_PROOF_COMMITMENT_MISMATCH:   felt252 = 'Proof commitment mismatch';
pub const ERR_PROOF_VERIFICATION_FAILED:   felt252 = 'ZK proof verification failed';
```

### 3.6 Add New Event

In `contracts/src/events.cairo`:

```cairo
#[derive(Drop, Serde)]
#[dojo::event]
pub struct QuestionAnsweredVerified {
    #[key]
    pub game_id:        felt252,
    pub turn_number:    u16,
    pub question_id:    u8,
    pub computed_answer: bool,
    pub answerer:       ContractAddress,
    pub proof_verified: bool,
}
```

### 3.7 Update `create_game` Implementation

```cairo
fn create_game(ref self: ContractState, traits_root: u256, question_set_id: u8) -> felt252 {
    // ... existing logic ...
    let game = Game {
        // ... existing fields ...
        traits_root,
        question_set_id,
    };
    // ... rest unchanged ...
}
```

### 3.8 Write Tests for Proof Path

In `contracts/src/tests/test_game_flow.cairo`, add:

```cairo
// Test: answer_question_with_proof happy path
// (uses a fixture proof generated in Stage 2)
#[test]
fn test_answer_with_proof_valid() {
    // ... setup game ...
    // Submit proof with valid fixture bytes
    // Assert: Turn.answer == computed_answer from proof
    // Assert: Turn.proof_verified == true
    // Assert: game phase advanced correctly
}

// Test: answer_question_with_proof with invalid proof
#[test]
#[should_panic(expected: ('ZK proof verification failed',))]
fn test_answer_with_proof_invalid_proof() {
    // Submit garbage bytes as proof
    // Assert: panics with ERR_PROOF_VERIFICATION_FAILED
}

// Test: answer_question_with_proof with wrong turn_id (replay)
#[test]
#[should_panic(expected: ('Proof turn_id mismatch',))]
fn test_answer_with_proof_replay_attack() {
    // Submit proof with turn_id = 999 when actual turn is 1
    // Assert: panics with ERR_PROOF_TURN_MISMATCH
}

// Test: answer_question_with_proof with wrong traits_root
#[test]
#[should_panic(expected: ('Proof traits_root mismatch',))]
fn test_answer_with_proof_wrong_collection() {
    // Submit proof with traits_root != game.traits_root
    // Assert: panics with ERR_PROOF_TRAITS_ROOT_MISMATCH
}
```

**Stage 3 success criteria:**
- [ ] `sozo build` succeeds with updated contracts
- [ ] `sozo test` passes all 24 existing tests (no regressions)
- [ ] New tests for proof path pass
- [ ] Invalid proof test panics with correct error
- [ ] Replay attack test panics with correct error
- [ ] `create_game` stores `traits_root` and `question_set_id`

---

## Stage 4: Client Integration

**Agent scope:** TypeScript frontend. Requires Stage 1 (collection JSON), Stage 2 (circuit bytecode + npm garaga), Stage 3 (deployed contract address).

### 4.1 Install Dependencies

```bash
cd /Users/gianfranco/projects/whoiswho

npm install @noir-lang/noir_js @noir-lang/backend_barretenberg garaga

# Verify
node -e "require('@noir-lang/noir_js'); console.log('noir_js ok')"
```

### 4.2 Add Missing Game Phases

In `src/store/types.ts`, extend the `GamePhase` enum:

```typescript
export enum GamePhase {
  // ... existing phases ...
  ANSWER_PENDING = 'ANSWER_PENDING',
  // NEW: ZK proof generation states
  PROVING        = 'PROVING',         // Web Worker generating proof
  SUBMITTING     = 'SUBMITTING',      // Sending proof transaction to Starknet
  VERIFIED       = 'VERIFIED',        // On-chain verification confirmed
  PROOF_ERROR    = 'PROOF_ERROR',     // Proof generation or submission failed
}
```

### 4.3 Build Collection Data Service

Create `src/zk/collectionData.ts`:

```typescript
// src/zk/collectionData.ts
// Loads the pre-computed collection JSON (mock or real).
// Returns bitmap + merkle_path for any character_id without IPFS fetches.

export interface CharacterProofData {
  id:                 number;
  name:               string;
  bitmap:             string;   // decimal string
  merkle_path:        string[]; // 10 hex strings
  merkle_path_is_left: boolean[]; // 10 booleans
}

export interface CollectionDataset {
  mode:            string;
  total:           number;
  tree_depth:      number;
  traits_root:     string;   // hex string
  question_schema: Record<string, string>;
  characters:      CharacterProofData[];
}

let cachedDataset: CollectionDataset | null = null;

export async function loadCollectionData(mode: 'mock' | 'real' = 'mock'): Promise<CollectionDataset> {
  if (cachedDataset) return cachedDataset;
  const url = mode === 'mock'
    ? '/collections/mock.json'
    : '/collections/schizodio.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load collection data: ${res.status}`);
  cachedDataset = await res.json() as CollectionDataset;
  return cachedDataset;
}

export function getCharacterData(dataset: CollectionDataset, characterId: number): CharacterProofData {
  const char = dataset.characters[characterId];
  if (!char) throw new Error(`Character ${characterId} not found in dataset`);
  return char;
}
```

### 4.4 Build Proof Generation Service (Web Worker)

Create `src/zk/proveWorker.ts` (Web Worker):

```typescript
// src/zk/proveWorker.ts
// Runs in a Web Worker to avoid blocking the main thread.
// Proof generation takes 30-120 seconds — must not freeze UI.
//
// Hash usage:
//   - @aztec/bb.js poseidon2Hash → Poseidon2 BN254, same as Noir circuit
//   - garaga npm getZKHonkCallData → formats proof bytes into Span<felt252> for Cairo verifier

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@noir-lang/backend_barretenberg';
import { getZKHonkCallData } from 'garaga';
import circuit from '../../circuits/whoiswho_answer/target/whoiswho_answer.json';

export interface ProveRequest {
  // Public inputs
  game_id:     string;
  turn_id:     string;
  player:      string;
  commitment:  string;
  question_id: number;
  traits_root: string;
  // Private inputs
  character_id:  number;
  salt:          string;
  bitmap:        string;   // decimal string (from collection dataset)
  merkle_path:   string[]; // 10 hex strings
}

export interface ProveResult {
  proof:        Uint8Array;
  publicInputs: string[];
  calldata:     string[]; // formatted for Starknet contract call
}

self.onmessage = async (e: MessageEvent<ProveRequest>) => {
  try {
    self.postMessage({ type: 'progress', message: 'Initializing prover...' });

    const backend = new UltraHonkBackend(circuit.bytecode, { threads: 4 });
    const noir    = new Noir(circuit, backend);

    self.postMessage({ type: 'progress', message: 'Executing witness...' });

    const { witness } = await noir.execute({
      game_id:      e.data.game_id,
      turn_id:      e.data.turn_id,
      player:       e.data.player,
      commitment:   e.data.commitment,
      question_id:  e.data.question_id,
      traits_root:  e.data.traits_root,
      character_id: e.data.character_id.toString(),
      salt:         e.data.salt,
      trait_bitmap: e.data.bitmap,
      merkle_path:  e.data.merkle_path,
    });

    self.postMessage({ type: 'progress', message: 'Generating ZK proof... (this may take 30-60s)' });

    const { proof, publicInputs } = await backend.generateProof(witness);

    self.postMessage({ type: 'progress', message: 'Formatting calldata...' });

    // getZKHonkCallData formats proof + vk into the Span<felt252> the Cairo verifier expects.
    // It includes the elliptic curve hints for efficient on-chain verification.
    // garaga npm does NOT need explicit init() in v1.x — WASM loads automatically.
    const vk       = await backend.getVerificationKey();
    const calldata = getZKHonkCallData(proof, publicInputs, vk);
    // calldata is string[] — felt252 values hex-encoded, ready for Starknet tx

    self.postMessage({ type: 'result', proof, publicInputs, calldata } as ProveResult & { type: 'result' });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
```

Create `src/zk/proveService.ts` (main thread interface):

```typescript
// src/zk/proveService.ts
// Spawns the Web Worker and wraps it in a Promise with progress callbacks.

import type { ProveRequest, ProveResult } from './proveWorker';

export async function generateAnswerProof(
  request: ProveRequest,
  onProgress?: (message: string) => void,
): Promise<ProveResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./proveWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        onProgress?.(e.data.message);
      } else if (e.data.type === 'result') {
        worker.terminate();
        resolve(e.data as ProveResult);
      } else if (e.data.type === 'error') {
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(`Worker error: ${err.message}`));
    };

    worker.postMessage(request);
  });
}
```

### 4.5 Update Online Sync Hook for Proof Path

In `src/hooks/useOnlineGameSync.ts`, update the answer handler:

```typescript
// When it's our turn to answer a question:
async function handleAnswerWithProof(questionId: number) {
  const secret = getStoredSecret(gameId); // character_id, salt, bitmap, merkle_path
  const dataset = await loadCollectionData('mock');
  const charData = getCharacterData(dataset, secret.characterId);

  // Transition to PROVING phase
  setPhase(GamePhase.PROVING);

  try {
    const proofResult = await generateAnswerProof({
      game_id:     gameId,
      turn_id:     String(currentTurnId),
      player:      playerAddress,
      commitment:  secret.commitment,
      question_id: questionId,
      traits_root: dataset.traits_root,
      character_id: secret.characterId,
      salt:         secret.salt,
      bitmap:       charData.bitmap,
      merkle_path:  charData.merkle_path,
    }, (msg) => setProvingStatus(msg));

    // Transition to SUBMITTING phase
    setPhase(GamePhase.SUBMITTING);

    // Submit to Dojo contract
    await contract.answer_question_with_proof(
      gameId,
      proofResult.calldata,
      proofResult.publicInputs,
    );

    // Transition to VERIFIED phase
    setPhase(GamePhase.VERIFIED);

    // Notify opponent via Supabase event
    await sendEvent(gameId, 'ANSWER_PROVEN', {
      turnId: currentTurnId,
      answer: computedAnswerFromPublicInputs(proofResult.publicInputs),
    });

  } catch (err) {
    setPhase(GamePhase.PROOF_ERROR);
    console.error('Proof generation failed:', err);
  }
}
```

### 4.6 Update AnswerPanel UI

In `src/ui/AnswerPanel.tsx`, replace the two-button layout with phase-aware rendering:

```typescript
// When phase === ANSWER_PENDING: show character's computed answer + "Generate Proof" button
// When phase === PROVING: show spinner + progress message (from Web Worker)
// When phase === SUBMITTING: show "Sending to Starknet..."
// When phase === VERIFIED: show checkmark + "Answer verified on-chain ✓"
// When phase === PROOF_ERROR: show error + retry button
```

Key UX point: the player doesn't choose Yes/No manually.
The bitmap already encodes the correct answer. The UI shows:
> "Based on your character, the answer to this question is **Yes**."
> [Generate Proof & Submit]

### 4.7 Update Commitment to Include Both Schemes

There are now **two separate commitment values** computed client-side:

```typescript
// src/starknet/commitReveal.ts

import { hash } from 'starknet';
import { BarretenbergSync } from '@aztec/bb.js';

export async function computeCommitments(
  gameId: string,
  player: string,
  characterId: number,
  salt: bigint,
): Promise<{ revealHash: string; zkCommitment: bigint }> {
  // 1. Existing reveal commitment: Starknet Pedersen (Stark field, felt252)
  //    Used by reveal_character at end of game — verified by Cairo's core::pedersen
  const revealHash = hash.computePedersenHash(
    '0x' + BigInt(characterId).toString(16),
    '0x' + salt.toString(16),
  );

  // 2. ZK commitment: Poseidon2 BN254 (may exceed Stark field prime — stored as u256)
  //    Used by the Noir circuit to bind the proof to the player's chosen character
  const bb = await BarretenbergSync.new();
  const zkCommitment = bb.poseidon2Hash([
    BigInt(gameId), BigInt(player), BigInt(characterId), salt
  ]);

  return { revealHash, zkCommitment };
}
```

Both are passed to `commit_character(game_id, reveal_hash, zk_commitment)`.
The `revealHash` is `felt252`; the `zkCommitment` is `u256` (split into two u128 for Starknet call).

### 4.8 Update Session Policies and Contract Config

In `src/starknet/config.ts`, after contract deployment:

```typescript
export const GAME_CONTRACT = '0x...'; // deployed contract address

export const SESSION_POLICIES = [
  { target: GAME_CONTRACT, method: 'create_game' },
  { target: GAME_CONTRACT, method: 'join_game' },
  { target: GAME_CONTRACT, method: 'commit_character' },
  { target: GAME_CONTRACT, method: 'ask_question' },
  { target: GAME_CONTRACT, method: 'answer_question_with_proof' },
  { target: GAME_CONTRACT, method: 'eliminate_characters' },
  { target: GAME_CONTRACT, method: 'make_guess' },
  { target: GAME_CONTRACT, method: 'reveal_character' },
  { target: GAME_CONTRACT, method: 'claim_timeout' },
];
```

**Stage 4 success criteria:**
- [ ] `generateAnswerProof` runs in a Web Worker without freezing UI
- [ ] PROVING / SUBMITTING / VERIFIED phases render correctly in AnswerPanel
- [ ] Proof is submitted successfully to deployed Dojo contract
- [ ] `QuestionAnsweredVerified` event appears in Torii/Supabase
- [ ] Two players can complete a full game turn cycle with proof
- [ ] Timeout path still works (no proof needed for `claim_timeout`)

---

## Stage 5: Real SCHIZODIO Collection Integration

**Agent scope:** TypeScript only. Runs after Stages 1–4 are stable with mock data.
**Prerequisite:** User provides a working SCHIZODIO trait dataset or confirms IPFS access.

### 5.1 Implement Real Collection Fetcher

Create `scripts/fetch-schizodio.ts`:

```typescript
// scripts/fetch-schizodio.ts
// Fetches all 999 SCHIZODIO NFTs from the official API.
// Run once. Can take 5-15 minutes due to rate limits.

const BASE_URL = 'https://v1assets.schizod.io/json/revealed';
const TOTAL = 999;

async function fetchNFT(id: number, retries = 3): Promise<{ id: number; attrs: Record<string, string> }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/${id}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const attrs: Record<string, string> = {};
      for (const attr of data.attributes) {
        attrs[attr.trait_type] = attr.value;
      }
      return { id, attrs };
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('unreachable');
}

// ... batch fetch all 999 with concurrency limit of 5
// Save raw data to scripts/cache/schizodio-raw.json (before processing)
// Then run prepare-collection.ts with 'real' mode
```

### 5.2 Validate Full Collection Bitmap Distribution

After fetching real data, check that the question predicates produce reasonable distributions:

```typescript
// For each question_id, count how many characters answer Yes vs No.
// If any question always returns the same answer, it's useless in the game.
// Aim for 20%-80% distribution per question.
```

### 5.3 Regenerate Everything with Real Data

```bash
npx tsx scripts/prepare-collection.ts real
# → public/collections/schizodio.json
# → prints real traits_root

# Update traits_root in contracts:
# contracts/src/constants.cairo → TRAITS_ROOT_SCHIZODIO = 0x<real_root>
```

### 5.4 Redeploy Verifier + Dojo Contracts

The circuit bytecode doesn't change (same constraints).
Only the `traits_root` constant in the Dojo contract changes.

```bash
sozo migrate --network sepolia
```

**Stage 5 success criteria:**
- [ ] `public/collections/schizodio.json` generated from real IPFS data
- [ ] All 999 Merkle paths verify correctly against real `traits_root`
- [ ] Each question has >10% and <90% Yes responses across the collection
- [ ] Game can be played end-to-end with real NFTs

---

## Stage 6: Hardening + E2E

**Agent scope:** Testing + security. Requires Stages 1–5 complete.

### 6.1 Integration Tests (Happy Path)

```
Test: Full game with ZK answers
1. Player1 creates game with traits_root
2. Both commit characters
3. Player1 asks question_id=0
4. Player2 generates proof and calls answer_question_with_proof
5. Turn.answer matches computed_answer from proof
6. Turn.proof_verified = true
7. Player1 eliminates characters based on answer
8. Continue until make_guess + reveal_character
9. Winner determined correctly
```

### 6.2 Adversarial Tests

```
Test: Invalid proof bytes → ERR_PROOF_VERIFICATION_FAILED
Test: Wrong turn_id in proof → ERR_PROOF_TURN_MISMATCH
Test: Wrong game_id in proof → ERR_PROOF_GAME_MISMATCH
Test: Wrong traits_root → ERR_PROOF_TRAITS_ROOT_MISMATCH
Test: Proof from different player → ERR_PROOF_PLAYER_MISMATCH
Test: Fabricated trait_bitmap → nargo execute fails (cannot generate valid proof)
Test: Wrong commitment → ERR_PROOF_COMMITMENT_MISMATCH
Test: Replay (proof from turn 3 submitted in turn 7) → ERR_PROOF_TURN_MISMATCH
```

### 6.3 Performance Benchmarks

```
Target metrics:
- nargo execute:       < 5 seconds
- bb generate proof:   < 120 seconds (browser WebAssembly)
- Contract verify tx:  < 30 seconds (Starknet block time)
- Total answer latency: < 3 minutes (acceptable for a board game)
```

### 6.4 Security Review Checklist

- [ ] Verifier address is a constant, not user-supplied (no verifier substitution attack)
- [ ] `turn_id` validated on-chain before accepting proof (replay resistance)
- [ ] `commitment` extracted from on-chain storage, not from `public_inputs` parameter (no commitment substitution)
- [ ] `traits_root` extracted from `game.traits_root`, not from `public_inputs` parameter
- [ ] `answer_question` (non-ZK) can be disabled for production (or kept for testing only)
- [ ] Salt never stored in backend or transmitted — stays in browser sessionStorage
- [ ] Web Worker terminates after proof generation (no dangling secret data)

### 6.5 Deployment Checklist

```bash
# Mainnet deploy sequence:
# 1. Deploy Garaga verifier to mainnet
garaga deploy --class-hash <CLASS_HASH> --network mainnet
# → 0xVERIFIER_ADDRESS_MAINNET

# 2. Update VERIFIER_ADDRESS_MAINNET in constants.cairo

# 3. Deploy Dojo contracts
sozo migrate --network mainnet

# 4. Update frontend config:
# GAME_CONTRACT = 0x<deployed_address>
# Uncomment SESSION_POLICIES

# 5. Copy real collection JSON to CDN/public folder

# 6. Smoke test with real wallets on mainnet
```

**Stage 6 success criteria:**
- [ ] All adversarial tests pass (proofs with wrong data are rejected)
- [ ] Happy path E2E game completes with verified answers
- [ ] Proof generation latency measured and documented
- [ ] Security checklist fully reviewed
- [ ] Mainnet deployment runbook executed

---

## File Tree After Complete Implementation

```
whoiswho/
├── circuits/
│   └── whoiswho_answer/
│       ├── Nargo.toml
│       ├── Prover.toml               ← test vectors (Stage 1)
│       ├── src/
│       │   ├── main.nr               ← main circuit (Stage 2)
│       │   └── merkle.nr             ← merkle verify helper (Stage 2)
│       └── target/
│           ├── whoiswho_answer.json  ← compiled bytecode (Stage 2)
│           ├── vk                    ← verification key (Stage 2)
│           ├── witness.gz            ← test witness (Stage 2)
│           └── proof                 ← test proof (Stage 2)
│
├── packages/
│   └── whoiswho-verifier/
│       ├── Scarb.toml
│       └── src/
│           └── honk_verifier*.cairo  ← generated by garaga gen (Stage 2)
│
├── contracts/
│   └── src/
│       ├── constants.cairo           ← + VERIFIER_ADDRESS, TRAITS_ROOT
│       ├── errors.cairo              ← + proof error constants
│       ├── events.cairo              ← + QuestionAnsweredVerified
│       ├── models/game.cairo         ← + traits_root, question_set_id, proof_verified
│       ├── interfaces/
│       │   ├── game_actions.cairo    ← + answer_question_with_proof signature
│       │   └── verifier.cairo        ← NEW: Garaga verifier interface
│       └── systems/game_actions.cairo ← + answer_question_with_proof impl
│
├── scripts/
│   ├── question-schema.ts            ← canonical question registry (Stage 1)
│   ├── mock-collection.ts            ← deterministic fake data (Stage 1)
│   ├── merkle.ts                     ← Merkle tree library (Stage 1)
│   ├── prepare-collection.ts         ← collection JSON generator (Stage 1)
│   ├── test-vectors.ts               ← Noir Prover.toml generator (Stage 1)
│   └── fetch-schizodio.ts            ← real IPFS fetcher (Stage 5)
│
├── src/
│   └── zk/
│       ├── collectionData.ts         ← collection JSON loader (Stage 4)
│       ├── proveWorker.ts            ← Web Worker: proof generation (Stage 4)
│       └── proveService.ts           ← main thread interface (Stage 4)
│
└── public/
    └── collections/
        ├── mock.json                 ← mock dataset (Stage 1, ~350KB)
        └── schizodio.json            ← real dataset (Stage 5, ~350KB)
```

---

## Stage Dependencies

```
Stage 0 (Toolchain)
    │
    ├─── Stage 1 (Traits + Mock Data)       ← can run in parallel with Stage 0
    │        │
    │        └─── Stage 2 (Noir + Verifier) ← needs Stage 0 + Stage 1
    │                 │
    │                 └─── Stage 3 (Dojo)   ← needs Stage 2 (verifier address)
    │                          │
    │                          └─── Stage 4 (Client) ← needs Stage 1 + Stage 2 + Stage 3
    │                                    │
    │                                    └─── Stage 5 (Real Data) ← needs Stage 4 working
    │                                               │
    │                                               └─── Stage 6 (Hardening)
```

**Parallelizable:** Stage 0 and Stage 1 can run simultaneously.
Stage 3 (Cairo changes) can begin structurally (model + interface + error updates)
before Stage 2 finishes — only the `answer_question_with_proof` body needs the verifier address.

---

## Acceptance Criteria

- [ ] Commit-reveal prevents character switching after game start
- [ ] Every accepted answer has a verified ZK proof on-chain (`Turn.proof_verified = true`)
- [ ] The character identity never appears on-chain (only the commitment hash)
- [ ] The `computed_answer` is extracted from the proof output, never from user input
- [ ] Replay attack rejected (proof bound to game_id + turn_id)
- [ ] Wrong collection rejected (proof bound to traits_root)
- [ ] Timeout path (45 seconds) remains unchanged and requires no proof
- [ ] Proof generation UI shows PROVING → SUBMITTING → VERIFIED states
- [ ] Full online game completes with two real wallets on Sepolia

---

## References

- Educational doc: `docs/APRENDE-ZK-WHOISWHO.md`
- Architecture reference: `docs/DOJO_ONCHAIN_REFERENCE.md`
- Phase 1 audit: `docs/PHASE1_REVIEW.md`
- Original plan: `docs/plans/2026-03-03-feat-dojo-onchain-game-logic-plan.md`
- SCHIZODIO API: `https://v1assets.schizod.io/json/revealed/{id}.json`
- Garaga docs: `https://github.com/keep-starknet-strange/garaga`
- Noir stdlib: `https://github.com/noir-lang/noir`
