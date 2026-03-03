import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';

type View = 'menu' | 'online';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const { startSetup, setGameMode } = useGameActions();

  const handleFreePlay = () => {
    setGameMode('free', MEME_CHARACTERS);
    startSetup();
  };

  const handleNFTFreePlay = () => {
    setGameMode('nft-free');
    startSetup();
  };

  const handlePlayOnline = () => {
    setView('online');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', zIndex: 20 }}
    >
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <MenuMain
            key="menu"
            onFreePlay={handleFreePlay}
            onNFTFreePlay={handleNFTFreePlay}
            onPlayOnline={handlePlayOnline}
          />
        )}
        {view === 'online' && (
          <OnlineLobbyScreen
            key="online"
            onBack={() => setView('menu')}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main menu view ────────────────────────────────────────────────────────────

interface MenuMainProps {
  onFreePlay: () => void;
  onNFTFreePlay: () => void;
  onPlayOnline: () => void;
}

function MenuMain({ onFreePlay, onNFTFreePlay, onPlayOnline }: MenuMainProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
      }}
    >
      {/* Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(38px, 10vw, 64px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #E8A444 0%, #F0C060 50%, #E8A444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 4,
          filter: 'drop-shadow(0 0 40px rgba(232,164,68,0.3))',
        }}>
          WhoisWho
        </div>
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(91,33,182,0.3))',
          border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 20,
          padding: '3px 14px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: '#A78BFA',
          marginBottom: 14,
        }}>
          SCHIZODIO Premiere
        </div>
        <div style={{
          fontSize: 15,
          color: 'rgba(255,255,254,0.38)',
          fontWeight: 500,
        }}>
          The classic family game, made schizo
        </div>
      </motion.div>

      {/* Game tile buttons */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.42 }}
        style={{
          display: 'flex',
          gap: 'clamp(12px, 3vw, 20px)',
          alignItems: 'stretch',
          flexWrap: 'wrap' as const,
          justifyContent: 'center',
        }}
      >
        <PlayRealTile onClick={onPlayOnline} />
        <SchizodioAITile onClick={onNFTFreePlay} />
        <FreePlayTile onClick={onFreePlay} />
      </motion.div>
    </motion.div>
  );
}

// ─── Tile: Play for Real (1v1) ─────────────────────────────────────────────────

