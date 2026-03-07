import { motion } from 'framer-motion';
import { Card } from './common/Card';
import { Button } from './common/Button';
import {
  useCurrentQuestion,
  useGameActions,
  usePhase,
  useGameMode,
  useOnlinePlayerNum,
  useActivePlayer,
} from '../store/selectors';
import { useGameStore } from '../store/gameStore';
import { GamePhase } from '../store/types';
import { retryLastProof } from '../hooks/useZKAnswer';

// ─── ZK proof state components ────────────────────────────────────────────────

function ProofSpinner({ step }: { step: string }) {
  return (
    <Card style={{
      position: 'fixed',
      bottom: '50%',
      left: '50%',
      transform: 'translate(-50%, 50%)',
      width: 'min(440px, calc(100vw - 32px))',
      textAlign: 'center',
      pointerEvents: 'auto',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(232,164,68,0.2)',
          borderTopColor: '#E8A444',
          borderRadius: '50%',
          margin: '0 auto 20px',
        }}
      />
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: '#FFFFFE',
        marginBottom: 8,
      }}>
        {step}
      </div>
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,254,0.35)',
      }}>
        This may take a moment
      </div>
    </Card>
  );
}

function VerifiedBadge({ answer }: { answer: boolean | null }) {
  return (
    <Card style={{
      position: 'fixed',
      bottom: '50%',
      left: '50%',
      transform: 'translate(-50%, 50%)',
      width: 'min(440px, calc(100vw - 32px))',
      textAlign: 'center',
      pointerEvents: 'auto',
    }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          fontSize: 48,
          marginBottom: 16,
        }}
      >
        {answer ? '✅' : '❌'}
      </motion.div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 20,
        fontWeight: 700,
        color: '#FFFFFE',
        marginBottom: 8,
      }}>
        {answer ? 'YES' : 'NO'}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(124,58,237,0.8)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        ZK Verified
      </div>
    </Card>
  );
}

function ErrorRetry({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <Card style={{
      position: 'fixed',
      bottom: '50%',
      left: '50%',
      transform: 'translate(-50%, 50%)',
      width: 'min(440px, calc(100vw - 32px))',
      textAlign: 'center',
      pointerEvents: 'auto',
    }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: '#F87171',
        marginBottom: 12,
      }}>
        Proof generation failed
      </div>
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,254,0.4)',
        marginBottom: 20,
        wordBreak: 'break-word',
      }}>
        {error}
      </div>
      <Button variant="yes" size="lg" onClick={onRetry}>
        Retry
      </Button>
    </Card>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AnswerPanel() {
  const question = useCurrentQuestion();
  const { answerQuestion } = useGameActions();
  const phase = usePhase();
  const mode = useGameMode();
  const proofError = useGameStore((s) => s.proofError);
  const onlinePlayerNum = useOnlinePlayerNum();
  const activePlayer = useActivePlayer();

  const isZKMode = mode === 'nft' || mode === 'online';

  // ZK error state
  if (isZKMode && proofError) {
    return (
      <ErrorRetry
        error={proofError}
        onRetry={() => {
          retryLastProof().catch(console.error);
        }}
      />
    );
  }

  // ZK proof states
  if (isZKMode && phase === GamePhase.PROVING) {
    return <ProofSpinner step="Generating ZK proof..." />;
  }
  if (isZKMode && phase === GamePhase.SUBMITTING) {
    return <ProofSpinner step="Submitting to Starknet..." />;
  }
  if (isZKMode && phase === GamePhase.VERIFIED) {
    return <VerifiedBadge answer={question?.answer ?? null} />;
  }

  // Online mode: asker waits for opponent's ZK answer
  if (mode === 'online' && phase === GamePhase.ANSWER_PENDING && onlinePlayerNum) {
    const myKey = onlinePlayerNum === 1 ? 'player1' : 'player2';
    const iAmAsker = question?.askedBy === myKey || activePlayer === myKey;
    if (iAmAsker) {
      return <ProofSpinner step="Waiting for opponent's answer..." />;
    }
  }

  // Standard answer panel (free mode, or fallback)
  if (!question) return null;

  return (
    <Card style={{
      position: 'fixed',
      bottom: '50%',
      left: '50%',
      transform: 'translate(-50%, 50%)',
      width: 'min(440px, calc(100vw - 32px))',
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
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.4,
          marginBottom: 32,
          color: '#FFFFFE',
        }}
      >
        {question.questionText}
      </motion.div>

      <div style={{
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
      }}>
        <Button
          variant="yes"
          size="lg"
          onClick={() => answerQuestion(true)}
          style={{ minWidth: 120 }}
        >
          YES
        </Button>
        <Button
          variant="no"
          size="lg"
          onClick={() => answerQuestion(false)}
          style={{ minWidth: 120 }}
        >
          NO
        </Button>
      </div>

      {/* Auto-answer hint (for local play, shows the correct answer) */}
      {question.answer !== null && (
        <div style={{
          marginTop: 16,
          fontSize: 11,
          color: 'rgba(255,255,254,0.25)',
        }}>
          Correct answer: {question.answer ? 'Yes' : 'No'}
        </div>
      )}
    </Card>
  );
}
