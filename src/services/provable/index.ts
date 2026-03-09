/**
 * Provable Games Embeddable Game Standard Integration for guessNFT
 * 
 * This module provides the integration layer between guessNFT and
 * the Provable Games EGS platform, enabling:
 * - Token-based game sessions
 * - Score tracking and leaderboards
 * - Embeddable game functionality
 */

import { Contract, RpcProvider, Account, uint256 } from 'starknet';

// Contract addresses (to be updated after deployment)
export const PROVABLE_CONFIG = {
  // Provable Games Denshokan Token Contract
  DENSHOKAN_TOKEN: '0x0', // TODO: Update after deployment
  
  // guessNFT EGS Game Contract
  GUESSNFT_GAME: '0x0', // TODO: Update after deployment
  
  // Provable Games Registry
  GAME_REGISTRY: '0x0', // TODO: Update after deployment
};

// ABI for the guessNFT EGS contract
export const GUESSNFT_EGS_ABI = [
  {
    "name": "IGuessNFTGame",
    "type": "interface",
    "items": [
      {
        "name": "join_game",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" }
        ],
        "outputs": []
      },
      {
        "name": "commit_character",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" },
          { "name": "commitment", "type": "felt252" }
        ],
        "outputs": []
      },
      {
        "name": "reveal_character",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" },
          { "name": "character_id", "type": "felt252" },
          { "name": "salt", "type": "felt252" }
        ],
        "outputs": []
      },
      {
        "name": "ask_question",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" },
          { "name": "question_id", "type": "felt252" }
        ],
        "outputs": []
      },
      {
        "name": "answer_question",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" },
          { "name": "question_id", "type": "felt252" },
          { "name": "answer", "type": "bool" }
        ],
        "outputs": []
      },
      {
        "name": "make_guess",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" },
          { "name": "character_id", "type": "felt252" }
        ],
        "outputs": []
      },
      {
        "name": "get_game",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" }
        ],
        "outputs": [
          { "name": "game", "type": "GameSession" }
        ]
      },
      {
        "name": "get_current_turn",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" }
        ],
        "outputs": [
          { "name": "player", "type": "ContractAddress" }
        ]
      },
      {
        "name": "is_game_over",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" }
        ],
        "outputs": [
          { "name": "over", "type": "bool" }
        ]
      },
      {
        "name": "get_score",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" }
        ],
        "outputs": [
          { "name": "score", "type": "u64" }
        ]
      }
    ]
  },
  // IMinigameTokenData interface (EGS required)
  {
    "name": "IMinigameTokenData",
    "type": "interface",
    "items": [
      {
        "name": "score",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" }
        ],
        "outputs": [
          { "name": "score", "type": "u64" }
        ]
      },
      {
        "name": "game_over",
        "type": "function",
        "inputs": [
          { "name": "token_id", "type": "felt252" }
        ],
        "outputs": [
          { "name": "over", "type": "bool" }
        ]
      }
    ]
  }
] as const;

// Game phase enum (matching Cairo contract)
export enum GamePhase {
  WaitingForPlayers = 0,
  SetupP1 = 1,
  SetupP2 = 2,
  InProgress = 3,
  GuessPhase = 4,
  GameOver = 5,
}

// Game outcome enum
export enum GameOutcome {
  None = 0,
  P1Wins = 1,
  P2Wins = 2,
  Draw = 3,
}

// TypeScript types for game state
export interface PlayerState {
  character_commitment: string;
  character_revealed: boolean;
  character_id: string;
  questions_asked: number;
  wrong_guesses: number;
}

export interface GameSession {
  token_id: string;
  player1: string;
  player2: string;
  current_turn: number;
  phase: GamePhase;
  outcome: GameOutcome;
  total_questions: number;
  p1_state: PlayerState;
  p2_state: PlayerState;
  created_at: number;
  finished_at: number;
}

export interface QuestionRecord {
  token_id: string;
  question_id: string;
  asker: string;
  answer: boolean;
  answered: boolean;
}

/**
 * Provable Games SDK client for guessNFT
 */
export class ProvableGamesClient {
  private provider: RpcProvider;
  private gameContract: Contract;
  private account: Account | null = null;

