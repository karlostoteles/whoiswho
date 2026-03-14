/**
 * useOnlineGameSync
 *
 * Manages real-time Supabase sync for online 1v1 games.
 * - Subscribes to game_events (opponent's actions) and the games table (status changes)
 * - Sends events when the local player takes actions
 * - Translates incoming events into game store actions
 *
 * Must be mounted for the duration of an online game.
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';
import type { PlayerId } from '@/core/store/types';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { QUESTIONS } from '@/core/data/questions';
import { getGameContract } from '@/services/starknet/starkzapService';
import { getCommitment } from '@/services/starknet/commitReveal';
import { useWalletStore } from '@/services/starknet/walletStore';

export function useOnlineGameSync() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const onlineGameId = useGameStore((s) => s.onlineGameId);
  const onlinePlayerNum = useGameStore((s) => s.onlinePlayerNum);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const guessedCharacterId = useGameStore((s) => s.guessedCharacterId);
  const turnNumber = useGameStore((s) => s.turnNumber);

  // Refs to avoid stale closures in event handlers
  const sentQuestionRef = useRef<string | null>(null);
  const sentGuessRef = useRef<string | null>(null);
  const sentAnswerForRef = useRef<string | null>(null); // question_id we already answered

  const myAddress = () => {
    try {
      // Dynamic require avoids a circular import: walletStore is also consumed by
      // gameStore (via commitReveal), and a static import here would create a cycle.
      const { useWalletStore } = require('@/services/starknet/walletStore');
      return useWalletStore.getState().address ?? 'anonymous';
    } catch {
      return 'anonymous';
    }
  };


  // ─── On-Chain Polling Logic ──────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;

    let isPolling = true;
    const POLLING_INTERVAL = 2000; // 2 seconds

    async function poll() {
      if (!isPolling || !onlineGameId) return;
      
      try {
        const contract = getGameContract();
        const onChainGame = await contract.getGame(onlineGameId);
        const state = useGameStore.getState();

        // 1. Handle Game Start Transition
        // Phase 3 is InProgress in EGS contract
        if (onChainGame.phase >= 3 && state.phase === GamePhase.ONLINE_WAITING) {
          console.log('[sync] On-chain game started! Advancing phase.');
          state.advanceToGameStart();
        }

        // 2. Handle Turn & Question Polling
        // If it's NOT my turn on-chain, and I'm waiting for an answer or guess
        // We need to see if the opponent has acted.
        if (onChainGame.activePlayer !== onlinePlayerNum) {
          // If I asked a question and it's nowanswered on-chain
          const myState = onlinePlayerNum === 1 ? onChainGame.p1_state : onChainGame.p2_state;
          const oppState = onlinePlayerNum === 1 ? onChainGame.p2_state : onChainGame.p1_state;

          // Note: In EGS, we might need a way to see the actual question content.
          // For now, if questions_asked increased for the opponent, we check for a new question.
        }

        // 3. Handle Game Over
        if (onChainGame.phase === 4 && state.phase !== GamePhase.GAME_OVER) {
          console.log('[sync] On-chain game over detected.');
          const isWinner = onChainGame.winner === myAddress();
          // state.finishGameLocally(isWinner); // Mocked for now
        }

      } catch (err) {
        console.error('[sync] On-chain polling failed:', err);
      }

      if (isPolling) {
        setTimeout(poll, POLLING_INTERVAL);
      }
    }

    poll();

    return () => {
      isPolling = false;
    };
  }, [mode, onlineGameId, onlinePlayerNum, phase]);

  return { checkAndAdvanceIfReady: () => {} };
}
