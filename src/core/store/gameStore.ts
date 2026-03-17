import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GamePhase, GameState, GameActions, PlayerId } from './types';
import { supabase } from '@/services/supabase/client';
import { QUESTIONS } from '@/core/data/questions';
import { CHARACTERS } from '@/core/data/characters';
import type { Character } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { createCommitment, generateGameSessionId, clearCommitments, submitCommitmentOnChain } from '@/services/starknet/commitReveal';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { enrichCharacters } from '@/core/data/nftCharacterAdapter';
import { getGameContract } from '@/services/starknet/starkzapService';
import { getCachedCollectionData } from '@/zk/collectionData';
import { evaluateBit } from '@/zk/evaluateBit';
import { SCHIZODIO_QUESTIONS } from '@/zk/schizodioQuestions';

function getOpponent(player: PlayerId): PlayerId {
  return player === 'player1' ? 'player2' : 'player1';
}

// ─── Online game progress persistence ────────────────────────────────────────
// Saves elimination state + turn number to localStorage so refresh recovery works.
const PROGRESS_KEY = 'guessnft_game_progress';

interface GameProgress {
  onlineGameId: string;
  turnNumber: number;
  p1Eliminated: string[];
  p2Eliminated: string[];
  questionHistory: Array<{
    questionId: string;
    questionText: string;
    traitKey: string;
    traitValue: string | boolean;
    answer: boolean | null;
    askedBy: PlayerId;
    turnNumber: number;
  }>;
}

function saveGameProgress(state: GameState) {
  if (state.mode !== 'online' || !state.onlineGameId) return;
  const progress: GameProgress = {
    onlineGameId: state.onlineGameId,
    turnNumber: state.turnNumber,
    p1Eliminated: [...state.players.player1.eliminatedCharacterIds],
    p2Eliminated: [...state.players.player2.eliminatedCharacterIds],
    questionHistory: state.questionHistory.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText,
      traitKey: q.traitKey,
      traitValue: q.traitValue,
      answer: q.answer,
      askedBy: q.askedBy,
      turnNumber: q.turnNumber,
    })),
  };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch { /* quota exceeded — non-fatal */ }
}

function loadGameProgress(onlineGameId: string): GameProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const progress: GameProgress = JSON.parse(raw);
    if (progress.onlineGameId !== onlineGameId) return null;
    return progress;
  } catch {
    return null;
  }
}

function clearGameProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}

/**
 * Pick the question that splits CPU's remaining characters closest to 50/50.
 * Used internally to drive simultaneous CPU questions in free mode.
 */
function pickBestQuestionForCPU(
  remaining: Character[],
  askedIds: Set<string>,
) {
  const available = QUESTIONS.filter((q) => !askedIds.has(q.id));
  if (available.length === 0) return null;

  // Optimisation: for massive pools, sample a subset to find a good-enough split
  // 30,000 evaluations (30 questions * 1000 chars) is too slow for a state update.
  const sample = remaining.length > 100
    ? [...remaining].sort(() => Math.random() - 0.5).slice(0, 50)
    : remaining;

  let best = available[0];
  let bestScore = Infinity;
  for (const q of available) {
    const yesCount = sample.filter((c) => evaluateQuestion(q, c)).length;
    const noCount = sample.length - yesCount;
    const score = Math.abs(yesCount - noCount);
    if (score < bestScore) { bestScore = score; best = q; }
  }
  return best;
}

/**
 * Get the bitmap for an NFT character from the runtime-cached schizodio.json.
 */
export function getNftBitmap(characterId: string): [string, string, string, string] | null {
  if (!characterId.startsWith('nft_')) return null;
  const tokenId = parseInt(characterId.replace('nft_', ''), 10);
  if (isNaN(tokenId) || tokenId < 1 || tokenId > 999) return null;
  const dataset = getCachedCollectionData();
  if (!dataset) return null;
  const char = dataset.characters[tokenId - 1];
  if (!char) return null;
  return char.bitmap as [string, string, string, string];
}

/**
 * ZK-aware question lookup by numeric ID.
 */
export function findSchizodioQuestion(questionId: number) {
  return SCHIZODIO_QUESTIONS.find((q) => q.id === questionId) ?? null;
}

/**
 * Evaluate answer via bitmap for a given character and question.
 */
export function evaluateQuestionByBitmap(
  characterId: string,
  questionId: number,
): boolean {
  const bitmap = getNftBitmap(characterId);
  if (!bitmap) return false;
  return evaluateBit(bitmap, questionId);
}

/**
 * Auto-eliminate characters based on the answered question.
 */