  constructor(rpcUrl: string, gameContractAddress?: string) {
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });
    
    const address = gameContractAddress || PROVABLE_CONFIG.GUESSNFT_GAME;
    this.gameContract = new Contract(
      {
        abi: GUESSNFT_EGS_ABI as any,
        address: address,
        providerOrAccount: this.provider,
      }
    );
  }

  /**
   * Connect a wallet account for signing transactions
   */
  connectAccount(account: Account) {
    this.account = account;
    this.gameContract.connect(account);
  }

  /**
   * Get game session state for a token
   */
  async getGame(tokenId: string): Promise<GameSession> {
    const result = await this.gameContract.get_game(tokenId);
    return this.parseGameSession(result);
  }

  /**
   * Get current turn player address
   */
  async getCurrentTurn(tokenId: string): Promise<string> {
    return await this.gameContract.get_current_turn(tokenId);
  }

  /**
   * Check if game is over
   */
  async isGameOver(tokenId: string): Promise<boolean> {
    return await this.gameContract.is_game_over(tokenId);
  }

  /**
   * Get score for a game session
   */
  async getScore(tokenId: string): Promise<bigint> {
    return await this.gameContract.get_score(tokenId);
  }

  /**
   * Join an existing game as player 2
   */
  async joinGame(tokenId: string): Promise<string> {
    if (!this.account) throw new Error('Account not connected');
    
    const call = this.gameContract.populate('join_game', [tokenId]);
    const response = await this.gameContract.join_game(tokenId);
    
    return response.transaction_hash;
  }

  /**
   * Commit to a character selection
   */
  async commitCharacter(tokenId: string, commitment: string): Promise<string> {
    if (!this.account) throw new Error('Account not connected');
    
    const response = await this.gameContract.commit_character(tokenId, commitment);
    return response.transaction_hash;
  }

  /**
   * Ask a question about opponent's character
   */
  async askQuestion(tokenId: string, questionId: string): Promise<string> {
    if (!this.account) throw new Error('Account not connected');
    
    const response = await this.gameContract.ask_question(tokenId, questionId);
    return response.transaction_hash;
  }

  /**
   * Answer a question
   */
  async answerQuestion(tokenId: string, questionId: string, answer: boolean): Promise<string> {
    if (!this.account) throw new Error('Account not connected');
    
    const response = await this.gameContract.answer_question(tokenId, questionId, answer);
    return response.transaction_hash;
  }

  /**
   * Make a guess at the opponent's character
   */
  async makeGuess(tokenId: string, characterId: string): Promise<string> {
    if (!this.account) throw new Error('Account not connected');
    
    const response = await this.gameContract.make_guess(tokenId, characterId);
    return response.transaction_hash;
  }

  /**
   * Reveal character after game ends
   */
  async revealCharacter(tokenId: string, characterId: string, salt: string): Promise<string> {
    if (!this.account) throw new Error('Account not connected');
    
    const response = await this.gameContract.reveal_character(tokenId, characterId, salt);
    return response.transaction_hash;
  }

  /**
   * Parse raw contract response to typed GameSession
   */
  private parseGameSession(raw: any): GameSession {
    return {
      token_id: raw.token_id?.toString() || '0',
      player1: raw.player1?.toString() || '0',
      player2: raw.player2?.toString() || '0',
      current_turn: raw.current_turn?.toNumber() || 0,
      phase: raw.phase?.toNumber() || GamePhase.WaitingForPlayers,
      outcome: raw.outcome?.toNumber() || GameOutcome.None,
      total_questions: raw.total_questions?.toNumber() || 0,
      p1_state: {
        character_commitment: raw.p1_state?.character_commitment?.toString() || '0',
        character_revealed: raw.p1_state?.character_revealed || false,
        character_id: raw.p1_state?.character_id?.toString() || '0',
        questions_asked: raw.p1_state?.questions_asked?.toNumber() || 0,
        wrong_guesses: raw.p1_state?.wrong_guesses?.toNumber() || 0,
      },
      p2_state: {
        character_commitment: raw.p2_state?.character_commitment?.toString() || '0',
        character_revealed: raw.p2_state?.character_revealed || false,
        character_id: raw.p2_state?.character_id?.toString() || '0',
        questions_asked: raw.p2_state?.questions_asked?.toNumber() || 0,
        wrong_guesses: raw.p2_state?.wrong_guesses?.toNumber() || 0,
      },
      created_at: raw.created_at?.toNumber() || 0,
      finished_at: raw.finished_at?.toNumber() || 0,
    };
  }
}

/**
 * Generate Pedersen commitment for character selection
 * In Cairo: commitment = pedersen_hash(character_id, salt)
 */
export async function generateCommitment(characterId: string, salt: string): Promise<string> {
  // This would use starknet.js Pedersen hash
  // For now, return a placeholder - in production use:
  // const hash = pedersen(BigInt(characterId), BigInt(salt));
  // return hash.toString();
  
  // Placeholder implementation
  const combined = BigInt(characterId) + BigInt(salt) * BigInt(2**128);
  return combined.toString();
}

/**
 * Hook for React components to use Provable Games
 */
export function useProvableGames(rpcUrl?: string) {
  const [client, setClient] = React.useState<ProvableGamesClient | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    const url = rpcUrl || 'https://starknet-mainnet.public.blastapi.io';
    const provableClient = new ProvableGamesClient(url);
    setClient(provableClient);
  }, [rpcUrl]);

  const connect = React.useCallback((account: Account) => {
    if (client) {
      client.connectAccount(account);
      setIsConnected(true);
    }
  }, [client]);

  return {
    client,
    isConnected,
    connect,
  };
}

// Add React import for the hook
import React from 'react';
