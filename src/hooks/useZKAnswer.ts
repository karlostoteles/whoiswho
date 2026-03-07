/**
 * ZK proof generation + on-chain submission for answering questions.
 *
 * Exports:
 *   - generateAndSubmitProof(): standalone async — callable from any context
 *   - askQuestionOnChain(): submit ask_question tx on Katana
 *   - useZKAnswer(): React hook wrapper
 *   - prewarmProver() / terminateProver(): worker lifecycle
 */
import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { GamePhase } from '../store/types';
import {
  loadCollectionData,
  getCharacterBitmap,
  getCharacterMerklePath,
} from '../starknet/collectionData';
import { TRAITS_ROOT, GAME_CONTRACT } from '../starknet/config';
import { getStarknetAccount } from '../starknet/sdk';
import type {
  ProveRequest,
  ProveResult,
  WorkerMessage,
} from '../workers/prover.worker';

// ─── Singleton worker ─────────────────────────────────────────────────────────

let globalWorker: Worker | null = null;

function getOrCreateWorker(): Worker {
  if (!globalWorker) {
    globalWorker = new Worker(
      new URL('../workers/prover.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return globalWorker;
}

export function prewarmProver(): void {
  getOrCreateWorker();
}

export function terminateProver(): void {
  if (globalWorker) {
    globalWorker.terminate();
    globalWorker = null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const U128_MASK = (1n << 128n) - 1n;
const GAME_CREATED_SELECTOR =
  '0x1eb99ed24a15baaccc5c9a5458e3fc04f9cc107dbd431ef6e70b4158a253e8f';

function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  const v = value.trim();
  if (v.startsWith('0x') || v.startsWith('0X')) return BigInt(v);
  if (/^\d+$/.test(v)) return BigInt(v);
  throw new Error(`Expected numeric felt/u256 value, got "${value}"`);
}

function toFeltHex(value: string | number | bigint): string {
  return `0x${toBigInt(value).toString(16)}`;
}

function toDecimalField(value: string | number | bigint): string {
  return toBigInt(value).toString(10);
}

function splitU256(value: string | number | bigint): [string, string] {
  const v = toBigInt(value);
  const low = toFeltHex(v & U128_MASK);
  const high = toFeltHex(v >> 128n);
  return [low, high];
}

function getExecAccount(playerNum?: 1 | 2) {
  const account = getStarknetAccount(playerNum);
  if (!account) {
    throw new Error('No Starknet account connected');
  }
  return account;
}

function extractGameIdFromReceipt(receipt: any): string {
  const events: any[] = receipt?.events ?? [];
  for (const ev of events) {
    if (!Array.isArray(ev.keys)) continue;
    // Dojo wraps events in EventEmitted from the World contract.
    // ev.keys = [sn_keccak("EventEmitted"), event_selector, system_address]
    // ev.data = [keys_len, ...key_fields, values_len, ...value_fields]
    // game_id is a #[key] field in GameCreated → it's in ev.data[1] (after keys_len).
    const selectorIdx = ev.keys.findIndex(
      (k: string) => String(k).toLowerCase() === GAME_CREATED_SELECTOR,
    );
    if (selectorIdx < 0) continue;
    if (Array.isArray(ev.data) && ev.data.length >= 2) {
      const candidate = toBigInt(ev.data[1]);
      return toFeltHex(candidate); // game_id 0 is valid on fresh Katana
    }
  }
  throw new Error('Unable to extract game_id from create_game transaction receipt');
}

// ─── Contract calls ───────────────────────────────────────────────────────────

export async function createGameOnChain(playerNum?: 1 | 2): Promise<string> {
  const account = getExecAccount(playerNum);
  const [rootLow, rootHigh] = splitU256(TRAITS_ROOT);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'create_game',
    calldata: [rootLow, rootHigh, '0'], // question_set_id = SCHIZODIO v1
  }]);
  const receipt = await account.waitForTransaction(tx.transaction_hash);
  return extractGameIdFromReceipt(receipt);
}

export async function joinGameOnChain(gameId: string, playerNum?: 1 | 2): Promise<void> {
  const account = getExecAccount(playerNum);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'join_game',
    calldata: [toFeltHex(gameId)],
  }]);
  await account.waitForTransaction(tx.transaction_hash);
}

export async function commitCharacterOnChain(
  gameId: string,
  commitmentHash: string,
  zkCommitment: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);
  const [zkLow, zkHigh] = splitU256(zkCommitment);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'commit_character',
    calldata: [toFeltHex(gameId), toFeltHex(commitmentHash), zkLow, zkHigh],
  }]);
  await account.waitForTransaction(tx.transaction_hash);
}

// ─── Standalone proof generation + on-chain submission ────────────────────────

export interface ZKAnswerOpts {
  gameId: string;
  turnId: string;
  commitment: string;
  questionId: number;
  characterId: number;
  salt: string;
  playerNum?: 1 | 2;
}

// Last proof opts for retry after error
let lastProofOpts: ZKAnswerOpts | null = null;

