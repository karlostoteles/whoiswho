/**
 * StarkZap-based wallet connection for guessNFT.
 *
 * This replaces the direct @cartridge/controller usage with starkzap SDK,
 * providing a cleaner API and support for sponsored transactions.
 */
import { StarkZap, Tx, ChainId } from 'starkzap';
import type { WalletInterface } from 'starkzap';
import { connect, disconnect, type StarknetWindowObject } from 'get-starknet';
import { Account, RpcProvider, type Call } from 'starknet';
import { GAME_CONTRACT_NORMAL, GAME_CONTRACT_SCHIZO, SESSION_POLICIES, RPC_URL } from './config';
import { useGameStore } from '@/core/store/gameStore';
import { useToastStore } from '@/core/store/toastStore';
import { registerAccountGetter } from '@/zk/zkSdk';
import { TORII_URL, WORLD_ADDRESS } from '@/zk/toriiClient';

// Expose for user debugging as requested
(window as any).GAME_CONTRACT = GAME_CONTRACT_NORMAL;
console.log('[StarkZap] Environment - isSecureContext:', window.isSecureContext);
console.log('[StarkZap] Environment - protocol:', window.location.protocol);
console.log('[StarkZap] Environment - origin:', window.location.origin);
console.log('[StarkZap] Environment - port:', window.location.port);
console.log('[StarkZap] Environment - hostname:', window.location.hostname);

// Singleton instances
let sdk: StarkZap | null = null;
let wallet: WalletInterface | null = null;

// Register the account getter for the ZK engine once at module load.
// The getter always reads the current wallet value, so it works for reconnects.
registerAccountGetter(() => {
  if (!wallet) return null;
  // DiscoveryWalletShim exposes getAccount()
  if (typeof (wallet as any).getAccount === 'function') {
    return (wallet as any).getAccount();
  }
  // Cartridge/StarkZap wallet exposes the underlying Account at .account
  return (wallet as any).account ?? null;
});

export interface ConnectedWalletInfo {
  address: string;
  username?: string;
  type: 'cartridge' | 'argent' | 'braavos' | 'discovery';
}

const FALLBACK_RPC_URL = 'https://starknet-mainnet.public.blastapi.io';

/**
 * Get or create the StarkZap SDK instance.
 */
function getSDK(): StarkZap {
  if (!sdk) {
    // Revert to Cartridge RPC as default, fallback only if requested.
    // Public RPCs sometimes have CORS issues with local dev.
    const activeRpc = window.location.search.includes('fallback_rpc') ? FALLBACK_RPC_URL : RPC_URL;
    
    console.log('[StarkZap] Initializing SDK...', { 
      rpcUrl: activeRpc,
      isCartridge: activeRpc === RPC_URL 
    });

    // Diagnostically check if the RPC is reachable from this context
    fetch(activeRpc, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({id:1, jsonrpc:'2.0', method:'starknet_blockNumber'}) 
    })
      .then(r => r.ok ? console.log('[StarkZap] RPC is reachable') : console.error('[StarkZap] RPC returned error:', r.status))
      .catch(e => console.error('[StarkZap] RPC Fetch Test FAILED (CORS or Network):', e));

    sdk = new StarkZap({
      network: 'mainnet',
      rpcUrl: activeRpc,
      chainId: ChainId.MAINNET,
    });
  }
  return sdk;
}

/**
 * A shim that wraps a standard Starknet extension account (Argent/Braavos)
 * into the WalletInterface expected by StarkZap-based code.
 */
class DiscoveryWalletShim implements WalletInterface {
  readonly address: any;
  private account: Account;
  private provider: RpcProvider;
  private windowObject: StarknetWindowObject;

  constructor(windowObject: StarknetWindowObject) {
    this.windowObject = windowObject;
    this.account = windowObject.account as Account;
    this.address = this.account.address;
    this.provider = new RpcProvider({ nodeUrl: RPC_URL });
  }

  async isDeployed(): Promise<boolean> {
    const classHash = await this.provider.getClassHashAt(this.address);
    return !!classHash;
  }

  async ensureReady(): Promise<void> {
    // Discovery wallets are usually already deployed or handle it themselves
    return;
  }

