use starknet::{ContractAddress, get_caller_address};
use game_components_embeddable_game_standard::minigame::interface::{IMINIGAME_ID, IMinigameTokenData};
use game_components_embeddable_game_standard::minigame::minigame_component::MinigameComponent;
use game_components_interfaces::minigame::token_data::IMinigameTokenData as ITokenData;
use openzeppelin_introspection::src5::SRC5Component;

// Game phases for the deduction game
#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
pub enum GamePhase {
    WaitingForPlayers,    // Game created, waiting for opponent
    SetupP1,              // Player 1 selecting character
    SetupP2,              // Player 2 selecting character
    InProgress,           // Game in progress - asking/answering questions
    GuessPhase,           // Player making final guess
    GameOver,             // Game finished
}

// Game outcome
#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
pub enum GameOutcome {
    None,                 // Game not finished
    P1Wins,               // Player 1 won
    P2Wins,               // Player 2 won
    Draw,                 // Draw (shouldn't happen in this game)
}

// Player's game state
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct PlayerState {
    pub character_commitment: felt252,  // Pedersen hash of character_id + salt
    pub character_revealed: bool,        // Whether they've revealed their character
    pub character_id: felt252,           // The actual character ID (revealed at end)
    pub questions_asked: u32,            // Number of questions asked
    pub wrong_guesses: u32,              // Number of wrong guesses made
}

// Game session state - all keyed by token_id
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct GameSession {
    pub token_id: felt252,
    pub player1: ContractAddress,
    pub player2: ContractAddress,
    pub current_turn: u8,                // 1 = P1's turn, 2 = P2's turn
    pub phase: GamePhase,
    pub outcome: GameOutcome,
    pub total_questions: u32,            // Total questions asked in game
    pub p1_state: PlayerState,
    pub p2_state: PlayerState,
    pub created_at: u64,
    pub finished_at: u64,
}

// Question and answer record
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct QuestionRecord {
    pub token_id: felt252,
    pub question_id: felt252,
    pub asker: ContractAddress,
    pub answer: bool,                    // true = yes, false = no
    pub answered: bool,
}

#[starknet::interface]
pub trait IGuessNFTGame<TContractState> {
    // Game setup actions
    fn join_game(ref self: TContractState, token_id: felt252);
    fn commit_character(ref self: TContractState, token_id: felt252, commitment: felt252);
    fn reveal_character(ref self: TContractState, token_id: felt252, character_id: felt252, salt: felt252);
    
    // Game play actions
    fn ask_question(ref self: TContractState, token_id: felt252, question_id: felt252);
    fn answer_question(ref self: TContractState, token_id: felt252, question_id: felt252, answer: bool);
    fn make_guess(ref self: TContractState, token_id: felt252, character_id: felt252);
    
    // View functions
    fn get_game(self: @TContractState, token_id: felt252) -> GameSession;
    fn get_current_turn(self: @TContractState, token_id: felt252) -> ContractAddress;
    fn is_game_over(self: @TContractState, token_id: felt252) -> bool;
    fn get_score(self: @TContractState, token_id: felt252) -> u64;
}

#[starknet::contract]
mod GuessNFTGame {
    use super::*;
    use game_components_embeddable_game_standard::minigame::minigame_component::MinigameComponent;
    
