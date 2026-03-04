/// WhoisWho game logic system.
///
/// Implements all 9 entrypoints of `IGameActions`. Game state is stored in four Dojo models:
/// - `Game`       — session metadata and current phase
/// - `Commitment` — per-player Pedersen hash commitment for commit-reveal
/// - `Board`      — per-player elimination bitmap
/// - `Turn`       — immutable record of each question/guess action
///
/// Security properties guaranteed on-chain:
/// - Identity: only registered players may act
/// - Order: strict phase machine prevents out-of-turn actions
/// - Integrity: commit-reveal verifies character choice at end of game
/// - Liveness: timeout mechanism prevents indefinite stalls
#[dojo::contract]
pub mod game_actions {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use starknet::contract_address::ContractAddressZeroable;
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use whoiswho::events::{
        CharacterCommitted, CharacterRevealed, CharactersEliminated, GameCompleted, GameCreated,
        GuessMade, GuessResult, PlayerJoined, QuestionAnswered, QuestionAsked, TimeoutClaimed,
    };
    use whoiswho::interfaces::game_actions::IGameActions;
    use whoiswho::models::game::{Board, Commitment, Game, Turn};
    use whoiswho::{constants, errors};

    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------

    /// Panics if `game.player1` is zero (game was never written to storage).
    fn assert_game_exists(game: Game) {
        assert(!game.player1.is_zero(), errors::ERR_GAME_NOT_FOUND);
    }

    /// Panics if `caller` is neither player1 nor player2.
    fn assert_player_in_game(game: Game, caller: ContractAddress) {
        assert(caller == game.player1 || caller == game.player2, errors::ERR_NOT_PLAYER);
    }

    /// Returns the address of the player whose turn it currently is.
    fn active_player(game: Game) -> ContractAddress {
        if game.current_turn == 1_u8 {
            game.player1
        } else {
            game.player2
        }
    }

    // ---------------------------------------------------------------------------
    // Entrypoints
    // ---------------------------------------------------------------------------

    #[abi(embed_v0)]
    impl GameActionsImpl of IGameActions<ContractState> {
        fn create_game(ref self: ContractState) -> felt252 {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let zero = ContractAddressZeroable::zero();
            let game_id: felt252 = world.dispatcher.uuid().into();

            world
                .write_model(
                    @Game {
                        game_id,
                        player1: caller,
                        player2: zero,
                        phase: constants::PHASE_WAITING_FOR_PLAYER2,
                        current_turn: 1_u8,
                        turn_count: 0_u16,
                        winner: zero,
                        collection_id: 0,
                        timeout_seconds: constants::ACTION_TIMEOUT_SECONDS,
                        created_at: now,
                        last_action_at: now,
                        last_question_id: 0_u8,
                        last_answer: false,
                        guess_character_id: 0,
                    },
                );

            // Initialise player1's board (player2's board is written in join_game).
            world
                .write_model(
                    @Board {
                        game_id, player: caller, eliminated_bitmap: 0_u128, remaining_count: 0_u16,
                    },
                );

            world.emit_event(@GameCreated { game_id, player1: caller, created_at: now });
            game_id
        }

        fn join_game(ref self: ContractState, game_id: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);

            assert_game_exists(game);
            assert(game.phase == constants::PHASE_WAITING_FOR_PLAYER2, errors::ERR_INVALID_PHASE);
            // Prevent player1 from joining their own game.
            assert(caller != game.player1, errors::ERR_NOT_PLAYER);
            assert(game.player2.is_zero(), errors::ERR_ALREADY_JOINED);

            game.player2 = caller;
            game.phase = constants::PHASE_COMMIT_PHASE;
            game.last_action_at = now;
            world.write_model(@game);

            world
                .write_model(
                    @Board {
                        game_id, player: caller, eliminated_bitmap: 0_u128, remaining_count: 0_u16,
                    },
                );

            world.emit_event(@PlayerJoined { game_id, player2: caller });
        }

        fn commit_character(ref self: ContractState, game_id: felt252, commitment_hash: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);

            assert_game_exists(game);
            assert(game.phase == constants::PHASE_COMMIT_PHASE, errors::ERR_INVALID_PHASE);
            assert_player_in_game(game, caller);
            // Zero hash is invalid — a properly derived pedersen hash is never zero.
            assert(commitment_hash != 0, errors::ERR_INVALID_COMMITMENT);

            let mut commitment: Commitment = world.read_model((game_id, caller));
            // Prevent players from changing their commitment.
            assert(commitment.hash == 0, errors::ERR_ALREADY_COMMITTED);
            commitment =
                Commitment {
                    game_id,
                    player: caller,
                    hash: commitment_hash,
                    revealed: false,
                    character_id: 0,
                };
            world.write_model(@commitment);