  async deploy(): Promise<Tx> {
    throw new Error('Deployment via discovery wallet shim not implemented. Use extension UI.');
  }

  async execute(calls: Call[]): Promise<Tx> {
    const response = await this.account.execute(calls);
    return new Tx(response.transaction_hash, this.provider, ChainId.MAINNET);
  }

  async callContract(call: Call): Promise<any> {
    return await this.account.callContract(call);
  }

  tx(): any {
    throw new Error('TxBuilder not implemented for discovery shim');
  }

  async signMessage(typedData: any): Promise<any> {
    return await this.account.signMessage(typedData);
  }

  async preflight(): Promise<any> {
    return { ok: true };
  }

  getAccount(): Account {
    return this.account;
  }

  getProvider(): RpcProvider {
    return this.provider;
  }

  getChainId(): ChainId {
    return ChainId.MAINNET;
  }

  getFeeMode(): any {
    return 'user_pays';
  }

  getClassHash(): string {
    return '';
  }

  async estimateFee(calls: Call[]): Promise<any> {
    return await (this.account as any).estimateFee(calls);
  }

  async disconnect(): Promise<void> {
    await disconnect();
  }

  // Erc20 and Staking methods are handled by BaseWallet, 
  // but since we are a shim we'd need to delegate or implement.
  // For guessNFT, we primarily use execute() and address.
  erc20(): any { throw new Error('Not implemented'); }
  transfer(): any { throw new Error('Not implemented'); }
  balanceOf(): any { throw new Error('Not implemented'); }
  staking(): any { throw new Error('Not implemented'); }
  stakingInStaker(): any { throw new Error('Not implemented'); }
  enterPool(): any { throw new Error('Not implemented'); }
  addToPool(): any { throw new Error('Not implemented'); }
  stake(): any { throw new Error('Not implemented'); }
  claimPoolRewards(): any { throw new Error('Not implemented'); }
  exitPoolIntent(): any { throw new Error('Not implemented'); }
  exitPool(): any { throw new Error('Not implemented'); }
  isPoolMember(): any { throw new Error('Not implemented'); }
  getPoolPosition(): any { throw new Error('Not implemented'); }
  getPoolCommission(): any { throw new Error('Not implemented'); }
}

/**
 * Connect wallet using either Cartridge or Discovery (Argent/Braavos).
 */
