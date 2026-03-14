import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { GamePhase } from './types';

// Mock dependencies
vi.mock('@/services/starknet/commitReveal', () => ({
  createCommitment: vi.fn(() => ({ commitment: '0x123' })),
  generateGameSessionId: vi.fn(() => 'test-session-id'),
  clearCommitments: vi.fn(),
  submitCommitmentOnChain: vi.fn(() => Promise.resolve('0xhash')),
}));

vi.mock('@/services/starknet/collectionService', () => ({
  generateAllCollectionCharacters: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/services/starknet/starkzapService', () => ({
  getGameContract: vi.fn(() => ({
    getGame: vi.fn(),
    submitMove: vi.fn(),
    claimTimeoutWin: vi.fn(),
    cancelGame: vi.fn(),
  })),
}));

describe('gameStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useGameStore.getState().resetGame();
  });

  it('initializes with correct default state', () => {
    const state = useGameStore.getState();
    expect(state.phase).toBe(GamePhase.MENU);
    expect(state.mode).toBe('free');
    expect(state.activePlayer).toBe('player1');
  });

  it('transitions to SETUP_P1 when starting setup', () => {
    useGameStore.getState().startSetup();
    expect(useGameStore.getState().phase).toBe(GamePhase.SETUP_P1);
  });

  it('selects a secret character and advances phase in free mode', () => {
    const store = useGameStore.getState();
    store.setGameMode('free');
    store.selectSecretCharacter('player1', 'c01');

    const state = useGameStore.getState();
    expect(state.players.player1.secretCharacterId).toBe('c01');
    expect(state.players.player2.secretCharacterId).toBeDefined(); // CPU pick
    expect(state.phase).toBe(GamePhase.HANDOFF_START);
  });

  it('handles question selection and auto-answer in free mode', () => {
    const store = useGameStore.getState();
    store.setGameMode('free');
    // Setup characters and secrets
    store.selectSecretCharacter('player1', 'c01'); 
    store.advancePhase(); // To QUESTION_SELECT

    // Mock c02 as secret for player 2 (Luna vs Max)
    // Actually selectSecretCharacter already picked one for CPU.
    // Let's force it for predictability.
    useGameStore.setState((s) => {
      s.players.player2.secretCharacterId = 'c02'; // Max
    });

    // Ask a question that should be TRUE for Max (glasses)
    store.askQuestion('q_glasses'); // We'll assume this ID exists in our mocked/real QUESTIONS

    const state = useGameStore.getState();
    expect(state.currentQuestion).toBeDefined();
    expect(state.currentQuestion?.askedBy).toBe('player1');
    expect(state.cpuQuestion).toBeDefined(); // CPU should have also asked
    expect(state.phase).toBe(GamePhase.ANSWER_REVEALED);
  });

  it('toggles character elimination', () => {
    const store = useGameStore.getState();
    store.toggleElimination('c01');
    expect(useGameStore.getState().players.player1.eliminatedCharacterIds).toContain('c01');
    
    store.toggleElimination('c01');
    expect(useGameStore.getState().players.player1.eliminatedCharacterIds).not.toContain('c01');
  });
});
