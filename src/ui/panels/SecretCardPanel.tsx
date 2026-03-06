/**
 * SecretCardPanel
 *
 * Always-visible card showing the local player's secret character.
 * Displayed at ~120px (no miniature). Click flips the card to reveal
 * the opponent's already-guessed traits highlighted in red.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useGameMode, useOnlinePlayerNum, useQuestionHistory } from '@/core/store/selectors';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';
import { QUESTIONS_BY_ID } from '@/core/data/questions';
import { getTraitCategory, getCategoryConfig, TRAIT_CATEGORIES_CONFIG } from './question/zoneConfig';

const GAMEPLAY_PHASES = new Set([
  GamePhase.QUESTION_SELECT,
  GamePhase.HANDOFF_TO_OPPONENT,
  GamePhase.ANSWER_PENDING,
  GamePhase.ANSWER_REVEALED,
  GamePhase.AUTO_ELIMINATING,
  GamePhase.ELIMINATION,
  GamePhase.TURN_TRANSITION,
  GamePhase.GUESS_SELECT,
  GamePhase.GUESS_WRONG,
]);

export function SecretCardPanel() {
  const phase = usePhase();
  const mode = useGameMode();
  const playerNum = useOnlinePlayerNum();
  const history = useQuestionHistory();
  const [flipped, setFlipped] = useState(false);

  const myPlayer = mode === 'online'
    ? (playerNum === 2 ? 'player2' : 'player1')
    : 'player1';

  const opponent = myPlayer === 'player1' ? 'player2' : 'player1';

  const players = useGameStore(s => s.players);
  const characters = useGameStore(s => s.characters);
  const secretId = players[myPlayer].secretCharacterId;
  const myChar = secretId ? characters.find(c => c.id === secretId) : null;

  // Opponent's guessed traits from question history
  const opponentTraits = useMemo(() => {
    const traits: { category: string; label: string; text: string; answer: boolean }[] = [];
    for (const record of history) {
      if (record.askedBy !== opponent || record.answer === null) continue;
      const q = QUESTIONS_BY_ID.get(record.questionId);
      if (!q) continue;
      const catId = getTraitCategory(q.traitKey);
      const cfg = catId ? getCategoryConfig(catId) : null;
      traits.push({
        category: cfg?.label || q.traitKey,
        label: q.text.replace(/^Does your character (have |wear |carry )?/i, '').replace(/\?$/, ''),
        text: q.text,
        answer: record.answer,
      });
    }
    return traits;
  }, [history, opponent]);

  if (!GAMEPLAY_PHASES.has(phase) || !myChar) return null;

  const tokenId: string | undefined =
    (myChar as any).tokenId ?? (secretId?.startsWith('nft_') ? secretId.replace('nft_', '') : undefined);

  const imageUrl: string | undefined =
    (myChar as any).imageUrl ?? (tokenId ? `/api/nft-art/${tokenId}` : undefined);

  const CARD_SIZE = 120;

  return (
    <AnimatePresence>
      <motion.div
        key="secret-card"
        initial={{ opacity: 0, x: -20, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.3 }}
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          zIndex: 15,
          pointerEvents: 'auto',
          userSelect: 'none',
          perspective: 800,
        }}
      >
        <motion.div
          onClick={() => setFlipped(f => !f)}
          style={{
            width: CARD_SIZE,
            cursor: 'pointer',
            transformStyle: 'preserve-3d',
          }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* ── FRONT: NFT portrait ── */}
          <div style={{
            backfaceVisibility: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              background: 'rgba(15,14,23,0.92)',
              border: '2px solid rgba(232,164,68,0.5)',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(232,164,68,0.2)',
            }}>
              <div style={{
                width: CARD_SIZE - 4,
                height: CARD_SIZE - 4,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={myChar.name}
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'cover', display: 'block',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(135deg, rgba(232,164,68,0.2), rgba(124,58,237,0.2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32,
                  }}>
                    🎭
                  </div>
                )}
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(232,164,68,0.9)',
                  borderRadius: 6, padding: '2px 6px',
                  fontSize: 9, fontWeight: 700, color: '#0F0E17',
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '0.06em',
                }}>
                  YOU
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 4, textAlign: 'center',
              fontSize: 9, fontWeight: 700,
              color: 'rgba(232,164,68,0.5)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              TAP TO FLIP
            </div>
          </div>

          {/* ── BACK: Opponent's guessed traits ── */}
          <div style={{
            backfaceVisibility: 'hidden',
            position: 'absolute',
            top: 0, left: 0,
            width: CARD_SIZE,
            transform: 'rotateY(180deg)',
          }}>
            <div style={{
              background: 'rgba(15,14,23,0.95)',
              border: '2px solid rgba(224,85,85,0.5)',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(224,85,85,0.2)',
              padding: '8px 6px',
              minHeight: CARD_SIZE - 4,
              maxHeight: 280,
              overflowY: 'auto',
            }}>
              <div style={{
                fontSize: 8, fontWeight: 700,
                letterSpacing: '0.1em', color: 'rgba(224,85,85,0.7)',
                textTransform: 'uppercase', textAlign: 'center',
                marginBottom: 6,
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                🕵️ Enemy Knows
              </div>

              {opponentTraits.length === 0 ? (
                <div style={{
                  fontSize: 9, color: 'rgba(255,255,254,0.3)',
                  textAlign: 'center', padding: '12px 0',
                  fontStyle: 'italic',
                }}>
                  No traits guessed yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {opponentTraits.map((t, i) => (
                    <div key={i} style={{
                      fontSize: 8,
                      padding: '3px 5px',
                      borderRadius: 6,
                      background: t.answer
                        ? 'rgba(224,85,85,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${t.answer ? 'rgba(224,85,85,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      color: t.answer ? '#FF6B6B' : 'rgba(255,255,254,0.3)',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 600,
                      lineHeight: 1.3,
                    }}>
                      <span style={{
                        fontSize: 7, fontWeight: 700,
                        color: t.answer ? '#FF6B6B' : 'rgba(255,255,254,0.2)',
                        letterSpacing: '0.06em',
                      }}>
                        {t.answer ? '✓ YES' : '✗ NO'}
                      </span>
                      {' '}
                      {t.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{
              marginTop: 4, textAlign: 'center',
              fontSize: 9, fontWeight: 700,
              color: 'rgba(224,85,85,0.5)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              TAP TO FLIP
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