export async function connectWallet(
  type: 'cartridge' | 'discovery' = 'cartridge',
  policies?: any
): Promise<ConnectedWalletInfo> {
  // Always disconnect previous before starting a new connection flow to avoid singletons clobbering each other
  if (wallet) {
    try { 
      // Add a 3s timeout to disconnect to prevent hanging the whole flow if the iframe is dead
      await Promise.race([
        wallet.disconnect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 3000))
      ]);
    } catch (e) { 
      console.warn('[Wallet] Disconnect failed or timed out:', e); 
    }
    wallet = null;
  }

  if (type === 'discovery') {
    const windowObject = await connect({
      modalMode: 'alwaysAsk',
      modalTheme: 'dark',
    });

    if (!windowObject) {
      throw new Error('No wallet selected');
    }

    wallet = new DiscoveryWalletShim(windowObject) as any;
    const finalType = (windowObject.id as any) === 'argentX' ? 'argent' : 
                      (windowObject.id as any) === 'braavos' ? 'braavos' : 'discovery';

    return {
      address: wallet!.address.toString(),
      type: finalType as any,
    };
  }

  // Cartridge Flow
  const starkzap = getSDK();

  // Check if user wants to bypass sessions as a test
  const useSessions = !window.location.search.includes('no_sessions');
  // New flag: ?user_pays=true to force standard execution (bypass SNIP-9)
  const forceUserPays = window.location.search.includes('user_pays');

  // Default policies for game contract (both modes)
  const defaultPolicies = policies || SESSION_POLICIES;

  console.log('[StarkZap] Connecting. Use Sessions:', useSessions, 'Force User Pays:', forceUserPays);

  const getWalletWithMode = async (mode: 'sponsored' | 'user_pays') => {
    // If policies is an array, it might be the old format. 
    // SESSION_POLICIES from config.ts is now an object.
    const finalPolicies = useSessions ? (policies || SESSION_POLICIES) : undefined;
    
    return await starkzap.connectCartridge({
      policies: finalPolicies,
      feeMode: mode,
    });
  };

  try {
    const initialMode = (useSessions && !forceUserPays) ? 'sponsored' : 'user_pays';
    const initialPolicies = useSessions ? (policies || SESSION_POLICIES) : undefined;

    console.log('[StarkZap] Attempting connection...', { 
      mode: initialMode, 
      useSessions, 
      hasPolicies: !!initialPolicies 
    });

    wallet = await starkzap.connectCartridge({
      policies: initialPolicies,
      feeMode: initialMode,
    });

    // Ensure account is ready (deploy if needed)
    console.log('[StarkZap] Connection successful. Ensuring account is ready (address:', wallet.address.toString(), ')');
    await wallet.ensureReady({ deploy: 'if_needed' });
  } catch (err: any) {
    console.error('[StarkZap] connectWallet attempt failed:', err);
    const errMsg: string = typeof err === 'string' ? err : (err?.message ?? '');

    const isSnip9Error = errMsg.includes('SNIP-9') || errMsg.includes('ISRC9');
    if (isSnip9Error && !forceUserPays) {
      console.warn('[StarkZap] SNIP-9 error detected. Falling back to user_pays mode...');
      wallet = await getWalletWithMode('user_pays');
      try {
        await wallet.ensureReady({ deploy: 'if_needed' });
      } catch (readyErr: any) {
        sdk = null;
        throw readyErr;
      }
    } else if (errMsg.includes('failed to initialize') && useSessions) {
      console.warn('[StarkZap] Controller failed to initialize with policies. Retrying WITHOUT policies...');
      try {
        wallet = await starkzap.connectCartridge({
          policies: undefined,
          feeMode: 'user_pays',
        });
        await wallet.ensureReady({ deploy: 'if_needed' });
      } catch (retryErr: any) {
        sdk = null;
        const retryMsg = typeof retryErr === 'string' ? retryErr : (retryErr?.message ?? '');
        throw new Error(`Fallback failed: ${retryMsg}`);
      }
    } else {
      const isSecurityError = errMsg.includes('NotAllowedError') || errMsg.includes('WebAuthn') || errMsg.includes('TLS');
      if (isSecurityError) {
        const contextMsg = window.isSecureContext ? "Secure Context: YES" : "Secure Context: NO";
        throw new Error(`Controller blocked by browser (WebAuthn/TLS error). ${contextMsg}. Protocol: ${window.location.protocol}. Dev: run on http://localhost:5173 (plain HTTP). Production: ensure valid HTTPS cert.`);
      }

      if (errMsg.includes('failed to initialize')) {
        console.error('[StarkZap] Controller initialization failed. Full Error:', err);
        sdk = null; 
      }
      throw err;
    }
  }

  // Debug deployment status
  try {
    const isDeployed = await wallet.isDeployed();
    console.log('[StarkZap] Account address:', wallet.address.toString());
    console.log('[StarkZap] Account deployed:', isDeployed);
  } catch (e) {
    console.warn('[StarkZap] Could not check deployment status:', e);
  }

  return {
    address: wallet.address.toString(),
    type: 'cartridge',
  };
}

/**
 * Get the current connected wallet.
 * Throws if not connected.
 */
export function getWallet(): WalletInterface {
  if (!wallet) {
    throw new Error('Wallet not connected. Call connectWallet first.');
  }
  return wallet;
}

/**
 * Check if wallet is connected.
 */
export function isWalletConnected(): boolean {
  return wallet !== null;
}

/**
 * Disconnect wallet.
 */
export async function disconnectWallet(): Promise<void> {
  if (wallet) {
    await wallet.disconnect();
    wallet = null;
  }
}

/**
 * Get wallet address (convenience function).
 */
export function getWalletAddress(): string | null {
  return wallet?.address.toString() ?? null;
}

// ============================================================
// Game Contract Interactions
// ============================================================

