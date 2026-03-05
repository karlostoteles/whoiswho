import { motion } from 'framer-motion';
import type { Question } from '@/core/data/questions';

// ─── Rarity tiers ─────────────────────────────────────────────────────────────
// Based on what % of remaining characters match a question:
//   legendary: <5%  → golden glow
//   rare:      <15% → purple shimmer
//   uncommon:  <30% → blue tint
//   common:    ≥30% → subtle grey (safe choice)

type RarityTier = 'legendary' | 'rare' | 'uncommon' | 'common';

function getRarityTier(matchPct: number): RarityTier {
  if (matchPct > 0 && matchPct < 5) return 'legendary';
  if (matchPct < 15) return 'rare';
  if (matchPct < 30) return 'uncommon';
  return 'common';
}

const RARITY_STYLES: Record<RarityTier, {
  border: string; bg: string; badgeColor: string; badgeBg: string; label: string; glow?: string;
}> = {
  legendary: {
    border: 'rgba(232,164,68,0.45)',
    bg: 'rgba(232,164,68,0.06)',
    badgeColor: '#E8A444',
    badgeBg: 'rgba(232,164,68,0.15)',
    label: '★ LEGENDARY',
    glow: '0 0 12px rgba(232,164,68,0.15)',
  },
  rare: {
    border: 'rgba(124,58,237,0.4)',
    bg: 'rgba(124,58,237,0.06)',
    badgeColor: '#A78BFA',
    badgeBg: 'rgba(124,58,237,0.15)',
    label: '◆ RARE',
    glow: '0 0 8px rgba(124,58,237,0.12)',
  },
  uncommon: {
    border: 'rgba(6,182,212,0.3)',
    bg: 'rgba(6,182,212,0.04)',
    badgeColor: '#22D3EE',
    badgeBg: 'rgba(6,182,212,0.12)',
    label: '● UNCOMMON',
  },
  common: {
    border: 'rgba(255,255,255,0.10)',
    bg: 'rgba(255,255,255,0.05)',
    badgeColor: 'rgba(255,255,254,0.3)',
    badgeBg: 'rgba(255,255,255,0.06)',
    label: 'COMMON',
  },
};

// ─── NFT / Online mode question button ────────────────────────────────────────

export function NFTQuestionButton({
  question, asked, onClick, matchPct,
}: { question: Question; asked: boolean; onClick: () => void; matchPct?: number }) {
  const tier = matchPct !== undefined ? getRarityTier(matchPct) : 'common';
  const rs = asked ? RARITY_STYLES.common : RARITY_STYLES[tier];

  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.015, background: 'rgba(255,255,255,0.1)' }}
      whileTap={asked ? {} : { scale: 0.98 }}
      style={{
        padding: '10px 12px',
        border: asked
          ? '1px solid rgba(255,255,255,0.04)'
          : `1px solid ${rs.border}`,
        borderRadius: 10,
        background: asked ? 'rgba(255,255,255,0.02)' : rs.bg,
        color: asked ? 'rgba(255,255,254,0.22)' : '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: asked ? 'default' : 'pointer',
        textAlign: 'left' as const,
        outline: 'none',
        lineHeight: 1.4,
        transition: 'all 0.18s',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        boxShadow: (!asked && rs.glow) ? rs.glow : 'none',
      }}
    >
      {question.icon && (
        <span style={{ fontSize: 15, flexShrink: 0, opacity: asked ? 0.3 : 1 }}>
          {question.icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{question.text}</span>
      {asked ? (
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: 'rgba(232,164,68,0.6)', flexShrink: 0,
        }}>
          ✓
        </span>
      ) : matchPct !== undefined && (
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: rs.badgeColor,
          background: rs.badgeBg,
          borderRadius: 20,
          padding: '2px 7px',
          flexShrink: 0,
          whiteSpace: 'nowrap' as const,
        }}>
          {rs.label}
        </span>
      )}
    </motion.button>
  );
}

// ─── Free mode question button ────────────────────────────────────────────────

export function FreeQuestionButton({
  question, asked, index, onClick,
}: { question: Question; asked: boolean; index: number; onClick: () => void }) {
  const dots = (['#4ADE80', '#FACC15', '#F87171'] as const)[index % 3];
  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.015, background: 'rgba(255,255,255,0.1)' }}
      whileTap={asked ? {} : { scale: 0.98 }}
      style={{
        padding: '11px 14px',
        border: asked
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        background: asked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        color: asked ? 'rgba(255,255,254,0.22)' : '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13, fontWeight: 500,
        cursor: asked ? 'default' : 'pointer',
        textAlign: 'left' as const, outline: 'none', lineHeight: 1.4,
        transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      }}
    >
      <span style={{ flex: 1 }}>{question.text}</span>
      {asked ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,164,68,0.6)', flexShrink: 0 }}>
          ✓
        </span>
      ) : (
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: dots,
          flexShrink: 0, opacity: 0.7, boxShadow: `0 0 6px ${dots}88`,
        }} />
      )}
    </motion.button>
  );
}