/**
 * Generate ZK proof and submit it on-chain.
 * Callable from any context (not just React hooks).
 * Manages store phases: PROVING → SUBMITTING → VERIFIED
 */
export async function generateAndSubmitProof(opts: ZKAnswerOpts): Promise<ProveResult> {
  lastProofOpts = opts;
  const store = useGameStore.getState();
  store.setPhase(GamePhase.PROVING);
  store.clearProofError();

  const account = getExecAccount(opts.playerNum);
  const worker = getOrCreateWorker();
  const id = crypto.randomUUID();

  const dataset = await loadCollectionData();
  const bitmap = getCharacterBitmap(dataset, opts.characterId);
  const merkle_path = getCharacterMerklePath(dataset, opts.characterId);

  const req: ProveRequest = {
    type: 'prove',
    id,
    game_id: toDecimalField(opts.gameId),
    turn_id: toDecimalField(opts.turnId),
    player: toDecimalField(String(account.address)),
    commitment: toDecimalField(opts.commitment),
    question_id: opts.questionId,
    traits_root: toDecimalField(TRAITS_ROOT),
    character_id: opts.characterId,
    salt: toDecimalField(opts.salt),
    bitmap,
    merkle_path,
  };

  try {
    // 1. Generate proof via Web Worker
    const result = await new Promise<ProveResult>((resolve, reject) => {
      const handler = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.id !== id) return;

        if (e.data.type === 'progress') {
          if (e.data.step === 'proving') {
            useGameStore.getState().setPhase(GamePhase.PROVING);
          }
        } else {
          worker.removeEventListener('message', handler);
          if (e.data.type === 'result') {
            resolve(e.data);
          } else {
            reject(new Error(e.data.message));
          }
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage(req);
    });

    // 2. Submit proof on-chain
    useGameStore.getState().setPhase(GamePhase.SUBMITTING);

    const tx = await account.execute([{
      contractAddress: GAME_CONTRACT,
      entrypoint: 'answer_question_with_proof',
      calldata: [
        toFeltHex(opts.gameId),
        String(result.proofCalldata.length),
        ...result.proofCalldata,
      ],
    }]);

    await account.waitForTransaction(tx.transaction_hash);

    // 3. Mark verified
    useGameStore.getState().setVerifiedAnswer(Boolean(result.answerBit));
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useGameStore.getState().setProofError(msg);
    throw err;
  }
}

/**
 * Retry the last failed proof generation.
 * Clears error, removes turn from processedTurnIds, and re-runs.
 */
export async function retryLastProof(): Promise<ProveResult | null> {
  if (!lastProofOpts) return null;
  const store = useGameStore.getState();
  store.clearProofError();
  store.processedTurnIds.delete(Number(lastProofOpts.turnId));
  return generateAndSubmitProof(lastProofOpts);
}

/**
 * Submit ask_question on-chain (Katana).
 * Called before the opponent can generate their proof.
 */
export async function askQuestionOnChain(
  gameId: string,
  questionId: number,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'ask_question',
    calldata: [toFeltHex(gameId), String(questionId)],
  }]);

  await account.waitForTransaction(tx.transaction_hash);
  console.log('[zk] ask_question confirmed:', tx.transaction_hash);
}

/**
 * Submit eliminate_characters on-chain.
 * eliminated_bitmap is a u128 — fits in a single felt252.
 */
export async function eliminateCharactersOnChain(
  gameId: string,
  eliminatedBitmap: bigint,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'eliminate_characters',
    calldata: [toFeltHex(gameId), toFeltHex(eliminatedBitmap)],
  }]);

  await account.waitForTransaction(tx.transaction_hash);
  console.log('[zk] eliminate_characters confirmed:', tx.transaction_hash);
}

/**
 * Submit make_guess on-chain.
 * character_id is a felt252 derived from the string ID via characterIdToFelt.
 */
export async function makeGuessOnChain(
  gameId: string,
  characterIdFelt: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'make_guess',
    calldata: [toFeltHex(gameId), toFeltHex(characterIdFelt)],
  }]);

  await account.waitForTransaction(tx.transaction_hash);
  console.log('[zk] make_guess confirmed:', tx.transaction_hash);
}

/**
 * Submit reveal_character on-chain.
 * Both character_id and salt are felt252 values.
 */
export async function revealCharacterOnChain(
  gameId: string,
  characterIdFelt: string,
  salt: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'reveal_character',
    calldata: [toFeltHex(gameId), toFeltHex(characterIdFelt), toFeltHex(salt)],
  }]);

  await account.waitForTransaction(tx.transaction_hash);
  console.log('[zk] reveal_character confirmed:', tx.transaction_hash);
}

// ─── React Hook (thin wrapper) ───────────────────────────────────────────────

export function useZKAnswer() {
  const generateProof = useCallback(
    (opts: ZKAnswerOpts) => generateAndSubmitProof(opts),
    [],
  );

  return { generateProof, prewarmProver, terminateProver };
}