            // When both players have committed, advance to gameplay.
            let p1_commitment: Commitment = world.read_model((game_id, game.player1));
            let p2_commitment: Commitment = world.read_model((game_id, game.player2));

            if p1_commitment.hash != 0 && p2_commitment.hash != 0 {
                game.phase = constants::PHASE_P1_QUESTION_SELECT;
                game.current_turn = 1_u8;
            }

            game.last_action_at = now;
            world.write_model(@game);
            world.emit_event(@CharacterCommitted { game_id, player: caller, committed_at: now });
        }

        fn ask_question(ref self: ContractState, game_id: felt252, question_id: u8) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let zero = ContractAddressZeroable::zero();

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(active_player(game) == caller, errors::ERR_NOT_YOUR_TURN);

            // Advance to the opposing player's answer-pending phase.
            if game.current_turn == 1_u8 {
                assert(
                    game.phase == constants::PHASE_P1_QUESTION_SELECT, errors::ERR_INVALID_PHASE,
                );
                game.phase = constants::PHASE_P2_ANSWER_PENDING;
            } else {
                assert(
                    game.phase == constants::PHASE_P2_QUESTION_SELECT, errors::ERR_INVALID_PHASE,
                );
                game.phase = constants::PHASE_P1_ANSWER_PENDING;
            }

            game.turn_count = game.turn_count + 1_u16;
            game.last_question_id = question_id;
            game.last_action_at = now;

            world
                .write_model(
                    @Turn {
                        game_id,
                        turn_number: game.turn_count,
                        action_type: constants::ACTION_TYPE_QUESTION,
                        question_id,
                        answer: false,
                        asked_by: caller,
                        answered_by: zero,
                        guessed_character_id: 0,
                        action_timestamp: now,
                    },
                );

            world.write_model(@game);
            world
                .emit_event(
                    @QuestionAsked {
                        game_id, turn_number: game.turn_count, question_id, asked_by: caller,
                    },
                );
        }

        fn answer_question(ref self: ContractState, game_id: felt252, answer: bool) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            // The answerer is the *non*-active player.
            assert(active_player(game) != caller, errors::ERR_NOT_YOUR_TURN);

            // Advance to the active player's elimination phase.
            if game.current_turn == 1_u8 {
                assert(game.phase == constants::PHASE_P2_ANSWER_PENDING, errors::ERR_INVALID_PHASE);
                game.phase = constants::PHASE_P1_ELIMINATING;
            } else {
                assert(game.phase == constants::PHASE_P1_ANSWER_PENDING, errors::ERR_INVALID_PHASE);
                game.phase = constants::PHASE_P2_ELIMINATING;
            }

            // Fill in the answer on the existing turn record.
            let mut turn: Turn = world.read_model((game_id, game.turn_count));
            assert(turn.turn_number != 0_u16, errors::ERR_TURN_NOT_FOUND);
            turn.answer = answer;
            turn.answered_by = caller;
            turn.action_timestamp = now;
            world.write_model(@turn);

            game.last_answer = answer;
            game.last_action_at = now;
            world.write_model(@game);

            world
                .emit_event(
                    @QuestionAnswered {
                        game_id, turn_number: turn.turn_number, answer, answered_by: caller,
                    },
                );
        }

        fn eliminate_characters(
            ref self: ContractState, game_id: felt252, eliminated_bitmap: u128,
        ) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let mut board: Board = world.read_model((game_id, caller));

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(active_player(game) == caller, errors::ERR_NOT_YOUR_TURN);

            // Advance turn: flip active player and return to the next question-select phase.
            if game.current_turn == 1_u8 {
                assert(game.phase == constants::PHASE_P1_ELIMINATING, errors::ERR_INVALID_PHASE);
                game.current_turn = 2_u8;
                game.phase = constants::PHASE_P2_QUESTION_SELECT;
            } else {
                assert(game.phase == constants::PHASE_P2_ELIMINATING, errors::ERR_INVALID_PHASE);
                game.current_turn = 1_u8;
                game.phase = constants::PHASE_P1_QUESTION_SELECT;
            }

            // OR-merge: previously eliminated characters are never un-eliminated.
            board.eliminated_bitmap = board.eliminated_bitmap | eliminated_bitmap;
            world.write_model(@board);

            game.last_action_at = now;
            world.write_model(@game);

            world
                .emit_event(
                    @CharactersEliminated { game_id, by_player: caller, eliminated_bitmap },
                );
        }

        fn make_guess(ref self: ContractState, game_id: felt252, character_id: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let zero = ContractAddressZeroable::zero();

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(active_player(game) == caller, errors::ERR_NOT_YOUR_TURN);

            // Guess is only valid from a question-select phase (it replaces asking a question).
            if game.current_turn == 1_u8 {
                assert(
                    game.phase == constants::PHASE_P1_QUESTION_SELECT, errors::ERR_INVALID_PHASE,
                );
            } else {
                assert(
                    game.phase == constants::PHASE_P2_QUESTION_SELECT, errors::ERR_INVALID_PHASE,
                );
            }

            game.turn_count = game.turn_count + 1_u16;
            game.guess_character_id = character_id;
            game.phase = constants::PHASE_REVEAL_PHASE;
            game.last_action_at = now;
            world.write_model(@game);

            world
                .write_model(
                    @Turn {
                        game_id,
                        turn_number: game.turn_count,
                        action_type: constants::ACTION_TYPE_GUESS,
                        question_id: game.last_question_id,
                        answer: false,
                        asked_by: caller,
                        answered_by: zero,
                        guessed_character_id: character_id,
                        action_timestamp: now,
                    },
                );

            world.emit_event(@GuessMade { game_id, guessed_by: caller, character_id });
        }

        fn reveal_character(
            ref self: ContractState, game_id: felt252, character_id: felt252, salt: felt252,
        ) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let mut commitment: Commitment = world.read_model((game_id, caller));

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(game.phase == constants::PHASE_REVEAL_PHASE, errors::ERR_INVALID_PHASE);
            assert(commitment.hash != 0, errors::ERR_NO_COMMITMENT);
            assert(!commitment.revealed, errors::ERR_ALREADY_REVEALED);
            // Zero salt is always invalid (and would trivially be guessable).
            assert(salt != 0, errors::ERR_INVALID_REVEAL);

            // Core commit-reveal check: recompute the hash and compare to the stored value.
            let expected_hash = core::pedersen::pedersen(character_id, salt);
            assert(expected_hash == commitment.hash, errors::ERR_INVALID_REVEAL);

            commitment.revealed = true;
            commitment.character_id = character_id;
            world.write_model(@commitment);

            world.emit_event(@CharacterRevealed { game_id, player: caller, character_id });

            // Resolve winner once both players have revealed.
            let p1_commitment: Commitment = world.read_model((game_id, game.player1));
            let p2_commitment: Commitment = world.read_model((game_id, game.player2));

            if p1_commitment.revealed && p2_commitment.revealed {
                // The guess target is the opponent's revealed character.
                let guess_target = if game.current_turn == 1_u8 {
                    p2_commitment.character_id
                } else {
                    p1_commitment.character_id
                };

                let guesser = active_player(game);
                let target_player = if game.current_turn == 1_u8 {
                    game.player2
                } else {
                    game.player1
                };
                let is_correct = game.guess_character_id == guess_target;

                // Correct guess → guesser wins; incorrect → the target player wins.
                game.winner = if is_correct {
                    guesser
                } else {
                    target_player
                };
                game.phase = constants::PHASE_COMPLETED;
                game.last_action_at = now;
                world.write_model(@game);
                world.emit_event(@GuessResult { game_id, guessed_by: guesser, is_correct });
                world.emit_event(@GameCompleted { game_id, winner: game.winner });
            }
        }

        fn claim_timeout(ref self: ContractState, game_id: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let zero = ContractAddressZeroable::zero();
            let timeout_seconds = game.timeout_seconds;

            assert_game_exists(game);
            assert(now >= game.last_action_at + timeout_seconds, errors::ERR_TIMEOUT_NOT_REACHED);

            // Determine who timed out and validate the caller is eligible to claim.
            let timed_out_player = if game.phase == constants::PHASE_WAITING_FOR_PLAYER2 {
                // Abandoned game: only player1 can reclaim their slot.
                assert(caller == game.player1, errors::ERR_NOT_PLAYER);
                zero // No opponent to name.
            } else {
                let expected = active_player(game);
                // The inactive (active) player cannot claim against themselves.
                assert(caller != expected, errors::ERR_CALLER_NOT_ELIGIBLE);
                assert_player_in_game(game, caller);
                expected
            };

            game.winner = caller;
            game.phase = constants::PHASE_COMPLETED;
            game.last_action_at = now;
            world.write_model(@game);

            world.emit_event(@TimeoutClaimed { game_id, claimed_by: caller, timed_out_player });
            world.emit_event(@GameCompleted { game_id, winner: caller });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> WorldStorage {
            self.world(@"whoiswho")
        }
    }
}