export function computeAutoEliminations(
  characters: Character[],
  alreadyEliminated: string[],
  questionId: number,
  answer: boolean,
): string[] {
  const toEliminate: string[] = [];
  const elimSet = new Set(alreadyEliminated);
  for (const char of characters) {
    if (elimSet.has(char.id)) continue;
    const bitmap = getNftBitmap(char.id);
    if (!bitmap) continue;
    const matchesQuestion = evaluateBit(bitmap, questionId);
    const shouldEliminate = answer ? !matchesQuestion : matchesQuestion;
    if (shouldEliminate) {
      toEliminate.push(char.id);
    }
  }
  return toEliminate;
}

const initialState: GameState = {
  phase: GamePhase.MENU,
  mode: 'free',
  characters: CHARACTERS,
  activePlayer: 'player1',
  turnNumber: 1,
  boardRotation: 0,
  players: {
    player1: { secretCharacterId: null, eliminatedCharacterIds: [] },
    player2: { secretCharacterId: null, eliminatedCharacterIds: [] },
  },
  currentQuestion: null,
  cpuQuestion: null,
  opponentQuestion: null,
  questionHistory: [],
  winner: null,
  guessedCharacterId: null,
  gameSessionId: generateGameSessionId(),
  commitmentStatus: 'none',
  onChainCommitmentHash: null,
  onlineGameId: null,
  onlineRoomCode: null,
  onlinePlayerNum: null,
  onlineSubMode: null,
  onChainState: {
    lastMoveTimestamp: null,
    activePlayer: null,
    status: null,
    phase: null,
    winner: null,
    p1_state: null,
    p2_state: null,
  },
  soundEnabled: true,
  dangerZoneEnabled: true,
  simultaneousStatus: {
    local: 'picking',
    remote: 'waiting',
  },
  isOnChainSyncing: false,
  // ZK Extensions
  starknetGameId: null,
  proofError: null,
  processedTurnIds: new Set(),
};

