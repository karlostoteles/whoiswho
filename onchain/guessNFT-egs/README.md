# guessNFT - Provable Games EGS Integration

## Overview

This directory contains the Provable Games Embeddable Game Standard (EGS) integration for guessNFT, enabling the game to be:

- **Mintable**: Each game session is represented as an NFT token
- **Scoreable**: Game performance is tracked on-chain with verifiable scores
- **Embeddable**: Games can be embedded in any EGS-compatible platform

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Provable Games Platform                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Denshokan   │  │   Game      │  │      Leaderboard        │  │
│  │ Token       │  │   Registry  │  │      System             │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  guessNFT EGS Game Contract                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Token-Keyed Storage                        ││
│  │  games[token_id] → GameSession                              ││
│  │  questions[token_id, idx] → QuestionRecord                  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ IMinigameToken  │  │ SRC5 Interface  │  │   Game Logic    │  │
│  │ Data Interface  │  │ Registration    │  │   Actions       │  │
│  │ - score()       │  │ - IMINIGAME_ID  │  │ - join_game     │  │
│  │ - game_over()   │  │                 │  │ - commit_char   │  │
│  └─────────────────┘  └─────────────────┘  │ - ask_question  │  │
│                                            │ - answer_quest   │  │
│                                            │ - make_guess     │  │
│                                            └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          │ Events
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    guessNFT Frontend                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  React + Three  │  │ Zustand Store   │  │ Provable Games  │  │
│  │ .js 3D Board    │  │ Game State      │  │ SDK Client      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Token-Keyed Storage

Unlike traditional games that key state by player address, EGS games key all state by `token_id`:

```cairo
// Traditional pattern — keyed by player address
scores: Map<ContractAddress, u64>,

// EGS pattern — keyed by token ID
scores: Map<felt252, u64>,
```

Each minted token represents a unique game session, enabling:
- Multiple concurrent games per player
- Transferable game sessions (NFTs)
- Cross-platform game state

### Required Interfaces

Every EGS game must implement:

1. **`IMinigameTokenData`** - Core interface for game state
   ```cairo
   fn score(self: @ContractState, token_id: felt252) -> u64;
   fn game_over(self: @ContractState, token_id: felt252) -> bool;
   ```

2. **`IMINIGAME_ID`** via SRC5 - Interface discovery
   ```cairo
   self.src5.register_interface(IMINIGAME_ID);
   ```

3. **Action Hooks** - Wrap player actions
   ```cairo
   self.minigame.pre_action(token_id);
   // ... game action logic ...
   self.minigame.post_action(token_id);
   ```

## Game Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      Game Lifecycle                               │
└──────────────────────────────────────────────────────────────────┘

1. TOKEN MINTED (Game Created)
   └─► GameSession created with player1 = minter

2. PLAYER 2 JOINS
   └─► join_game(token_id) called
   └─► GameSession.player2 set
   └─► Phase transitions to SetupP1

3. CHARACTER SELECTION (Commit-Reveal)
   └─► P1: commit_character(token_id, hash(char, salt))
   └─► P2: commit_character(token_id, hash(char, salt))
   └─► Phase transitions to InProgress

4. GAMEPLAY (Question/Answer)
   └─► P1: ask_question(token_id, question_id)
   └─► P2: answer_question(token_id, question_id, true/false)
   └─► Repeat with turns alternating

5. GUESS PHASE
   └─► Current player: make_guess(token_id, character_id)
   └─► If wrong: turn switches, wrong_guesses++
   └─► If correct: Game Over, winner declared

6. GAME END
   └─► score() calculates final score
   └─► game_over() returns true
   └─► Winner can claim rewards
```

## Score Calculation

The scoring system rewards efficiency:

```cairo
// Max questions allowed: 20 (typical Guess Who rules)
// Score = (20 - questions_asked) * 100 + winner_bonus

fn score(self: @ContractState, token_id: felt252) -> u64 {
    let game = self.games.read(token_id);
    
    if game.phase != GamePhase::GameOver {
        return 0;
    }
    
    let max_questions: u32 = 20;
    let questions_used = game.total_questions;
    
    let efficiency_bonus = if questions_used < max_questions {
        (max_questions - questions_used) * 100_u32
    } else {
        1_u32  // Minimum score for winning
    };
    
    let winner_bonus: u32 = 1000;
    
    (efficiency_bonus + winner_bonus).into()
}
```

## Directory Structure

```
onchain/guessNFT-egs/
├── Scarb.toml              # Cairo dependencies
├── src/
│   ├── lib.cairo           # Module exports
│   └── guessnft_game.cairo # Main game contract
└── README.md               # This file

src/services/provable/
├── index.ts                # SDK client & types
└── README.md               # Integration docs
```

## Dependencies

```toml
[dependencies]
starknet = "2.15.1"
game_components_embeddable_game_standard = { 
    git = "https://github.com/Provable-Games/game-components", 
    tag = "v1.1.0" 
}
game_components_interfaces = { 
    git = "https://github.com/Provable-Games/game-components", 
    tag = "v1.1.0" 
}
openzeppelin_introspection = { 
    git = "https://github.com/OpenZeppelin/cairo-contracts.git", 
    tag = "v3.0.0" 
}
```

## Building & Deployment

### Build the Contract

```bash
cd onchain/guessNFT-egs
scarb build
```

### Deploy to Starknet

```bash
# Using sncast
sncast deploy \
    --contract-name guessnft_egs::guessnft_game::GuessNFTGame \
    --constructor-calldata <nft_contract_address> <registry_address>
```

### Register with Provable Games

After deployment, register your game with the Provable Games Registry:

```bash
# Register game contract
sncast invoke \
    --contract-address <registry_address> \
    --function register_game \
    --calldata <game_contract_address> <game_name> <game_uri>
```

## Frontend Integration

```typescript
import { ProvableGamesClient, useProvableGames } from '@/services/provable';

// In your React component
function GameBoard({ tokenId }: { tokenId: string }) {
  const { client, isConnected, connect } = useProvableGames();
  
  const handleJoinGame = async () => {
    if (client && isConnected) {
      await client.joinGame(tokenId);
    }
  };
  
  return (
    <button onClick={handleJoinGame}>
      Join Game
    </button>
  );
}
```

## Hackathon Requirements

This integration qualifies for the Provable Games hackathon track by:

1. ✅ Implementing `IMinigameTokenData` interface
2. ✅ Registering `IMINIGAME_ID` via SRC5
3. ✅ Using token-keyed storage
4. ✅ Wrapping actions with `pre_action`/`post_action` hooks
5. ✅ Providing score calculation for leaderboards
6. ✅ Supporting embeddable game functionality

## Resources

- [Provable Games Documentation](https://docs.provable.games/)
- [Embeddable Game Standard](https://docs.provable.games/embeddable-game-standard/building-a-game)
- [game-components GitHub](https://github.com/Provable-Games/game-components)
- [Starknet Documentation](https://docs.starknet.io/)

## License

MIT