export interface GameContractCalls {
  // ── Active (used today) ──
  createGame: (traitsRoot?: string, questionSetId?: number) => Promise<string>;
  joinGame: (gameId: string) => Promise<string>;
  commitCharacter: (gameId: string, commitment: string, zkCommitment?: string) => Promise<string>;
  revealCharacter: (gameId: string, characterId: string, salt: string) => Promise<string>;
  // ── Phase 2 (stubs, will be activated when contract methods go live) ──
  askQuestion: (gameId: string, questionId: string) => Promise<string>;
  answerQuestion: (gameId: string, questionId: string, answer: boolean) => Promise<string>;
  answerQuestionWithProof: (gameId: string, proof: string[]) => Promise<string>;
  makeGuess: (gameId: string, characterId: string) => Promise<string>;
  claimTimeoutWin: (gameId: string) => Promise<string>;
  cancelGame: (gameId: string) => Promise<string>;
  opponentWon: (gameId: string) => Promise<string>;
  depositWager: (gameId: string, tokenId: string) => Promise<string>;
  getGame: (gameId: string) => Promise<any>;
  commitAndWagerMulticall: (gameId: string, commitment: string, zkCommitment?: string) => Promise<string>;
}

/**
 * Trigger Account Settings / Upgrade UI for Cartridge Controller.
 */
export async function upgradeWallet(): Promise<void> {
  const starkzap = getSDK();
  // Cartridge Controller typically handles this inside the settings/auth UI
  // which we trigger by reconnecting with policies (or using a specific starkzap call if available)
  await starkzap.connectCartridge({
    // Passing no policies + user_pays often triggers the upgrade flow or shows current status
    feeMode: 'user_pays',
  });
}

/**
 * Create game contract call functions using the connected wallet.
 */