function PlayRealTile({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -6, boxShadow: '0 0 56px rgba(232,164,68,0.35), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(232,164,68,0.2)' }}
      whileTap={{ scale: 0.97 }}
      initial={false}
      style={{
        width: 'clamp(140px, 36vw, 164px)',
        height: 'clamp(210px, 55vw, 248px)',
        background: 'linear-gradient(165deg, #1c1228 0%, #0e0c1e 100%)',
        border: '1.5px solid rgba(232,164,68,0.5)',
        borderRadius: 16,
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
        overflow: 'hidden',
        boxShadow: '0 0 28px rgba(232,164,68,0.16), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(232,164,68,0.12)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Art area — duel scene */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 55%, rgba(232,164,68,0.13) 0%, transparent 68%)',
        }} />
        <svg
          viewBox="0 0 120 140"
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Left player — gold */}
          <g opacity="0.82">
            <circle cx="28" cy="30" r="11" fill="#E8A444" opacity="0.65" />
            <rect x="21" y="41" width="14" height="28" rx="4" fill="#E8A444" opacity="0.45" />
            <line x1="35" y1="50" x2="58" y2="64" stroke="#E8A444" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
            <line x1="21" y1="50" x2="10" y2="62" stroke="#E8A444" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
            <line x1="24" y1="69" x2="18" y2="94" stroke="#E8A444" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
            <line x1="34" y1="69" x2="38" y2="94" stroke="#E8A444" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
          </g>
          {/* Right player — blue */}
          <g opacity="0.82">
            <circle cx="92" cy="30" r="11" fill="#60CDFF" opacity="0.65" />
            <rect x="85" y="41" width="14" height="28" rx="4" fill="#60CDFF" opacity="0.45" />
            <line x1="85" y1="50" x2="62" y2="64" stroke="#60CDFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
            <line x1="99" y1="50" x2="110" y2="62" stroke="#60CDFF" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
            <line x1="88" y1="69" x2="82" y2="94" stroke="#60CDFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
            <line x1="98" y1="69" x2="102" y2="94" stroke="#60CDFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
          </g>
          {/* Clashing swords */}
          <line x1="56" y1="58" x2="64" y2="70" stroke="#E8A444" strokeWidth="2.5" opacity="0.5" />
          <line x1="64" y1="58" x2="56" y2="70" stroke="#60CDFF" strokeWidth="2.5" opacity="0.5" />
          <circle cx="60" cy="64" r="5" fill="none" stroke="#FFFFA0" strokeWidth="1.2" opacity="0.55" />
          <circle cx="60" cy="64" r="2" fill="#FFFFA0" opacity="0.6" />
          <text x="60" y="118" textAnchor="middle" fill="#E8A444" fontSize="20" fontWeight="900" fontFamily="Space Grotesk, sans-serif" opacity="0.9">VS</text>
        </svg>
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(232,164,68,0.45), transparent)',
        flexShrink: 0,
      }} />

      {/* Text area */}
      <div style={{
        padding: '11px 13px 13px',
        textAlign: 'left',
        fontFamily: "'Space Grotesk', sans-serif",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#FFFFFE',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          Play for Real
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(232,164,68,0.65)',
          fontWeight: 700,
          marginTop: 3,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}>
          1v1 · SCHIZODIO NFTs
        </div>
      </div>

      {/* Corner pip */}
      <div style={{
        position: 'absolute', top: 9, right: 9,
        width: 6, height: 6, borderRadius: '50%',
        background: '#E8A444',
        boxShadow: '0 0 8px rgba(232,164,68,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Tile: Schizodio vs AI (nft-free) ─────────────────────────────────────────

const SCHIZO_ICONS = ['💀', '👁', '🎭', '🌀', '🃏', '⚡', '🦋', '🔮', '🎪'];

function SchizodioAITile({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -6, boxShadow: '0 0 48px rgba(6,182,212,0.3), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(6,182,212,0.18)' }}
      whileTap={{ scale: 0.97 }}
      initial={false}
      style={{
        width: 'clamp(140px, 36vw, 164px)',
        height: 'clamp(210px, 55vw, 248px)',
        background: 'linear-gradient(165deg, #091820 0%, #050e18 100%)',
        border: '1.5px solid rgba(6,182,212,0.45)',
        borderRadius: 16,
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
        overflow: 'hidden',
        boxShadow: '0 0 24px rgba(6,182,212,0.12), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(6,182,212,0.1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Art area — SCHIZODIO icon grid */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 55%, rgba(6,182,212,0.11) 0%, transparent 68%)',
        }} />
        {/* 3×3 icon grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 7,
          padding: '18px 18px 28px',
          position: 'relative',
        }}>
          {SCHIZO_ICONS.map((icon, i) => (
            <div key={i} style={{
              width: 34, height: 34,
              borderRadius: 8,
              background: 'rgba(6,182,212,0.15)',
              border: '1px solid rgba(6,182,212,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
            }}>
              {icon}
            </div>
          ))}
        </div>
        {/* AI badge */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(6,182,212,0.22)',
          border: '1px solid rgba(6,182,212,0.45)',
          borderRadius: 10,
          padding: '2px 10px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: '#22D3EE',
          fontFamily: "'Space Grotesk', sans-serif",
          whiteSpace: 'nowrap' as const,
        }}>
          AI OPPONENT
        </div>
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.38), transparent)',
        flexShrink: 0,
      }} />

      {/* Text area */}
      <div style={{
        padding: '11px 13px 13px',
        textAlign: 'left',
        fontFamily: "'Space Grotesk', sans-serif",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#FFFFFE',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          Schizodio vs AI
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(34,211,238,0.65)',
          fontWeight: 700,
          marginTop: 3,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}>
          NFTs · vs AI
        </div>
      </div>

      {/* Corner pip */}
      <div style={{
        position: 'absolute', top: 9, right: 9,
        width: 6, height: 6, borderRadius: '50%',
        background: '#06B6D4',
        boxShadow: '0 0 8px rgba(6,182,212,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Tile: Try CT version for free (AI) ───────────────────────────────────────

const MEME_ICONS = ['Ξ', '₿', '🤖', '👾', '🦊', '⚡', '🌐', '🎮', '🔮'];

function FreePlayTile({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -6, boxShadow: '0 0 48px rgba(124,58,237,0.3), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(124,58,237,0.18)' }}
      whileTap={{ scale: 0.97 }}
      initial={false}
      style={{
        width: 'clamp(140px, 36vw, 164px)',
        height: 'clamp(210px, 55vw, 248px)',
        background: 'linear-gradient(165deg, #101428 0%, #080c1e 100%)',
        border: '1.5px solid rgba(124,58,237,0.4)',
        borderRadius: 16,
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
        overflow: 'hidden',
        boxShadow: '0 0 22px rgba(124,58,237,0.12), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(124,58,237,0.1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Art area — meme character grid */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 55%, rgba(124,58,237,0.11) 0%, transparent 68%)',
        }} />
        {/* 3×3 icon grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 7,
          padding: '18px 18px 28px',
          position: 'relative',
        }}>
          {MEME_ICONS.map((icon, i) => (
            <div key={i} style={{
              width: 34, height: 34,
              borderRadius: 8,
              background: 'rgba(124,58,237,0.2)',
              border: '1px solid rgba(124,58,237,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              color: i < 2 ? 'rgba(255,255,255,0.85)' : undefined,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
            }}>
              {icon}
            </div>
          ))}
        </div>
        {/* AI badge */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(124,58,237,0.32)',
          border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 10,
          padding: '2px 10px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: '#A78BFA',
          fontFamily: "'Space Grotesk', sans-serif",
          whiteSpace: 'nowrap' as const,
        }}>
          AI OPPONENT
        </div>
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.38), transparent)',
        flexShrink: 0,
      }} />

      {/* Text area */}
      <div style={{
        padding: '11px 13px 13px',
        textAlign: 'left',
        fontFamily: "'Space Grotesk', sans-serif",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#FFFFFE',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          Try for Free
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(167,139,250,0.65)',
          fontWeight: 700,
          marginTop: 3,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}>
          CT Version · vs AI
        </div>
      </div>

      {/* Corner pip */}
      <div style={{
        position: 'absolute', top: 9, right: 9,
        width: 6, height: 6, borderRadius: '50%',
        background: '#7C3AED',
        boxShadow: '0 0 8px rgba(124,58,237,0.9)',
      }} />
    </motion.button>
  );
}