export const useGameStore = create<GameState & GameActions>()(
  immer((set) => ({
    ...initialState,

    setGameMode: (mode, characters) =>
      set((state) => {
        state.mode = mode;
        if (characters) {
          state.characters = characters;
        } else {
          state.characters = CHARACTERS;
        }
      }),

    startSetup: () =>
      set((state) => {
        state.phase = GamePhase.SETUP_P1;
      }),

    selectSecretCharacter: (player, characterId) =>
      set((state) => {
        state.players[player].secretCharacterId = characterId;

        if (state.mode === 'nft' || state.mode === 'online') {
          createCommitment(player, characterId, state.gameSessionId);
        }

        if (state.mode === 'online') {
          // Online mode: We don't advance phase or trigger chain here anymore.
          // The UI component (CharacterSelectScreen) will handle the orchestration
          // or we provide a dedicated action for it.
          // For now, just store the secret internally.
          return;
        }

        if (player === 'player1') {
          if (state.mode === 'free' || state.mode === 'nft-free') {
            // CPU picks a random character automatically
            const pool = state.characters.filter((c) => c.id !== characterId);
            const cpuPick = pool[Math.floor(Math.random() * pool.length)];
            if (cpuPick) state.players.player2.secretCharacterId = cpuPick.id;
            state.commitmentStatus = 'both';
            state.phase = GamePhase.HANDOFF_START;
          } else {
            state.commitmentStatus = 'partial';
            state.phase = GamePhase.HANDOFF_P1_TO_P2;
          }
        } else {
          state.commitmentStatus = 'both';
          state.phase = GamePhase.HANDOFF_START;
        }
      }),

    assignRandomSecretCharacter: (player) =>
      set((state) => {
        const pool = state.characters;
        const randomChar = pool[Math.floor(Math.random() * pool.length)];
        if (!randomChar) return;

        state.players[player].secretCharacterId = randomChar.id;

        if (state.mode === 'nft' || state.mode === 'online') {
          createCommitment(player, randomChar.id, state.gameSessionId);
        }

        if (state.mode === 'online') {
          state.commitmentStatus = state.commitmentStatus === 'partial' ? 'both' : 'partial';
          state.phase = GamePhase.ONLINE_WAITING;
          return;
        }

        if (player === 'player1') {
          if (state.mode === 'free' || state.mode === 'nft-free') {
            const opponentPool = state.characters.filter((c) => c.id !== randomChar.id);
            const cpuPick = opponentPool[Math.floor(Math.random() * opponentPool.length)];
            if (cpuPick) state.players.player2.secretCharacterId = cpuPick.id;
            state.commitmentStatus = 'both';
            state.phase = GamePhase.HANDOFF_START;
          } else {
            state.commitmentStatus = 'partial';
            state.phase = GamePhase.HANDOFF_P1_TO_P2;
          }
        } else {
          state.commitmentStatus = 'both';
          state.phase = GamePhase.HANDOFF_START;
        }
      }),

    advancePhase: () =>
      set((state) => {
        switch (state.phase) {
          case GamePhase.HANDOFF_P1_TO_P2:
            state.phase = GamePhase.SETUP_P2;
            break;
          case GamePhase.HANDOFF_START:
            state.activePlayer = 'player1';
            state.boardRotation = 0;
            state.phase = GamePhase.QUESTION_SELECT;
            break;
          case GamePhase.HANDOFF_TO_OPPONENT:
            state.phase = GamePhase.ANSWER_PENDING;
            break;
          case GamePhase.ANSWER_REVEALED: {
            // Apply local player's elimination based on their question + opponent's answer
            const q = state.currentQuestion;
            if (q) {
              const eliminated = state.players[state.activePlayer].eliminatedCharacterIds;
              const fullQuestion = QUESTIONS.find((qn) => qn.id === q.questionId);
              if (fullQuestion) {
                const elimSet = new Set(eliminated);
                for (const char of state.characters) {
                  if (elimSet.has(char.id)) continue;
                  const matchesQuestion = evaluateQuestion(fullQuestion, char);
                  const shouldEliminate = q.answer ? !matchesQuestion : matchesQuestion;
                  if (shouldEliminate) {
                    eliminated.push(char.id);
                  }
                }
              }
            }

            // Online mode: opponent's eliminations are already computed in
            // receiveOpponentQuestion() when the question+answer arrives.
            // No need to re-compute here.

            // In free/nft-free mode: simultaneously apply CPU's elimination
            if ((state.mode === 'free' || state.mode === 'nft-free') && state.cpuQuestion) {
              const cpuQ = state.cpuQuestion;
              const cpuEliminated = state.players.player2.eliminatedCharacterIds;
              const fullCpuQ = QUESTIONS.find((qn) => qn.id === cpuQ.questionId);
              if (fullCpuQ) {
                const cpuElimSet = new Set(cpuEliminated);
                for (const char of state.characters) {
                  if (cpuElimSet.has(char.id)) continue;
                  const matchesQuestion = evaluateQuestion(fullCpuQ, char);
                  const shouldEliminate = cpuQ.answer ? !matchesQuestion : matchesQuestion;
                  if (shouldEliminate) {
                    cpuEliminated.push(char.id);
                  }
                }
              }

              // CPU auto-win: if down to 1 remaining, auto-guess
              // Reuse cpuElimSet from above (or build fresh if needed)
              const cpuElimSetAuto = new Set(cpuEliminated);
              const cpuRemaining = state.characters.filter(
                (c) => !cpuElimSetAuto.has(c.id)
              );
              if (cpuRemaining.length === 1) {
                state.guessedCharacterId = cpuRemaining[0].id;
                state.activePlayer = 'player2';
                const p1Secret = state.players.player1.secretCharacterId;
                if (cpuRemaining[0].id === p1Secret) {
                  state.winner = 'player2';
                  state.phase = GamePhase.GUESS_RESULT;
                } else {
                  state.phase = GamePhase.GUESS_WRONG;
                }
                return;
              }
            }
            state.phase = GamePhase.AUTO_ELIMINATING;
            // Persist progress after eliminations are computed
            saveGameProgress(state);
            break;
          }
          case GamePhase.AUTO_ELIMINATING: {
            if (state.mode === 'online') {
              // Online simultaneous: reset for next round, skip TURN_TRANSITION
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.opponentQuestion = null;
              state.simultaneousStatus = { local: 'picking', remote: 'waiting' };
              state.phase = GamePhase.SIMULTANEOUS_ROUND;
            } else if (state.mode === 'free' || state.mode === 'nft-free') {
              // Free/CPU simultaneous mode
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.cpuQuestion = null;
              state.phase = GamePhase.TURN_TRANSITION;
            } else {
              const next = getOpponent(state.activePlayer);
              state.activePlayer = next;
              state.boardRotation = next === 'player1' ? 0 : Math.PI;
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.phase = GamePhase.TURN_TRANSITION;
            }
            break;
          }
          case GamePhase.TURN_TRANSITION:
            state.phase = GamePhase.QUESTION_SELECT;
            break;
          case GamePhase.GUESS_WRONG: {
            if (state.mode === 'free' || state.mode === 'nft-free' || state.mode === 'online') {
              // Simultaneous mode: local player stays active, no player switching
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.cpuQuestion = null;
              state.guessedCharacterId = null;

              if (state.mode === 'free' || state.mode === 'nft-free') {
                // Opponent (CPU) gets a free question because player risked it and failed!
                const cpuEliminated = state.players.player2.eliminatedCharacterIds;
                const cpuElimSetGW = new Set(cpuEliminated);
                const cpuRemaining = state.characters.filter((c) => !cpuElimSetGW.has(c.id));
                const cpuAskedIds = new Set(
                  state.questionHistory
                    .filter((r) => r.askedBy === 'player2')
                    .map((r) => r.questionId),
                );

                const cpuBestQ = pickBestQuestionForCPU(cpuRemaining, cpuAskedIds);
                if (cpuBestQ) {
                  const p1SecretId = state.players.player1.secretCharacterId;
                  const p1SecretChar = state.characters.find((c) => c.id === p1SecretId);
                  const cpuAnswer = p1SecretChar ? evaluateQuestion(cpuBestQ, p1SecretChar) : false;

                  const cpuRecord = {
                    questionId: cpuBestQ.id,
                    questionText: cpuBestQ.text,
                    traitKey: cpuBestQ.traitKey,
                    traitValue: cpuBestQ.traitValue,
                    answer: cpuAnswer,
                    askedBy: 'player2' as PlayerId,
                    turnNumber: state.turnNumber,
                  };
                  state.cpuQuestion = cpuRecord;
                  state.questionHistory.push(cpuRecord);

                  // Jump straight to ANSWER_REVEALED (so player sees CPU's free question)
                  state.phase = GamePhase.ANSWER_REVEALED;
                } else {
                  state.phase = GamePhase.TURN_TRANSITION;
                }
              } else {
                // Online mode: wrong guess → back to simultaneous round, not TURN_TRANSITION
                state.opponentQuestion = null;
                state.simultaneousStatus = { local: 'picking', remote: 'waiting' };
                state.phase = GamePhase.SIMULTANEOUS_ROUND;
              }
            } else {
              const next = getOpponent(state.activePlayer);
              state.activePlayer = next;
              state.boardRotation = next === 'player1' ? 0 : Math.PI;
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.guessedCharacterId = null;
              state.phase = GamePhase.TURN_TRANSITION;
            }
            break;
          }
          case GamePhase.GUESS_RESULT:
            state.phase = GamePhase.GAME_OVER;
            break;
        }
      }),

    askQuestion: (questionId) =>
      set((state) => {
        const q = QUESTIONS.find((q) => q.id === questionId);
        if (!q) return;

        // Local mode: auto-evaluate active player's question immediately
        const opponent = getOpponent(state.activePlayer);
        const secretId = state.players[opponent].secretCharacterId;
        const secretChar = state.characters.find((c) => c.id === secretId);
        const autoAnswer = secretChar ? evaluateQuestion(q, secretChar) : false;

        const record = {
          questionId,
          questionText: q.text,
          traitKey: q.traitKey,
          traitValue: q.traitValue,
          answer: autoAnswer,
          askedBy: state.activePlayer,
          turnNumber: state.turnNumber,
        };

        state.currentQuestion = record;
        state.questionHistory.push(record);

        // For online mode, we don't have the answer yet - wait for Supabase sync
        if (state.mode === 'online') {
          state.simultaneousStatus.local = 'asked';
          return;
        }

        // Free/cpu mode: CPU simultaneously picks and answers its own question
        if (state.mode === 'free' || state.mode === 'nft-free') {
          const cpuEliminated = state.players.player2.eliminatedCharacterIds;
          const cpuElimSetAsk = new Set(cpuEliminated);
          const cpuRemaining = state.characters.filter((c) => !cpuElimSetAsk.has(c.id));
          const cpuAskedIds = new Set(
            state.questionHistory
              .filter((r) => r.askedBy === 'player2')
              .map((r) => r.questionId),
          );

          const cpuBestQ = pickBestQuestionForCPU(cpuRemaining, cpuAskedIds);
          if (cpuBestQ) {
            const p1SecretId = state.players.player1.secretCharacterId;
            const p1SecretChar = state.characters.find((c) => c.id === p1SecretId);
            const cpuAnswer = p1SecretChar ? evaluateQuestion(cpuBestQ, p1SecretChar) : false;

            const cpuRecord = {
              questionId: cpuBestQ.id,
              questionText: cpuBestQ.text,
              traitKey: cpuBestQ.traitKey,
              traitValue: cpuBestQ.traitValue,
              answer: cpuAnswer,
              askedBy: 'player2' as PlayerId,
              turnNumber: state.turnNumber,
            };
            state.cpuQuestion = cpuRecord;
            state.questionHistory.push(cpuRecord);
          }
        }

        state.phase = GamePhase.ANSWER_REVEALED;
      }),

    answerQuestion: (answer) =>
      set((state) => {
        if (state.mode === 'online' || state.phase === GamePhase.SIMULTANEOUS_ROUND) {
          if (!state.opponentQuestion) return;
          state.opponentQuestion.answer = answer;
          state.simultaneousStatus.remote = 'answered';
          // If my own answer already arrived, both sides are done — advance
          if (state.simultaneousStatus.local === 'revealed') {
            state.phase = GamePhase.ANSWER_REVEALED;
          }
          return;
        }

        if (!state.currentQuestion) return;
        state.currentQuestion.answer = answer;
        state.phase = GamePhase.ANSWER_REVEALED;
      }),

    toggleElimination: (characterId) =>
      set((state) => {
        const eliminated = state.players[state.activePlayer].eliminatedCharacterIds;
        const idx = eliminated.indexOf(characterId);
        if (idx >= 0) {
          eliminated.splice(idx, 1);
        } else {
          eliminated.push(characterId);
        }
      }),

    finishElimination: () =>
      set((state) => {
        if (state.mode === 'online') {
          // In simultaneous online mode, we just finished our local elimination task.
          // Reset status for next round.
          state.simultaneousStatus = { local: 'picking', remote: 'waiting' };
          state.turnNumber += 1;
          state.currentQuestion = null;
          state.opponentQuestion = null;
          state.phase = GamePhase.SIMULTANEOUS_ROUND;
          return;
        }

        const next = getOpponent(state.activePlayer);
        state.activePlayer = next;
        state.boardRotation = next === 'player1' ? 0 : Math.PI;
        state.turnNumber += 1;
        state.currentQuestion = null;
        state.phase = GamePhase.TURN_TRANSITION;
      }),

    startGuess: () =>
      set((state) => {
        state.phase = GamePhase.GUESS_SELECT;
      }),

    cancelGuess: () =>
      set((state) => {
        if (state.mode === 'online') {
          // Online simultaneous: always go back to SIMULTANEOUS_ROUND, never QUESTION_SELECT
          state.guessedCharacterId = null;
          state.phase = GamePhase.SIMULTANEOUS_ROUND;
          return;
        }
        if (state.currentQuestion && state.mode !== 'free' && state.mode !== 'nft-free') {
          // Non-free modes: cancelling after asking ends the turn
          const next = getOpponent(state.activePlayer);
          state.activePlayer = next;
          state.boardRotation = next === 'player1' ? 0 : Math.PI;
          state.turnNumber += 1;
          state.currentQuestion = null;
          state.phase = GamePhase.TURN_TRANSITION;
        } else {
          // Free mode or no question yet: return to question select
          state.currentQuestion = null;
          state.cpuQuestion = null;
          state.phase = GamePhase.QUESTION_SELECT;
        }
      }),

    makeGuess: (characterId) =>
      set((state) => {
        state.guessedCharacterId = characterId;

        if (state.mode === 'online') {
          // In true simultaneous online mode, we instantly check against opponent's locally-known secret.
          // Note: The sync hook already verifies Game Over conditions. 
          const opponent = state.activePlayer === 'player1' ? 'player2' : 'player1';
          const opponentSecretId = state.players[opponent].secretCharacterId;
          const isCorrect = characterId === opponentSecretId;

          if (isCorrect) {
            state.winner = state.activePlayer;
            state.phase = GamePhase.GUESS_RESULT;
          } else {
            // Local evaluation showed it's wrong - wait for sync to confirm or resolve?
            // Actually in online mode, we can trust local evaluation if we have the opponent's secret stored.
            // But we often DON'T have it until the end. So we should wait for GUESS_RESULT.
            state.phase = GamePhase.ANSWER_PENDING; // Misusing phase slightly as "Wait for Supabase"
          }
          return;
        }

        // Evaluate the active player's guess
        const opponent = getOpponent(state.activePlayer);
        const opponentSecretId = state.players[opponent].secretCharacterId;
        const p1IsCorrect = characterId === opponentSecretId;

        if (state.mode === 'free' || state.mode === 'nft-free') {
          // Check if CPU simultaneously wants to risk it this round
          const cpuEliminated = state.players.player2.eliminatedCharacterIds;
          const cpuElimSetGuess = new Set(cpuEliminated);
          const cpuRemaining = state.characters.filter((c) => !cpuElimSetGuess.has(c.id));
          let cpuRiskTarget: string | null = null;
          if (cpuRemaining.length === 1) {
            cpuRiskTarget = cpuRemaining[0].id;
          } else if (cpuRemaining.length === 2 && Math.random() < 0.35) {
            cpuRiskTarget = cpuRemaining[Math.floor(Math.random() * 2)].id;
          }

          if (cpuRiskTarget) {
            const p1SecretId = state.players.player1.secretCharacterId;
            const cpuIsCorrect = cpuRiskTarget === p1SecretId;

            if (p1IsCorrect && cpuIsCorrect) {
              // Both correct simultaneously → DRAW
              state.winner = null;
              state.phase = GamePhase.GUESS_RESULT;
            } else if (p1IsCorrect) {
              state.winner = state.activePlayer;
              state.phase = GamePhase.GUESS_RESULT;
            } else if (cpuIsCorrect) {
              state.winner = 'player2';
              state.phase = GamePhase.GUESS_RESULT;
            } else {
              // Both wrong — game continues
              state.phase = GamePhase.GUESS_WRONG;
            }
          } else {
            // CPU doesn't risk this round
            if (p1IsCorrect) {
              state.winner = state.activePlayer;
              state.phase = GamePhase.GUESS_RESULT;
            } else {
              state.phase = GamePhase.GUESS_WRONG;
            }
          }
          return;
        }

        // NFT local pass-and-play mode: non-simultaneous evaluation
        if (p1IsCorrect) {
          state.winner = state.activePlayer;
          state.phase = GamePhase.GUESS_RESULT;
        } else {
          state.phase = GamePhase.GUESS_WRONG;
        }
      }),

    resetGame: () =>
      set((state) => {
        clearCommitments(state.gameSessionId);
        const currentMode = state.mode;
        const currentChars = state.characters;
        Object.assign(state, initialState);
        state.mode = currentMode;
        state.characters = currentChars;
        state.players = {
          player1: { secretCharacterId: null, eliminatedCharacterIds: [] },
          player2: { secretCharacterId: null, eliminatedCharacterIds: [] },
        };
        state.questionHistory = [];
        state.gameSessionId = generateGameSessionId();
        state.commitmentStatus = 'none';
        state.onlinePlayerNum = null;
        state.opponentQuestion = null;

        // Clear saved session + progress on explicit reset/game over
        localStorage.removeItem('guessnft_online_session');
        clearGameProgress();
      }),

    // ─── Online-specific actions ───────────────────────────────────────────────

    recoverOnlineGame: (characters, currentAddress) =>
      set((state) => {
        const saved = localStorage.getItem('guessnft_online_session');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            
            // 1-hour expiration check
            const ONE_HOUR = 60 * 60 * 1000;
            const isExpired = Date.now() - parsed.timestamp > ONE_HOUR;
            
            // Address check (if we have a current wallet connected)
            const addressMatches = !currentAddress || !parsed.playerAddress || parsed.playerAddress === currentAddress;

            if (!isExpired && addressMatches) {
              state.mode = 'online';
              state.characters = characters;
              state.onlineGameId = parsed.gameId;
              // Sanitize: old sessions may have stored the raw UUID as starknetGameId.
              // Always ensure it's a 0x hex string.
              const rawId: string = parsed.starknetGameId || '';
              state.starknetGameId = rawId.startsWith('0x')
                ? rawId
                : rawId
                ? '0x' + rawId.replace(/-/g, '')
                : '0x' + parsed.gameId.replace(/-/g, '');
              state.gameSessionId = state.starknetGameId ?? state.gameSessionId;
              state.onlineRoomCode = parsed.roomCode;
              state.onlinePlayerNum = parsed.playerNum;

              // Restore secret character from localStorage commitment
              const myKey: 'player1' | 'player2' = parsed.playerNum === 2 ? 'player2' : 'player1';
              try {
                const commitments = JSON.parse(localStorage.getItem('guessnft_commitments') || '[]');
                const myCommitment = commitments.find(
                  (c: any) => c.playerId === myKey && c.gameSessionId === state.gameSessionId
                );
                if (myCommitment?.characterId) {
                  state.players[myKey].secretCharacterId = myCommitment.characterId;
                  console.log('[recovery] Restored secret character:', myCommitment.characterId);
                }
              } catch { /* commitment not found — non-fatal */ }

              // Restore game progress (eliminations, turn, question history)
              const progress = loadGameProgress(parsed.gameId);
              if (progress) {
                state.turnNumber = progress.turnNumber;
                state.players.player1.eliminatedCharacterIds = progress.p1Eliminated;
                state.players.player2.eliminatedCharacterIds = progress.p2Eliminated;
                state.questionHistory = progress.questionHistory;
                console.log('[recovery] Restored progress: turn', progress.turnNumber,
                  'p1 elim:', progress.p1Eliminated.length,
                  'p2 elim:', progress.p2Eliminated.length,
                  'questions:', progress.questionHistory.length);
              }

              state.phase = GamePhase.ONLINE_WAITING;
            } else {
              localStorage.removeItem('guessnft_online_session');
            }
          } catch (e) {
            localStorage.removeItem('guessnft_online_session');
          }
        }
      }),

    setOnlineGame: (gameId, roomCode, playerNum, playerAddress, subMode, starknetGameId) =>
      set((state) => {
        state.onlineGameId = gameId;
        state.starknetGameId = starknetGameId || ('0x' + gameId.replace(/-/g, ''));
        state.onlineRoomCode = roomCode;
        state.onlinePlayerNum = playerNum;
        state.onlineSubMode = subMode;
        // Canonical session key for commitment storage — must match what
        // createCommitment() and getCommitment() use.
        state.gameSessionId = state.starknetGameId;

        // Save session so we can recover on refresh
        localStorage.setItem('guessnft_online_session', JSON.stringify({
          gameId,
          starknetGameId: state.starknetGameId,
          roomCode,
          playerNum,
          playerAddress,
          subMode,
          timestamp: Date.now()
        }));
      }),

    advanceToGameStart: () =>
      set((state) => {
        // Guard: only advance from waiting phases (prevents double-fire from Torii + Supabase)
        if (
          state.phase !== GamePhase.ONLINE_WAITING &&
          state.phase !== GamePhase.SETUP_P1 &&
          state.phase !== GamePhase.SETUP_P2
        ) return;

        // Called by sync hook when both players have committed — start the game
        state.commitmentStatus = 'both';
        // Simultaneous mode: active player is always the local user
        state.activePlayer = state.onlinePlayerNum === 2 ? 'player2' : 'player1';
        // Rotation is 0 for P1, PI for P2
        state.boardRotation = state.onlinePlayerNum === 2 ? Math.PI : 0;

        state.simultaneousStatus = {
          local: 'picking',
          remote: 'waiting',
        };
        state.phase = GamePhase.SIMULTANEOUS_ROUND;
      }),

    receiveOpponentQuestion: (questionIdOrNum, answer) =>
      set((state) => {
        // Resolve the question record from either a numeric bit-index or a string question id
        let qRecord: { id: string; text: string; traitKey: string; traitValue: string } | undefined;
        if (typeof questionIdOrNum === 'number') {
          const sq = findSchizodioQuestion(questionIdOrNum);
          if (!sq) return;
          qRecord = {
            id: `zkq_${sq.id}`,
            text: sq.text,
            traitKey: `nft_${sq.category}`,
            traitValue: sq.trait, // use the real trait value, not the broken text.split()
          };
        } else {
          const found = QUESTIONS.find((qn) => qn.id === questionIdOrNum);
          if (!found) return;
          qRecord = {
            id: found.id,
            text: found.text,
            traitKey: found.traitKey,
            traitValue: String(found.traitValue),
          };
        }

        const opponent = state.activePlayer === 'player1' ? 'player2' : 'player1';

        const record = {
          questionId: qRecord.id,
          questionText: qRecord.text,
          traitKey: qRecord.traitKey,
          traitValue: qRecord.traitValue,
          answer,
          askedBy: opponent as PlayerId,
          turnNumber: state.turnNumber,
        };

        state.opponentQuestion = record;
        state.questionHistory.push(record);

        // Compute opponent's eliminations immediately so OpponentCounter updates in real-time.
        // We know the opponent's question and our answer (what they'll use to eliminate).
        if (state.mode === 'online' && answer !== undefined && answer !== null) {
          const opponentKey = opponent as PlayerId;
          const opponentEliminated = state.players[opponentKey].eliminatedCharacterIds;
          const fullOppQ = QUESTIONS.find((qn) => qn.id === qRecord.id);
          if (fullOppQ) {
            const oppElimSet = new Set(opponentEliminated);
            for (const char of state.characters) {
              if (oppElimSet.has(char.id)) continue;
              const matchesQuestion = evaluateQuestion(fullOppQ, char);
              const shouldEliminate = answer ? !matchesQuestion : matchesQuestion;
              if (shouldEliminate) {
                opponentEliminated.push(char.id);
              }
            }
          }
        }

        // In online simultaneous mode: the answer was already auto-computed and sent —
        // no manual YES/NO needed. Mark remote as answered immediately and advance if ready.
        state.simultaneousStatus.remote = 'answered';
        if (state.mode === 'online' && state.simultaneousStatus.local === 'revealed') {
          state.phase = GamePhase.ANSWER_REVEALED;
        }
        // Persist after opponent question processing (includes their eliminations)
        saveGameProgress(state);
      }),

    applyOpponentAnswer: (answer) =>
      set((state) => {
        if (state.currentQuestion) {
          state.currentQuestion.answer = answer;

          // Also update the corresponding questionHistory entry — it was pushed with
          // a stale answer: false in askQuestion() because we didn't know the real
          // answer yet. Immer snapshots freeze previous state, so the history copy
          // is a separate object from currentQuestion.
          const historyEntry = state.questionHistory.find(
            (r) => r.questionId === state.currentQuestion!.questionId &&
                   r.turnNumber === state.currentQuestion!.turnNumber &&
                   r.askedBy === state.activePlayer
          );
          if (historyEntry) {
            historyEntry.answer = answer;
          }
        } else {
          // Fallback: currentQuestion was cleared by a phase transition before the
          // answer arrived. Find the most recent unanswered question in history.
          const lastMyQ = [...state.questionHistory]
            .reverse()
            .find((r) => r.askedBy === state.activePlayer && r.answer === false);
          if (lastMyQ) {
            lastMyQ.answer = answer;
          }
        }

        state.simultaneousStatus.local = 'revealed';

        // If we also answered their question, move to revealed phase
        if (state.simultaneousStatus.remote === 'answered') {
          state.phase = GamePhase.ANSWER_REVEALED;
        }
      }),

    receiveOpponentGuess: (characterId, isCorrect, winnerPlayerNum) =>
      set((state) => {
        state.guessedCharacterId = characterId;
        if (isCorrect && winnerPlayerNum !== null) {
          // If opponent guessed right, game over.
          state.winner = winnerPlayerNum === 1 ? 'player1' : 'player2';
          state.phase = GamePhase.GUESS_RESULT;
          saveGameProgress(state);
        } else {
          // Opponent guessed wrong — ignore. It doesn't affect our local simultaneous turn.
        }
      }),

    applyGuessResult: (isCorrect, winner) =>
      set((state) => {
        if (isCorrect && winner !== null) {
          state.winner = winner;
          state.phase = GamePhase.GUESS_RESULT;
        } else {
          state.phase = GamePhase.GUESS_WRONG;
        }
      }),

    goBackToSetupP1: () =>
      set((state) => {
        if (state.phase === GamePhase.SETUP_P2) {
          state.phase = GamePhase.SETUP_P1;
          state.players.player2.secretCharacterId = null;
        }
      }),

    enrichNFTCharacters: (traitMap) =>
      set((state) => {
        enrichCharacters(state.characters, traitMap);
      }),

    setSoundEnabled: (enabled) =>
      set((state) => {
        state.soundEnabled = enabled;
      }),

    setDangerZoneEnabled: (enabled) =>
      set((state) => {
        state.dangerZoneEnabled = enabled;
      }),

    setCommitmentHash: (hash) =>
      set((state) => {
        state.onChainCommitmentHash = hash;
      }),

    setIsOnChainSyncing: (syncing) =>
      set((state) => {
        state.isOnChainSyncing = syncing;
      }),

    // ZK Actions
    setZkPhase: (phase: GamePhase) =>
      set((state) => {
        state.phase = phase;
      }),

    setVerifiedAnswer: (answer: boolean) =>
      set((state) => {
        if (state.currentQuestion) {
          state.currentQuestion.answer = answer;
        }
        state.phase = GamePhase.ANSWER_REVEALED;
      }),

    setActivePlayer: (player: PlayerId) =>
      set((state) => {
        state.activePlayer = player;
      }),

    setWinner: (player: PlayerId | null) =>
      set((state) => {
        state.winner = player;
      }),

    setProofError: (message: string) =>
      set((state) => {
        state.proofError = message;
      }),

    clearProofError: () =>
      set((state) => {
        state.proofError = null;
      }),

    syncOnChainState: async () => {
      const { gameSessionId } = useGameStore.getState();
      if (!gameSessionId) return;
      try {
        const contract = getGameContract();
        const game = await contract.getGame(gameSessionId);
        set((state) => {
          state.onChainState = {
            lastMoveTimestamp: game.lastMoveTimestamp,
            activePlayer: game.activePlayer,
            status: game.status,
            phase: game.phase,
            winner: game.winner,
            p1_state: game.p1_state,
            p2_state: game.p2_state,
          };
        });
      } catch (err) {
        console.error('[gameStore] Failed to sync on-chain state:', err);
      }
    },

    submitMoveOnChain: async () => {
      const { onlineGameId, phase, currentQuestion, guessedCharacterId } = useGameStore.getState();
      const gameId = onlineGameId; 
      if (!gameId) return;
      try {
        const contract = getGameContract();
        
        if (phase === GamePhase.QUESTION_SELECT && currentQuestion) {
          // Strip 'zkq_' prefix for ZK questions, or 'nq_' for NFT questions
          let qId = currentQuestion.questionId;
          if (qId.startsWith('zkq_')) qId = qId.slice(4);
          else if (qId.startsWith('nq_')) {
            // Manual mapping or fallback (these should ideally be handled via ZK indices)
            // For now, if we allow nq_ in online mode, we need a mapping.
            // But we filtered them in UI, so zkq_ is more likely.
          }

          console.log('[gameStore] On-chain: Ask Question', qId);
          await contract.askQuestion(gameId, qId);
        } else if (guessedCharacterId) {
          // Strip 'nft_' prefix for character guesses
          let charId = guessedCharacterId;
          if (charId.startsWith('nft_')) charId = charId.slice(4);

          console.log('[gameStore] On-chain: Make Guess', charId);
          await contract.makeGuess(gameId, charId);
        }

        await useGameStore.getState().syncOnChainState();
      } catch (err) {
        console.error('[gameStore] Failed to submit move on-chain:', err);
        throw err;
      }
    },

    claimTimeoutOnChain: async () => {
      const { gameSessionId } = useGameStore.getState();
      if (!gameSessionId) return;
      try {
        const contract = getGameContract();
        await contract.claimTimeoutWin(gameSessionId);
        await useGameStore.getState().syncOnChainState();
      } catch (err) {
        console.error('[gameStore] Failed to claim timeout:', err);
        throw err;
      }
    },

    cancelGameOnChain: async () => {
      const { gameSessionId } = useGameStore.getState();
      if (!gameSessionId) return;
      try {
        const contract = getGameContract();
        await contract.cancelGame(gameSessionId);
        await useGameStore.getState().syncOnChainState();
      } catch (err) {
        console.error('[gameStore] Failed to cancel game:', err);
        throw err;
      }
    },

  }))
);
