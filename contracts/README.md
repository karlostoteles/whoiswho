# GuessNFT Game Contract

A Starknet smart contract for the GuessNFT game, implementing on-chain commit-reveal scheme for character selection.

## Overview

The GuessNFT contract enables two players to:
1. **Commit** their secret character choice (via Pedersen hash)
2. **Play** the guessing game without revealing their choice
3. **Reveal** their character at game end (cryptographically verified)
4. **Wager** NFTs on the game outcome

## Contract Functions

### Write Functions

| Function | Description |
|----------|-------------|
| `create_game(game_id, player2)` | Initialize a new game session |
| `commit_character(game_id, commitment)` | Submit hashed character choice |
| `reveal_character(game_id, character_id, salt)` | Reveal and verify character |
| `deposit_wager(game_id, token_id)` | Stake an NFT on the game |
| `opponent_won(game_id)` | Concede the game |

### Read Functions

| Function | Description |
|----------|-------------|
| `get_game(game_id)` | Get full game state |
| `get_commitment(game_id, player)` | Get a player's commitment |

## Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) >= 2.8.0
- [Starkli](https://book.starkli.rs/) (for deployment)
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/) (for testing)

## Installation

```bash
# Install Scarb (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh

# Install Starkli
curl https://get.starkli.rs | sh
starkliup

# Install Starknet Foundry
curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
```

## Build

```bash
cd contracts
scarb build
```

## Test

```bash
cd contracts
snforge test
```

### Run Specific Tests

```bash
# Test contract deployment
snforge test test_constructor

# Test game creation
snforge test test_create_game

# Test commit-reveal flow
snforge test test_reveal_character

# Run all tests with verbose output
snforge test -v
```

## Deployment

### 1. Setup Account

```bash
# Create a new account (if needed)
starkli account create guessnft_deployer

# Fund the account on testnet
# Get ETH from faucet: https://starknet-faucet.vercel.app/

# Deploy the account
starkli account deploy guessnft_deployer
```

### 2. Declare Contract

```bash
# Set environment variables
export STARKNET_RPC="https://starknet-sepolia.public.blastapi.io"
export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json
export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json

# Declare the contract
starkli declare target/dev/guessnft_GuessNFT.contract_class.json
```

### 3. Deploy Contract

```bash
# Deploy with the SCHIZODIO NFT contract address
starkli deploy <CLASS_HASH> <SCHIZODIO_CONTRACT_ADDRESS>

# SCHIZODIO on mainnet: 0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa
```

### 4. Update Frontend Config

After deployment, update `src/services/starknet/config.ts`:

```typescript
export const GAME_CONTRACT = '0xYOUR_DEPLOYED_ADDRESS';
```

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      GuessNFT Contract                       │
├─────────────────────────────────────────────────────────────┤
│  Storage                                                     │
│  ├── nft_contract: ContractAddress                          │
│  └── games: Map<game_id, Game>                              │
│                                                              │
│  Game Struct                                                 │
│  ├── player1, player2: ContractAddress                      │
│  ├── p1_commitment, p2_commitment: felt252                  │
│  ├── p1_revealed_char, p2_revealed_char: felt252            │
│  ├── p1_wager, p2_wager: u256                               │
│  └── winner: ContractAddress                                │
├─────────────────────────────────────────────────────────────┤
│  Events                                                      │
│  ├── GameCreated                                             │
│  ├── CharacterCommitted                                      │
│  ├── CharacterRevealed                                       │
│  ├── WagerDeposited                                          │
│  └── GameWon                                                 │
└─────────────────────────────────────────────────────────────┘
```

## Commit-Reveal Scheme

The cryptographic flow:

```
1. COMMIT:
   character_id = "character-123"  (player's secret choice)
   salt = random_256_bit()
   commitment = pedersen_hash(character_id, salt)
   
   → Store commitment on-chain (nobody knows the character)

2. PLAY:
   Players ask/answer questions.
   Cannot change commitment without knowing opponent's salt.

3. REVEAL:
   Submit (character_id, salt) on-chain
   Contract verifies: pedersen_hash(character_id, salt) == stored_commitment
   ✓ Valid → Character is locked in
   ✗ Invalid → Transaction reverts
```

## Security Considerations

1. **Commitment Integrity**: Players cannot change their character after committing
2. **Reveal Verification**: On-chain Pedersen hash verification prevents tampering
3. **Wager Security**: NFTs are held by the contract until game completion
4. **Player Authorization**: Only game participants can call game functions

## Gas Optimization

- Uses `felt252` for game IDs (cheaper than `u256`)
- Minimal storage reads/writes
- Events for off-chain indexing instead of storage

## License

MIT
