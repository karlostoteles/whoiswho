import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import { useActivePlayer, useEliminatedIds, useCurrentQuestion, useGameActions, useGameCharacters } from '@/core/store/selectors';

export function GuessPanel() {
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const currentQuestion = useCurrentQuestion();
  const { makeGuess, cancelGuess } = useGameActions();
  const previews = useCharacterPreviews();
  const characters = useGameCharacters();
  const midTurn = currentQuestion !== null;
  const elimSet = new Set(eliminatedIds);

  // Sort: non-eliminated first, then eliminated
  const sortedCharacters = [...characters].sort((a, b) => {
    const aElim = elimSet.has(a.id) ? 1 : 0;
    const bElim = elimSet.has(b.id) ? 1 : 0;
    return aElim - bElim;
  });

  const remainingCount = characters.length - elimSet.size;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <Card style={{
        width: 'min(700px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 24,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #E8A444, #E05555)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 4,
          }}>
            🎯 Risk It All!
          </div>
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,254,0.4)',
            marginBottom: 8,
          }}>
            Guess wrong and you lose your turn — get it right to win!
          </div>
          <div style={{
            fontSize: 12,
            color: '#E8A444',
            fontWeight: 600,
            marginBottom: 12,
          }}>
            {remainingCount} candidate{remainingCount !== 1 ? 's' : ''} remaining
          </div>
          <Button variant="secondary" size="sm" onClick={cancelGuess}>
            {midTurn ? 'Nevermind, end turn' : 'Go Back'}
          </Button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: 10,
        }}>
          {sortedCharacters.map((char) => {
            const isEliminated = elimSet.has(char.id);
            return (
              <motion.button
                key={char.id}
                onClick={() => !isEliminated && makeGuess(char.id)}
                whileHover={isEliminated ? {} : { scale: 1.08, borderColor: 'rgba(232,164,68,0.5)' }}
                whileTap={isEliminated ? {} : { scale: 0.95 }}
                style={{
                  background: isEliminated
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${isEliminated ? 'rgba(255,255,255,0.05)' : 'rgba(232,164,68,0.25)'}`,
                  borderRadius: 10,
                  padding: 6,
                  cursor: isEliminated ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  opacity: isEliminated ? 0.15 : 1,
                }}
              >
                <img
                  src={previews.get(char.id)}
                  alt={char.name}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 6,
                    objectFit: 'cover',
                    filter: isEliminated ? 'grayscale(1)' : 'none',
                  }}
                />
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#FFFFFE',
                }}>
                  {char.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
