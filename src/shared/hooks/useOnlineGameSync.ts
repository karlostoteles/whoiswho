/**
 * useOnlineGameSync — unified online game synchronization.
 *
 * Single hook handling the entire online lifecycle:
 *   1. Torii polling → commitment phase (on-chain via starkzap)
 *   2. Supabase Realtime → gameplay events (Q&A, guesses)
 *
 * Previously split across useOnlineGameSync + useToriiGameSync + OnlineGameManager.
 * Consolidated because the contract only does 3 tx (create/join/commit) and
 * all gameplay runs off-chain via Supabase.
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';
import type { PlayerId } from '@/core/store/types';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { QUESTIONS } from '@/core/data/questions';
import {
  subscribeToGame,
  subscribeToEvents,
  sendEvent,
  finishGame,
  submitCommitment,
  getPastEvents,
} from '@/services/supabase/gameService';
import type { SupabaseGame, SupabaseGameEvent } from '@/services/supabase/types';
import { supabase } from '@/services/supabase/client';
import { TORII_URL } from '@/zk/toriiClient';
import { getCommitment } from '@/services/starknet/commitReveal';
import { getGameContract } from '@/services/starknet/starkzapService';
import { useWalletStore } from '@/services/starknet/walletStore';

// ─── Torii SQL helpers ──────────────────────────────────────────────────────

interface OnChainGame {
  game_id: string;
  phase: number;
  winner: string;
  player1: string;
  player2: string;
}

const CHAIN_PHASE = {
  WAITING: 0,
  COMMIT: 1,
  PLAYING: 2,
  COMPLETED: 3,
} as const;

function padGameId(raw: string): string {
  let hex = raw.startsWith('0x') ? raw : raw ? '0x' + raw.replace(/-/g, '') : '';
  if (hex && hex !== '0x') hex = '0x' + hex.slice(2).padStart(64, '0');
  return hex;
}

async function fetchGameFromTorii(paddedGameId: string): Promise<OnChainGame | null> {
  const q = encodeURIComponent(
    `SELECT game_id, phase, winner, player1, player2 FROM [guessnft-Game] WHERE game_id='${paddedGameId}' LIMIT 1`
  );
  const res = await fetch(`${TORII_URL}/sql?q=${q}`);
  if (!res.ok) return null;
  const rows: any[] = await res.json();
  if (rows.length === 0) return null;
  return {
    game_id: rows[0].game_id,
    phase: Number(rows[0].phase),
    winner: rows[0].winner ?? '0x0',
    player1: rows[0].player1 ?? '0x0',
    player2: rows[0].player2 ?? '0x0',
  };
}

// ─── Main hook ──────────────────────────────────────────────────────────────

export function useOnlineGameSync() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const onlineGameId = useGameStore((s) => s.onlineGameId);
  const onlinePlayerNum = useGameStore((s) => s.onlinePlayerNum);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const guessedCharacterId = useGameStore((s) => s.guessedCharacterId);
  const turnNumber = useGameStore((s) => s.turnNumber);

  // Dedup refs (Supabase)
  const sentQuestionRef = useRef<string | null>(null);
  const sentGuessRef = useRef<string | null>(null);
  const sentAnswerForRef = useRef<string | null>(null);

  // Torii commitment refs
  const lastChainPhaseRef = useRef<string | null>(null);
  const commitInFlightRef = useRef(false);
  const committedSessionRef = useRef<string | null>(null);

  const myAddress = () => {
    return useWalletStore.getState().address ?? 'anonymous';
  };

  // ─── Supabase: check if game started (backup path) ────────────────────────
  async function checkAndAdvanceIfReady(gameId: string) {
    try {
      const { data: game } = await supabase
        .from('games')
        .select('status')
        .eq('id', gameId)
        .single();
      if (game?.status === 'in_progress') {
        const s = useGameStore.getState();
        if (s.phase === GamePhase.ONLINE_WAITING) {
          s.advanceToGameStart();
        }
      }
    } catch (e) {
      console.error('[sync] checkAndAdvanceIfReady error', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TORII: on-chain commitment phase
  // ═══════════════════════════════════════════════════════════════════════════

  async function triggerCommitment(gameId: string, playerNum: 1 | 2) {
    if (commitInFlightRef.current) return;

    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    const s = useGameStore.getState();
    const sessionId = s.gameSessionId;

    // Try both gameSessionId and starknetGameId as lookup keys (BUG #1 fix)
    let storedCommitment = getCommitment(myKey, sessionId);
    if (!storedCommitment && s.starknetGameId && s.starknetGameId !== sessionId) {
      storedCommitment = getCommitment(myKey, s.starknetGameId);
    }

    if (!storedCommitment) {
      // BUG #3 fix: commitment might not exist yet (race with character select).
      // Don't log as error — just allow re-poll on next Torii cycle.
      return;
    }

    const sessionKey = `${gameId}:${storedCommitment.gameSessionId}:${playerNum}`;
    if (committedSessionRef.current === sessionKey) return;

    commitInFlightRef.current = true;
    const pedersenHash = storedCommitment.commitment;
    const chainAddr = myAddress();
    let supabaseOk = false;

    // 1. Submit to Supabase FIRST — this is what actually starts the game.
    //    When both players commit via Supabase, status → 'in_progress',
    //    and the backup polling calls advanceToGameStart().
    if (s.onlineGameId) {
      try {
        await submitCommitment(s.onlineGameId!, playerNum, pedersenHash, chainAddr, 0);
        console.log('[sync] Supabase commitment submitted for', myKey);
        supabaseOk = true;
      } catch (e) {
        // BUG #4/#9 fix: DON'T swallow — allow retry on next poll
        console.error('[sync] Supabase commitment FAILED — will retry:', e);
      }
    }

    // Only mark as committed if Supabase succeeded (BUG #9 fix)
    if (supabaseOk) {
      committedSessionRef.current = sessionKey;
    }

    // 2. Submit on-chain as best-effort (tamper-evidence audit trail).
    //    Don't block game start on this — Supabase handles game advancement.
    try {
      const contract = getGameContract();
      await contract.commitCharacter(gameId, pedersenHash);
      console.log('[sync] On-chain commitment successful');
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes('Already committed') || msg.includes('already committed')) {
        console.log('[sync] Already committed on-chain — OK');
      } else {
        console.warn('[sync] On-chain commitment failed (game continues via Supabase):', msg);
      }
    } finally {
      commitInFlightRef.current = false;
    }
  }

  function handleChainUpdate(game: OnChainGame, gameId: string, playerNum: 1 | 2) {
    const key = `phase:${game.phase}`;
    if (lastChainPhaseRef.current === key) return;
    lastChainPhaseRef.current = key;

    const s = useGameStore.getState();

    switch (game.phase) {
      case CHAIN_PHASE.WAITING:
        break;

      case CHAIN_PHASE.COMMIT: {
        const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
        if (!s.players[myKey].secretCharacterId) {
          s.startSetup();
        } else {
          s.setZkPhase(GamePhase.ONLINE_WAITING);
        }
        triggerCommitment(gameId, playerNum);
        // Allow re-poll if commitment not done yet
        const sessionKey = `${gameId}:${s.gameSessionId}:${playerNum}`;
        if (committedSessionRef.current !== sessionKey) {
          lastChainPhaseRef.current = null;
        }
        break;
      }

      case CHAIN_PHASE.PLAYING: {
        if (
          s.phase === GamePhase.ONLINE_WAITING ||
          s.phase === GamePhase.SETUP_P1 ||
          s.phase === GamePhase.SETUP_P2
        ) {
          s.advanceToGameStart();
          if (s.onlineGameId) {
            Promise.resolve(
              supabase.from('games')
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', s.onlineGameId)
            ).catch(console.error);
          }
        }
        break;
      }

      case CHAIN_PHASE.COMPLETED:
        break;
    }
  }

  // ─── Torii polling (3s interval) ──────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlinePlayerNum) return;

    const rawId = useGameStore.getState().starknetGameId || onlineGameId || '';
    const gameId = padGameId(rawId);
    if (!gameId || gameId === '0x') return;

    const playerNum = onlinePlayerNum as 1 | 2;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const game = await fetchGameFromTorii(gameId);
        if (!cancelled && game) handleChainUpdate(game, gameId, playerNum);
      } catch { /* non-fatal */ }
    }

    poll();
    const id = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
      lastChainPhaseRef.current = null;
      commitInFlightRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlineGameId, onlinePlayerNum]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPABASE: realtime gameplay events
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Subscribe to Supabase Realtime ───────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;

    const gameSub = subscribeToGame(onlineGameId, handleGameUpdate);
    const eventSub = subscribeToEvents(onlineGameId, handleEvent);

    return () => {
      supabase.removeChannel(gameSub);
      supabase.removeChannel(eventSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlineGameId, onlinePlayerNum]);

  // ─── Replay missed events on recovery ────────────────────────────────────
  const hasReplayedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (hasReplayedRef.current) return;
    // Only replay once we've advanced past ONLINE_WAITING (game is active)
    if (phase === GamePhase.ONLINE_WAITING || phase === GamePhase.MENU ||
        phase === GamePhase.SETUP_P1 || phase === GamePhase.SETUP_P2) return;

    hasReplayedRef.current = true;
    const state = useGameStore.getState();
    const knownTurns = new Set(state.questionHistory.map(
      (q) => `${q.turnNumber}:${q.questionId}`
    ));

    // Fetch past events and replay any we missed
    getPastEvents(onlineGameId).then((events) => {
      for (const event of events) {
        if (event.player_num === onlinePlayerNum) continue; // skip our own events

        switch (event.event_type) {
          case 'QUESTION_ASKED': {
            const { question_id } = event.payload as { question_id: string };
            const eventKey = `${event.turn_number}:${question_id}`;
            if (knownTurns.has(eventKey)) continue; // already in history

            // We need to evaluate and respond to this question
            const s = useGameStore.getState();
            const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
            const mySecretId = s.players[myPlayerKey].secretCharacterId;
            const myChar = s.characters.find((c) => c.id === mySecretId);
            const q = QUESTIONS.find((q) => q.id === question_id);
            if (!q || !myChar) continue;

            const answer = evaluateQuestion(q, myChar);
            s.receiveOpponentQuestion(question_id, answer);

            // Also re-send the answer in case opponent missed it
            sendEvent(
              onlineGameId, 'ANSWER_GIVEN', onlinePlayerNum,
              myAddress(), event.turn_number,
              { answer, question_id }
            ).catch(console.error);
            break;
          }

          case 'ANSWER_GIVEN': {
            const { answer } = event.payload as { answer: boolean };
            const s = useGameStore.getState();
            // Only apply if we have a pending question without answer
            if (s.currentQuestion && s.simultaneousStatus.local === 'asked') {
              s.applyOpponentAnswer(answer);
            }
            break;
          }

          case 'GUESS_MADE': {
            const { character_id } = event.payload as { character_id: string };
            const s = useGameStore.getState();
            const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
            const mySecretId = s.players[myPlayerKey].secretCharacterId;
            const isCorrect = character_id === mySecretId;
            const opponentPlayerNum = event.player_num as 1 | 2;
            const winnerPlayerNum: 1 | 2 | null = isCorrect ? opponentPlayerNum : null;
            s.receiveOpponentGuess(character_id, isCorrect, winnerPlayerNum);
            break;
          }
        }
      }
      console.log('[sync] Event replay complete, processed', events.length, 'past events');
    }).catch((e) => console.error('[sync] Event replay failed:', e));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ─── Backup game-start polling ────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;

    const gameId = onlineGameId;
    const id = setInterval(() => checkAndAdvanceIfReady(gameId), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ─── Send QUESTION_ASKED ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.SIMULTANEOUS_ROUND && phase !== GamePhase.ANSWER_REVEALED) return;
    if (!currentQuestion) return;

    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    if (currentQuestion.askedBy !== myPlayerKey) return;
    const questionKey = `${currentQuestion.turnNumber}:${currentQuestion.questionId}`;
    if (sentQuestionRef.current === questionKey) return;

    sentQuestionRef.current = questionKey;

    sendEvent(
      onlineGameId, 'QUESTION_ASKED', onlinePlayerNum,
      myAddress(), currentQuestion.turnNumber,
      { question_id: currentQuestion.questionId }
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.questionId, turnNumber]);

  // ─── Send GUESS_MADE ─────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING) return;
    if (!guessedCharacterId) return;
    if (currentQuestion) return;
    if (sentGuessRef.current === guessedCharacterId) return;

    sentGuessRef.current = guessedCharacterId;

    sendEvent(
      onlineGameId, 'GUESS_MADE', onlinePlayerNum,
      myAddress(), turnNumber,
      { character_id: guessedCharacterId }
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessedCharacterId, phase]);

  // ─── Handle Supabase game status updates ──────────────────────────────────
  function handleGameUpdate(game: SupabaseGame) {
    const state = useGameStore.getState();
    if (game.status === 'in_progress' && state.phase === GamePhase.ONLINE_WAITING) {
      state.advanceToGameStart();
    }
  }

  // ─── Handle incoming Supabase events ──────────────────────────────────────
  function handleEvent(event: SupabaseGameEvent) {
    if (event.player_num === onlinePlayerNum) return;

    const state = useGameStore.getState();

    switch (event.event_type) {
      case 'CHARACTER_COMMITTED': {
        if (state.phase === GamePhase.ONLINE_WAITING && state.onlineGameId) {
          checkAndAdvanceIfReady(state.onlineGameId);
        }
        break;
      }

      case 'QUESTION_ASKED': {
        const { question_id } = event.payload as { question_id: string };

        const answerKey = `${event.turn_number}:${question_id}`;
        if (sentAnswerForRef.current === answerKey) return;
        sentAnswerForRef.current = answerKey;

        const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
        const mySecretId = state.players[myPlayerKey].secretCharacterId;
        const myChar = state.characters.find((c) => c.id === mySecretId);
        const q = QUESTIONS.find((q) => q.id === question_id);

        if (!q || !myChar) {
          console.warn('[sync] Cannot evaluate question — missing data', { question_id, mySecretId });
          return;
        }

        const answer = evaluateQuestion(q, myChar);

        sendEvent(
          state.onlineGameId!, 'ANSWER_GIVEN', onlinePlayerNum!,
          myAddress(), event.turn_number,
          { answer, question_id }
        ).catch(console.error);

        state.receiveOpponentQuestion(question_id, answer);
        break;
      }

      case 'ANSWER_GIVEN': {
        const { answer } = event.payload as { answer: boolean };
        state.applyOpponentAnswer(answer);
        break;
      }

      case 'GUESS_MADE': {
        const { character_id } = event.payload as { character_id: string };

        const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
        const mySecretId = state.players[myPlayerKey].secretCharacterId;
        const isCorrect = character_id === mySecretId;

        const opponentPlayerNum = event.player_num as 1 | 2;
        const winnerPlayerNum: 1 | 2 | null = isCorrect ? opponentPlayerNum : null;

        sendEvent(
          state.onlineGameId!, 'GUESS_RESULT', onlinePlayerNum!,
          myAddress(), event.turn_number,
          { is_correct: isCorrect, winner_player_num: winnerPlayerNum }
        ).catch(console.error);

        if (isCorrect) {
          finishGame(state.onlineGameId!, opponentPlayerNum).catch(console.error);
        }

        state.receiveOpponentGuess(character_id, isCorrect, winnerPlayerNum);
        break;
      }

      case 'GUESS_RESULT': {
        const { is_correct, winner_player_num } = event.payload as {
          is_correct: boolean;
          winner_player_num: 1 | 2 | null;
        };

        const winner: PlayerId | null =
          winner_player_num === 1 ? 'player1' :
          winner_player_num === 2 ? 'player2' :
          null;

        state.applyGuessResult(is_correct, winner);
        break;
      }

      case 'CHARACTER_REVEALED':
        break;

      default:
        break;
    }
  }

  return { checkAndAdvanceIfReady };
}
