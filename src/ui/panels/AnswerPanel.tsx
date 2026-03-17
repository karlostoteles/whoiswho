import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useCurrentQuestion, useGameActions, useGameMode, useOpponentQuestion, useSimultaneousStatus, usePhase } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

export function AnswerPanel() {
  const currentQuestion = useCurrentQuestion();
  const opponentQuestion = useOpponentQuestion();
  const mode = useGameMode();
  const phase = usePhase();
  const simultStatus = useSimultaneousStatus();
  const { answerQuestion } = useGameActions();

  // In online simultaneous mode, we answer the opponent's question.
  // In local mode, we answer our own question (which we asked the CPU/Opponent).
  const isSimult = phase === GamePhase.SIMULTANEOUS_ROUND || mode === 'online';
  const question = isSimult ? opponentQuestion : currentQuestion;

  const isVisible = phase === GamePhase.SIMULTANEOUS_ROUND 
    ? simultStatus.remote === 'asked'
    : [GamePhase.ANSWER_PENDING, GamePhase.PROVING, GamePhase.SUBMITTING, GamePhase.VERIFIED].includes(phase);

  const displayQuestion = question || opponentQuestion;
  if (!isVisible || !displayQuestion) return null;

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9990,
        pointerEvents: 'auto',
        padding: 16,
      }}
    >
      <Card style={{
        width: 'min(400px, 100%)',
        textAlign: 'center',
        pointerEvents: 'auto',
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,254,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 16,
        }}>
          Opponent asks:
        </div>

        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(18px, 5vw, 22px)',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: 24,
            color: '#FFFFFE',
          }}
        >
          {displayQuestion.questionText}
        </motion.div>

        {phase === GamePhase.PROVING || phase === GamePhase.SUBMITTING ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#E8A444' }}
            />
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: '#E8A444', textTransform: 'uppercase' }}>
              {phase === GamePhase.PROVING ? 'Generating ZK Proof...' : 'Submitting to Chain...'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,254,0.3)', maxWidth: 240 }}>
              {phase === GamePhase.PROVING 
                ? 'Validating traits against commitment. This remains private to your device.' 
                : 'Waiting for blockchain confirmation...'}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
          }}>
            <Button
              variant="yes"
              size="lg"
              onClick={() => answerQuestion(true)}
              style={{ minWidth: 100, flex: 1, maxWidth: 150 }}
            >
              YES
            </Button>
            <Button
              variant="no"
              size="lg"
              onClick={() => answerQuestion(false)}
              style={{ minWidth: 100, flex: 1, maxWidth: 150 }}
            >
              NO
            </Button>
          </div>
        )}

        {displayQuestion.answer !== null && (
          <div style={{
            marginTop: 14,
            fontSize: 11,
            color: 'rgba(255,255,254,0.25)',
          }}>
            Correct answer: {displayQuestion.answer ? 'Yes' : 'No'}
          </div>
        )}
      </Card>
    </motion.div>
  );

  return createPortal(content, document.body);
}
