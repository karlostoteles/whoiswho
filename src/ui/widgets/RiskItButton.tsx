import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStatus } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { sfx } from '@/shared/audio/sfx';

/**
 * LogoutButton (formerly RiskItButton)
 * Shown in the upper-right corner when connected.
 */
export function RiskItButton() {
  const status = useWalletStatus();
  const { disconnectWallet } = useWalletConnection();
  const isConnected = status === 'connected' || status === 'ready' || status === 'loading_nfts';

  const handleClick = () => {
    sfx.click();
    disconnectWallet();
  };

  return (
    <AnimatePresence>
      {isConnected && (
        <motion.button
          key="logout"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={handleClick}
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 10,
            padding: '10px 20px',
            border: '2px solid rgba(255, 255, 254, 0.15)',
            borderRadius: 12,
            background: 'rgba(15, 14, 23, 0.88)',
            backdropFilter: 'blur(12px)',
            color: '#FFFFFE',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          whileHover={{
            scale: 1.05,
            background: 'rgba(239, 68, 68, 0.15)',
            borderColor: 'rgba(239, 68, 68, 0.4)',
            color: '#FCA5A5',
          }}
          whileTap={{ scale: 0.95 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          LOGOUT
        </motion.button>
      )}
    </AnimatePresence>
  );
}