export function getGameContract(): GameContractCalls {
  const _getWallet = () => {
    return getWallet();
  };

  const getTargetContract = () => {
    const subMode = useGameStore.getState().onlineSubMode;
    return subMode === 'betting' ? GAME_CONTRACT_SCHIZO : GAME_CONTRACT_NORMAL;
  };

  const wrapExecute = async (fn: (target: string) => Promise<any>, actionLabel = 'Transaction') => {
    const target = getTargetContract();
    const { addToast, removeToast } = useToastStore.getState();
    const toastId = addToast({ message: `${actionLabel} in progress...`, type: 'loading', duration: Infinity });

    try {
      const result = await fn(target);
      const txHash = typeof result === 'string' ? result : (result?.hash || result?.transaction_hash);
      
      removeToast(toastId);
      addToast({ 
        message: `${actionLabel} successful!`, 
        type: 'success', 
        txHash: txHash 
      });
      
      return result;
    } catch (err: any) {
      removeToast(toastId);
      const isSnip9Error = err.message?.includes('SNIP-9') || err.message?.includes('ISRC9');
      const isFeeError = err.message?.toLowerCase().includes('fee') || 
                        err.message?.toLowerCase().includes('gas') ||
                        err.message?.toLowerCase().includes('sponsorship') ||
                        err.message?.toLowerCase().includes('fund');
      
      if (isSnip9Error || isFeeError) {
        throw new Error('YOUR_ACCOUNT_UPGRADE_REQUIRED');
      }

      addToast({ 
        message: `${actionLabel} failed: ${err.message || 'Unknown error'}`, 
        type: 'error' 
      });
      throw err;
    }
  };

  return {
    async createGame(_traitsRoot?: string, _questionSetId = 0): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();

        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'create_game',
            calldata: [],
          },
        ]);
        const receipt: any = await tx.wait();

        // ── Extract game_id from receipt events ──────────────────────────
        const events: any[] = receipt?.events ?? [];
        console.log('[createGame] Receipt events:', JSON.stringify(events.map((e: any) => ({
          from: e.from_address, keys: e.keys, data: e.data,
        })), null, 2));

        const worldBigInt = BigInt(WORLD_ADDRESS);

        // Strategy 1: Dojo 1.8 World StoreSetRecord events.
        // All Dojo events come from the WORLD contract, not the game_actions contract.
        // Layout: data = [key_count, ...keys, val_count, ...vals]
        // For Game model (1 key = game_id): data[0] = 1, data[1] = game_id
        const worldEvents = events.filter((e: any) => {
          try { return BigInt(e.from_address) === worldBigInt; } catch { return false; }
        });

        for (const we of worldEvents) {
          if (we.data?.length >= 2) {
            // Normalize: data[0] could be '0x1', '1', or numeric
            const keyCount = Number(we.data[0]);
            if (keyCount === 1 && we.data[1] && BigInt(we.data[1]) !== 0n) {
              console.log('[createGame] game_id from World event data[1]:', we.data[1]);
              return we.data[1];
            }
          }
        }

        // Strategy 2: Fallback — query Torii directly for the latest game by this player.
        // This is 100% reliable as long as Torii has indexed the tx.
        const { useWalletStore } = await import('@/services/starknet/walletStore');
        const playerAddr = useWalletStore.getState().address || w.address;
        if (playerAddr) {
          console.log('[createGame] Falling back to Torii query for player:', playerAddr);
          // Pad address to 66 chars for Torii query
          const paddedAddr = '0x' + playerAddr.replace('0x', '').padStart(64, '0');

          // Wait briefly for Torii to index (it's usually fast)
          await new Promise(r => setTimeout(r, 2000));

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const q = encodeURIComponent(
                `SELECT game_id FROM [guessnft-Game] WHERE player1='${paddedAddr}' ORDER BY created_at DESC LIMIT 1`
              );
              const res = await fetch(`${TORII_URL}/sql?q=${q}`);
              if (res.ok) {
                const rows: any[] = await res.json();
                if (rows.length > 0 && rows[0].game_id) {
                  console.log('[createGame] game_id from Torii query:', rows[0].game_id);
                  return rows[0].game_id;
                }
              }
            } catch (e) {
              console.warn('[createGame] Torii query attempt', attempt, 'failed:', e);
            }
            // Wait before retry
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
          }
        }

        // Last resort: this is WRONG but logs will show the issue
        console.error('[createGame] FAILED to extract game_id — all strategies exhausted. Using tx hash as fallback (THIS WILL BREAK join_game)');
        return tx.hash;
      }, 'Create Game');
    },

    async joinGame(gameId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'join_game',
            calldata: [gameId],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Join Game');
    },

    async commitCharacter(game_id: string, commitment: string, _zkCommitment?: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();

        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'commit_character',
            calldata: [game_id, commitment],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Commit Character');
    },

    async revealCharacter(gameId: string, characterId: string, salt: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'reveal_character',
            calldata: [gameId, characterId, salt],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Reveal Character');
    },

    async askQuestion(gameId: string, questionId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'ask_question',
            calldata: [gameId, questionId],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Ask Question');
    },

    // ── Phase 2 stubs (not yet active) ──────────────────────────────────────

    async answerQuestion(_gameId: string, _questionId: string, _answer: boolean): Promise<string> {
      throw new Error('Phase 2: answer_question not yet active. Gameplay uses Supabase.');
    },

    async answerQuestionWithProof(gameId: string, proof: string[]): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([{
          contractAddress: target,
          entrypoint: 'answer_question_with_proof',
          calldata: [gameId, proof.length.toString(), ...proof],
        }]);
        await tx.wait();
        return tx.hash;
      }, 'Submit ZK Proof');
    },

    async makeGuess(gameId: string, characterId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([{
          contractAddress: target,
          entrypoint: 'make_guess',
          calldata: [gameId, characterId],
        }]);
        await tx.wait();
        return tx.hash;
      }, 'Make Guess');
    },

    async claimTimeoutWin(gameId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([{
          contractAddress: target,
          entrypoint: 'claim_timeout',
          calldata: [gameId],
        }]);
        await tx.wait();
        return tx.hash;
      }, 'Claim Timeout Win');
    },

    async cancelGame(_gameId: string): Promise<string> {
      throw new Error('Phase 2: cancel_game not yet active.');
    },

    async opponentWon(_gameId: string): Promise<string> {
      throw new Error('Phase 2: opponent_won not yet active.');
    },

    async getGame(_gameId: string) {
      // Game state is read via Torii SQL in useOnlineGameSync, not here.
      throw new Error('Use Torii SQL endpoint instead.');
    },

    async depositWager(_gameId: string, _tokenId: string): Promise<string> {
      throw new Error('Phase 2: deposit_wager not yet active.');
    },

    async commitAndWagerMulticall(
      gameId: string,
      commitment: string,
      zkCommitment?: string,
    ): Promise<string> {
      return this.commitCharacter(gameId, commitment, zkCommitment);
    },
  };
}
