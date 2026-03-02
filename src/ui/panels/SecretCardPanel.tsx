/**
 * SecretCardPanel
 *
 * Persistent bottom-left card showing the local player's secret character
 * during gameplay phases. Ensures your SCHIZODIO always has visual prominence
 * and you never lose track of which character you're playing as.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useGameMode, useOnlinePlayerNum } from '@/core/store/selectors';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';

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
  const phase         = usePhase();
  const mode          = useGameMode();
  const playerNum     = useOnlinePlayerNum();
  const [expanded, setExpanded] = useState(false);

  // Which player is "me"?
  const myPlayer = mode === 'online'
    ? (playerNum === 2 ? 'player2' : 'player1')
    : 'player1'; // in free/nft mode P1 is always the human

  const players    = useGameStore(s => s.players);
  const characters = useGameStore(s => s.characters);
  const secretId   = players[myPlayer].secretCharacterId;
  const myChar     = secretId ? characters.find(c => c.id === secretId) : null;

  if (!GAMEPLAY_PHASES.has(phase) || !myChar) return null;

  // Derive tokenId from id (e.g. 'nft_53' → '53') or explicit tokenId field
  const tokenId: string | undefined =
    (myChar as any).tokenId ?? (secretId?.startsWith('nft_') ? secretId.replace('nft_', '') : undefined);

  // imageUrl: explicit field on character, or construct via serverless proxy
  const imageUrl: string | undefined =
    (myChar as any).imageUrl ?? (tokenId ? `/api/nft-art/${tokenId}` : undefined);

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
        }}
      >
        <motion.div
          onClick={() => setExpanded(e => !e)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          style={{ cursor: 'pointer' }}
        >
          {/* Card container */}
          <motion.div
            animate={{ width: expanded ? 180 : 80 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{
              background: 'rgba(15,14,23,0.92)',
              border: '2px solid rgba(232,164,68,0.5)',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(232,164,68,0.2)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Portrait */}
            <div style={{
              width: expanded ? 180 : 76,
              height: expanded ? 180 : 76,
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
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
                  fontSize: 24,
                }}>
                  🎭
                </div>
              )}
              {/* Secret badge */}
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

            {/* Name + info (shown when expanded) */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ padding: '8px 10px 10px' }}
                >
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700, fontSize: 13, color: '#E8A444',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {myChar.name}
                  </div>
                  {tokenId && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,254,0.35)', marginTop: 2 }}>
                      #{tokenId}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,254,0.25)', marginTop: 4 }}>
                    Your secret character
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Label pill below card */}
          {!expanded && (
            <div style={{
              marginTop: 4,
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(232,164,68,0.5)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              YOUR CARD
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