    component!(path: MinigameComponent, storage: minigame, event: MinigameEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    
    #[abi(embed_v0)]
    impl MinigameImpl = MinigameComponent::MinigameImpl<ContractState>;
    impl MinigameInternalImpl = MinigameComponent::InternalImpl<ContractState>;
    
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;
    
    #[storage]
    struct Storage {
        #[substorage(v0)]
        minigame: MinigameComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        
        // Token-keyed game sessions
        games: Map<felt252, GameSession>,
        
        // Question records keyed by (token_id, question_index)
        questions: Map<(felt252, u32), QuestionRecord>,
        
        // Question counter per game
        question_counters: Map<felt252, u32>,
        
        // NFT contract address for wager mode
        nft_contract: ContractAddress,
        
        // Game registry address (for EGS)
        registry: ContractAddress,
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        MinigameEvent: MinigameComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        
        // Game events
        GameCreated: GameCreatedEvent,
        PlayerJoined: PlayerJoinedEvent,
        CharacterCommitted: CharacterCommittedEvent,
        CharacterRevealed: CharacterRevealedEvent,
        QuestionAsked: QuestionAskedEvent,
        QuestionAnswered: QuestionAnsweredEvent,
        GuessMade: GuessMadeEvent,
        GameEnded: GameEndedEvent,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct GameCreatedEvent {
        pub token_id: felt252,
        pub creator: ContractAddress,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct PlayerJoinedEvent {
        pub token_id: felt252,
        pub player: ContractAddress,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct CharacterCommittedEvent {
        pub token_id: felt252,
        pub player: ContractAddress,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct CharacterRevealedEvent {
        pub token_id: felt252,
        pub player: ContractAddress,
        pub character_id: felt252,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct QuestionAskedEvent {
        pub token_id: felt252,
        pub question_id: felt252,
        pub asker: ContractAddress,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct QuestionAnsweredEvent {
        pub token_id: felt252,
        pub question_id: felt252,
        pub answer: bool,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct GuessMadeEvent {
        pub token_id: felt252,
        pub guesser: ContractAddress,
        pub character_id: felt252,
        pub correct: bool,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct GameEndedEvent {
        pub token_id: felt252,
        pub winner: ContractAddress,
        pub score: u64,
    }
    
    #[constructor]
    fn constructor(
        ref self: ContractState,
        nft_contract: ContractAddress,
        registry: ContractAddress,
    ) {
        // Register the minigame interface for EGS discovery
        self.src5.register_interface(IMINIGAME_ID);
        
        self.nft_contract.write(nft_contract);
        self.registry.write(registry);
    }
    
    // ============ EGS Required Interface Implementation ============
    
    #[abi(embed_v0)]
    impl MinigameTokenDataImpl of IMinigameTokenData<ContractState> {
        /// Returns the score for a game session (token)
        /// Score = (max_questions - questions_asked) * 100 + correct_guess_bonus
        /// Higher score = better performance (fewer questions = more points)
        fn score(self: @ContractState, token_id: felt252) -> u64 {
            let game = self.games.read(token_id);
            
            if game.phase != GamePhase::GameOver {
                return 0;
            }
            
            // Base score calculation
            // Max questions allowed: 20 (typical Guess Who rules)
            // Score = (20 - questions_asked) * 100 for winner
            let max_questions: u32 = 20;
            
            // Winner's score based on efficiency
            let questions_used = game.total_questions;
            let efficiency_bonus = if questions_used < max_questions {
                (max_questions - questions_used) * 100_u32
            } else {
                1_u32  // Minimum score for winning
            };
            
            // Add bonus for winning
            let winner_bonus: u32 = 1000;
            
            // Convert to u64
            (efficiency_bonus + winner_bonus).into()
        }
        
        /// Returns whether the game is over for this token
        fn game_over(self: @ContractState, token_id: felt252) -> bool {
            let game = self.games.read(token_id);
            game.phase == GamePhase::GameOver
        }
    }
    
    // ============ Game Interface Implementation ============
    
    #[abi(embed_v0)]
    impl GuessNFTGameImpl of super::IGuessNFTGame<ContractState> {
        /// Player 2 joins an existing game
        fn join_game(ref self: ContractState, token_id: felt252) {
            // Pre-action hook for EGS
            self.minigame.pre_action(token_id);
            
            let caller = get_caller_address();
            let mut game = self.games.read(token_id);
            
            assert(game.phase == GamePhase::WaitingForPlayers, 'Not waiting for players');
            assert(game.player2 == 0_u256.try_into().unwrap(), 'Already has opponent');
            assert(caller != game.player1, 'Cannot join own game');
            
            game.player2 = caller;
            game.phase = GamePhase::SetupP1;
            game.current_turn = 1;
            
            self.games.write(token_id, game);
            
            self.emit(Event::PlayerJoined(PlayerJoinedEvent {
                token_id,
                player: caller,
            }));
            
            // Post-action hook for EGS
            self.minigame.post_action(token_id);
        }
        
        /// Commit to a character selection using Pedersen hash
        fn commit_character(ref self: ContractState, token_id: felt252, commitment: felt252) {
            self.minigame.pre_action(token_id);
            
            let caller = get_caller_address();
            let mut game = self.games.read(token_id);
            
            assert(commitment != 0, 'Invalid commitment');
            
            // Determine which player is committing
            if game.phase == GamePhase::SetupP1 && caller == game.player1 {
                game.p1_state.character_commitment = commitment;
                game.phase = GamePhase::SetupP2;
            } else if game.phase == GamePhase::SetupP2 && caller == game.player2 {
                game.p2_state.character_commitment = commitment;
                game.phase = GamePhase::InProgress;
            } else {
                panic('Invalid commit phase or player');
            }
            
            self.games.write(token_id, game);
            
            self.emit(Event::CharacterCommitted(CharacterCommittedEvent {
                token_id,
                player: caller,
            }));
            
            self.minigame.post_action(token_id);
        }
        
        /// Reveal character at game end for verification
        fn reveal_character(
            ref self: ContractState,
            token_id: felt252,
            character_id: felt252,
            salt: felt252,
        ) {
            self.minigame.pre_action(token_id);
            
            let caller = get_caller_address();
            let game = self.games.read(token_id);
            
            // Can only reveal after game is over
            assert(game.phase == GamePhase::GameOver, 'Game not over');
            
            // Verify commitment matches
            // In Cairo, we'd use: pedersen_hash(character_id, salt) == commitment
            // For now, we'll trust the reveal (full implementation needs hash verification)
            
            self.emit(Event::CharacterRevealed(CharacterRevealedEvent {
                token_id,
                player: caller,
                character_id,
            }));
            
            self.minigame.post_action(token_id);
        }
        
        /// Ask a yes/no question about opponent's character
        fn ask_question(ref self: ContractState, token_id: felt252, question_id: felt252) {
            self.minigame.pre_action(token_id);
            
            let caller = get_caller_address();
            let mut game = self.games.read(token_id);
            
            assert(game.phase == GamePhase::InProgress, 'Game not in progress');
            
            // Verify it's the caller's turn
            let is_p1_turn = game.current_turn == 1;
            let expected_caller = if is_p1_turn { game.player1 } else { game.player2 };
            assert(caller == expected_caller, 'Not your turn');
            
            // Create question record
            let question_idx = self.question_counters.read(token_id);
            let question = QuestionRecord {
                token_id,
                question_id,
                asker: caller,
                answer: false,
                answered: false,
            };
            
            self.questions.write((token_id, question_idx), question);
            self.question_counters.write(token_id, question_idx + 1);
            
            // Update player's question count
            if is_p1_turn {
                game.p1_state.questions_asked += 1;
            } else {
                game.p2_state.questions_asked += 1;
            }
            game.total_questions += 1;
            
            self.games.write(token_id, game);
            
            self.emit(Event::QuestionAsked(QuestionAskedEvent {
                token_id,
                question_id,
                asker: caller,
            }));
            
            self.minigame.post_action(token_id);
        }
        
        /// Answer a question (yes/no)
        fn answer_question(
            ref self: ContractState,
            token_id: felt252,
            question_id: felt252,
            answer: bool,
        ) {
            self.minigame.pre_action(token_id);
            
            let caller = get_caller_address();
            let mut game = self.games.read(token_id);
            
            assert(game.phase == GamePhase::InProgress, 'Game not in progress');
            
            // Verify caller is the one who should answer (opponent of asker)
            let is_p1_turn = game.current_turn == 1;
            let expected_answerer = if is_p1_turn { game.player2 } else { game.player1 };
            assert(caller == expected_answerer, 'Not your answer turn');
            
            // Find the question and update it
            let question_idx = self.question_counters.read(token_id) - 1;
            let mut question = self.questions.read((token_id, question_idx));
            question.answer = answer;
            question.answered = true;
            self.questions.write((token_id, question_idx), question);
            
            // Switch turns
            game.current_turn = if is_p1_turn { 2 } else { 1 };
            
            self.games.write(token_id, game);
            
            self.emit(Event::QuestionAnswered(QuestionAnsweredEvent {
                token_id,
                question_id,
                answer,
            }));
            
            self.minigame.post_action(token_id);
        }
        
        /// Make a guess at the opponent's character
        fn make_guess(ref self: ContractState, token_id: felt252, character_id: felt252) {
            self.minigame.pre_action(token_id);
            
            let caller = get_caller_address();
            let mut game = self.games.read(token_id);
            
            assert(game.phase == GamePhase::InProgress, 'Game not in progress');
            
            // Verify it's the caller's turn
            let is_p1 = caller == game.player1;
            let is_p2 = caller == game.player2;
            assert(is_p1 || is_p2, 'Not a player');
            
            let is_p1_turn = game.current_turn == 1;
            let expected_caller = if is_p1_turn { game.player1 } else { game.player2 };
            assert(caller == expected_caller, 'Not your turn');
            
            // Check if the guess is correct
            // In a real implementation, we'd verify against the committed character
            // For now, we'll use a simplified check
            
            // Record the guess
            let correct = false; // Will be determined by commitment reveal
            
            if !correct {
                // Wrong guess - increment wrong guesses counter
                if is_p1 {
                    game.p1_state.wrong_guesses += 1;
                    // Switch turn to opponent
                    game.current_turn = 2;
                } else {
                    game.p2_state.wrong_guesses += 1;
                    game.current_turn = 1;
                }
                
                // Check for too many wrong guesses (optional rule)
                // Could end game after 3 wrong guesses
            } else {
                // Correct guess - game over!
                game.phase = GamePhase::GameOver;
                game.outcome = if is_p1 { GameOutcome::P1Wins } else { GameOutcome::P2Wins };
            }
            
            self.games.write(token_id, game);
            
            self.emit(Event::GuessMade(GuessMadeEvent {
                token_id,
                guesser: caller,
                character_id,
                correct,
            }));
            
            if game.phase == GamePhase::GameOver {
                let winner = if game.outcome == GameOutcome::P1Wins { 
                    game.player1 
                } else { 
                    game.player2 
                };
                
                self.emit(Event::GameEnded(GameEndedEvent {
                    token_id,
                    winner,
                    score: self.score(token_id),
                }));
            }
            
            self.minigame.post_action(token_id);
        }
        
        // ============ View Functions ============
        
        fn get_game(self: @ContractState, token_id: felt252) -> GameSession {
            self.games.read(token_id)
        }
        
        fn get_current_turn(self: @ContractState, token_id: felt252) -> ContractAddress {
            let game = self.games.read(token_id);
            if game.current_turn == 1 {
                game.player1
            } else {
                game.player2
            }
        }
        
        fn is_game_over(self: @ContractState, token_id: felt252) -> bool {
            let game = self.games.read(token_id);
            game.phase == GamePhase::GameOver
        }
        
        fn get_score(self: @ContractState, token_id: felt252) -> u64 {
            self.score(token_id)
        }
    }
    
    // ============ Internal Functions ============
    
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Create a new game session (called when token is minted)
        fn create_game_session(
            ref self: ContractState,
            token_id: felt252,
            creator: ContractAddress,
        ) {
            let zero_address: ContractAddress = 0_felt252.try_into().unwrap();
            
            let default_player_state = PlayerState {
                character_commitment: 0,
                character_revealed: false,
                character_id: 0,
                questions_asked: 0,
                wrong_guesses: 0,
            };
            
            let game = GameSession {
                token_id,
                player1: creator,
                player2: zero_address,
                current_turn: 1,
                phase: GamePhase::WaitingForPlayers,
                outcome: GameOutcome::None,
                total_questions: 0,
                p1_state: default_player_state,
                p2_state: default_player_state,
                created_at: 0, // Would use starknet::get_block_timestamp in real impl
                finished_at: 0,
            };
            
            self.games.write(token_id, game);
            
            self.emit(Event::GameCreated(GameCreatedEvent {
                token_id,
                creator,
            }));
        }
        
        /// End the game with a winner
        fn end_game(
            ref self: ContractState,
            token_id: felt252,
            winner: ContractAddress,
        ) {
            let mut game = self.games.read(token_id);
            
            game.phase = GamePhase::GameOver;
            game.outcome = if winner == game.player1 {
                GameOutcome::P1Wins
            } else {
                GameOutcome::P2Wins
            };
            // game.finished_at = starknet::get_block_timestamp();
            
            self.games.write(token_id, game);
            
            self.emit(Event::GameEnded(GameEndedEvent {
                token_id,
                winner,
                score: self.score(token_id),
            }));
        }
    }
}
