use dojo::model::ModelStorage;
use dojo::world::WorldStorageTrait;
use whoiswho::constants;
use whoiswho::interfaces::game_actions::IGameActionsDispatcherTrait;
use whoiswho::models::game::{Board, Commitment, Game};
use whoiswho::tests::setup::{
    OUTSIDER, PLAYER1, PLAYER2, create_test_world, do_commits, do_qa_cycle_p1_asks,
    do_qa_cycle_p2_asks, setup_game,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

#[test]
fn timeout_constant_is_45_seconds() {
    assert(constants::ACTION_TIMEOUT_SECONDS == 45_u64, 'BAD_TIMEOUT');
}

#[test]
fn phase_order_is_stable() {
    assert(constants::PHASE_WAITING_FOR_PLAYER2 < constants::PHASE_COMPLETED, 'BAD_PHASE_ORDER');
}

// ---------------------------------------------------------------------------
// Pedersen hash sanity
// ---------------------------------------------------------------------------

#[test]
fn pedersen_hash_is_deterministic_and_nonzero() {
    let a: felt252 = 42;
    let b: felt252 = 999;
    let h1 = core::pedersen::pedersen(a, b);
    let h2 = core::pedersen::pedersen(a, b);
    assert(h1 == h2, 'pedersen not deterministic');
    assert(h1 != 0, 'pedersen should not be zero');
    assert(h1 != a, 'hash should differ from input a');
    assert(h1 != b, 'hash should differ from input b');
}

#[test]
fn pedersen_hash_differs_by_input() {
    let h1 = core::pedersen::pedersen(1, 2);
    let h2 = core::pedersen::pedersen(1, 3);
    let h3 = core::pedersen::pedersen(2, 2);
    assert(h1 != h2, 'diff salt => diff hash');
    assert(h1 != h3, 'diff char => diff hash');
}

// ---------------------------------------------------------------------------
// Happy path: P1 guesses correctly and wins
// ---------------------------------------------------------------------------

#[test]
fn test_full_game_p1_correct_guess_wins() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, salt_p1, char_p2, salt_p2) = do_commits(game_actions, game_id);

    // P1 asks, P2 answers, P1 eliminates
    do_qa_cycle_p1_asks(game_actions, game_id);

    // P2 asks, P1 answers, P2 eliminates
    do_qa_cycle_p2_asks(game_actions, game_id);

    // P1 guesses P2's character correctly
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    // Both reveal
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, salt_p1);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.reveal_character(game_id, char_p2, salt_p2);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER1(), 'P1 should win correct guess');
}

// ---------------------------------------------------------------------------
// Happy path: P1 guesses wrong — P2 wins
// ---------------------------------------------------------------------------

#[test]
fn test_full_game_p1_wrong_guess_p2_wins() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, salt_p1, char_p2, salt_p2) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(game_actions, game_id);
    do_qa_cycle_p2_asks(game_actions, game_id);

    // P1 guesses wrong (char 999, not char_p2)
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, 999);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, salt_p1);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.reveal_character(game_id, char_p2, salt_p2);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER2(), 'P2 should win wrong guess');
}

// ---------------------------------------------------------------------------
// Turn enforcement
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_p2_cannot_ask_on_p1_turn() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // Phase is P1_QUESTION_SELECT — P2 asks: must fail
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.ask_question(game_id, 1);
}

#[test]
#[should_panic]
fn test_p1_cannot_answer_their_own_question() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    // Phase is P2_ANSWER_PENDING — P1 tries to answer: must fail
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.answer_question(game_id, true);
}

// ---------------------------------------------------------------------------
// Phase enforcement
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_cannot_answer_before_question() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // Phase is P1_QUESTION_SELECT — no question asked yet
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.answer_question(game_id, true);
}

#[test]
#[should_panic]
fn test_cannot_commit_after_commit_phase() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // Phase advanced to P1_QUESTION_SELECT — commit again must fail
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(99, 99), 0_u256);
}

// ---------------------------------------------------------------------------
// Commit guards (todos 001, 003)
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_double_commit_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(1, 101), 0_u256);
    // Second commit with a different hash — must fail
    game_actions.commit_character(game_id, core::pedersen::pedersen(2, 202), 0_u256);
}

#[test]
#[should_panic]
fn test_zero_hash_commit_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, 0, 0_u256);
}

// ---------------------------------------------------------------------------
// Reveal guards — Pedersen verification (todo 001)
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_reveal_wrong_character_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (_, salt_p1, char_p2, salt_p2) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(game_actions, game_id);
    do_qa_cycle_p2_asks(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    // P1 reveals wrong character_id (99 instead of 1)
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, 99, salt_p1);
}

#[test]
#[should_panic]
fn test_reveal_wrong_salt_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, _, char_p2, salt_p2) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(game_actions, game_id);
    do_qa_cycle_p2_asks(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    // P1 reveals wrong salt (999 instead of 101)
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, 999);
}

#[test]
#[should_panic]
fn test_reveal_zero_salt_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, _, char_p2, salt_p2) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(game_actions, game_id);
    do_qa_cycle_p2_asks(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, 0);
}

// ---------------------------------------------------------------------------
// Bitmap monotonicity (todo 004)
// ---------------------------------------------------------------------------

#[test]
fn test_bitmap_accumulates_across_eliminations() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // First elimination: bits 0-3
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.answer_question(game_id, true);
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.eliminate_characters(game_id, 0x0F);

    let board_after_first: Board = world.read_model((game_id, PLAYER1()));
    assert(board_after_first.eliminated_bitmap == 0x0F, 'first elimination wrong');

    // Second turn: P2 asks, P1 answers, P2 eliminates
    do_qa_cycle_p2_asks(game_actions, game_id);

    // Third turn: P1 asks again, P2 answers, P1 eliminates with more bits
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 3);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.answer_question(game_id, true);
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.eliminate_characters(game_id, 0xF0);

    let board_after_second: Board = world.read_model((game_id, PLAYER1()));
    // OR of 0x0F and 0xF0 = 0xFF
    assert(board_after_second.eliminated_bitmap == 0xFF, 'bitmap should OR-accumulate');
}

#[test]
fn test_sending_zero_bitmap_does_not_reset() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.answer_question(game_id, true);
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.eliminate_characters(game_id, 0xAB);

    do_qa_cycle_p2_asks(game_actions, game_id);

    // P1 sends zero bitmap — should be a no-op, not a reset
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 3);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.answer_question(game_id, true);
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.eliminate_characters(game_id, 0);

    let board: Board = world.read_model((game_id, PLAYER1()));
    assert(board.eliminated_bitmap == 0xAB, 'zero send should not reset');
}

// ---------------------------------------------------------------------------
// Timeout — todo 002
// ---------------------------------------------------------------------------

#[test]
fn test_player1_claims_timeout_on_abandoned_game() {
    let (mut world, game_actions) = create_test_world();

    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(0_u256, 0_u8);

    // Jump 46 seconds — no P2 joined
    starknet::testing::set_block_timestamp(46);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.claim_timeout(game_id);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER1(), 'P1 should win abandoned game');
}

#[test]
#[should_panic]
fn test_outsider_cannot_claim_timeout_on_abandoned_game() {
    let (_, game_actions) = create_test_world();

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.create_game(0_u256, 0_u8);
    // Get the game_id. Since this is a fresh world, uuid starts at 0.
    let game_id: felt252 = 0;

    starknet::testing::set_block_timestamp(46);

    starknet::testing::set_contract_address(OUTSIDER());
    game_actions.claim_timeout(game_id);
}

#[test]
#[should_panic]
fn test_active_player_cannot_self_claim_timeout() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // P1 is active (phase = P1_QUESTION_SELECT)
    starknet::testing::set_block_timestamp(46);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.claim_timeout(game_id);
}

#[test]
fn test_inactive_player_claims_timeout_mid_game() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // P1 must act but doesn't — P2 claims after timeout
    starknet::testing::set_block_timestamp(46);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.claim_timeout(game_id);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER2(), 'P2 should win on P1 timeout');
}

#[test]
#[should_panic]
fn test_timeout_not_yet_reached_reverts() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // Only 10 seconds have passed — not enough
    starknet::testing::set_block_timestamp(10);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.claim_timeout(game_id);
}

// ---------------------------------------------------------------------------
// Join guards
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_cannot_join_own_game() {
    let (_, game_actions) = create_test_world();

    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(0_u256, 0_u8);

    // P1 tries to join their own game
    game_actions.join_game(game_id);
}

#[test]
#[should_panic]
fn test_third_player_cannot_join_full_game() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions); // P1 creates, P2 joins

    starknet::testing::set_contract_address(OUTSIDER());
    game_actions.join_game(game_id);
}

// ---------------------------------------------------------------------------
// ZK proof path guards
// ---------------------------------------------------------------------------

/// Builds a 15-element public inputs prefix matching real Garaga snforge calldata format.
/// All values correctly match an in-progress game where P1 asked question 1 (turn_count=1).
/// Real layout: [count=7, PI0_lo, PI0_hi, PI1_lo, PI1_hi, ..., PI6_lo, PI6_hi]
/// PIs in order: game_id, turn_id, player, commitment, question_id, traits_root, answer_bit
fn make_valid_public_inputs(
    game_id: felt252,
    player: starknet::ContractAddress,
    zk_commitment: u256,
    traits_root: u256,
) -> Span<felt252> {
    array![
        7,                           // [0]  count of public inputs
        game_id,                     // [1]  PI[0] lo — game_id
        0,                           // [2]  PI[0] hi
        1,                           // [3]  PI[1] lo — turn_id = 1 (after one ask_question)
        0,                           // [4]  PI[1] hi
        player.into(),               // [5]  PI[2] lo — player address
        0,                           // [6]  PI[2] hi
        zk_commitment.low.into(),    // [7]  PI[3] lo — commitment lo
        zk_commitment.high.into(),   // [8]  PI[3] hi — commitment hi
        1,                           // [9]  PI[4] lo — question_id = 1
        0,                           // [10] PI[4] hi
        traits_root.low.into(),      // [11] PI[5] lo — traits_root lo
        traits_root.high.into(),     // [12] PI[5] hi — traits_root hi
        1,                           // [13] PI[6] lo — answer_bit = 1
        0,                           // [14] PI[6] hi
    ]
        .span()
}

#[test]
#[should_panic(expected: ('Invalid proof inputs length', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_too_short_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    // Submit array with only 14 elements (need >= 15)
    starknet::testing::set_contract_address(PLAYER2());
    game_actions
        .answer_question_with_proof(
            game_id, array![7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].span(),
        );
}

#[test]
#[should_panic(expected: ('Proof game_id mismatch', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_game_id_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // Wrong game_id at PI[0] lo (index 1)
    game_actions
        .answer_question_with_proof(
            game_id,
            array![7, game_id + 1, 0, 1, 0, PLAYER2().into(), 0, 0, 0, 1, 0, 0, 0, 1, 0].span(),
        );
}

#[test]
#[should_panic(expected: ('Proof turn_id mismatch', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_replay_attack_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1); // turn_count becomes 1

    starknet::testing::set_contract_address(PLAYER2());
    // Send proof with turn_id = 999 at PI[1] lo (index 3) — correct turn is 1
    game_actions
        .answer_question_with_proof(
            game_id,
            array![7, game_id, 0, 999, 0, PLAYER2().into(), 0, 0, 0, 1, 0, 0, 0, 1, 0].span(),
        );
}

#[test]
#[should_panic(expected: ('Proof player mismatch', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_player_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // Send proof with wrong player at PI[2] lo (index 5) — OUTSIDER instead of PLAYER2
    game_actions
        .answer_question_with_proof(
            game_id,
            array![7, game_id, 0, 1, 0, OUTSIDER().into(), 0, 0, 0, 1, 0, 0, 0, 1, 0].span(),
        );
}

#[test]
#[should_panic(expected: ('Proof question_id mismatch', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_question_id_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1); // question_id = 1

    starknet::testing::set_contract_address(PLAYER2());
    // Send proof with wrong question_id = 5 at PI[4] lo (index 9) — asked question was 1
    game_actions
        .answer_question_with_proof(
            game_id,
            array![7, game_id, 0, 1, 0, PLAYER2().into(), 0, 0, 0, 5, 0, 0, 0, 1, 0].span(),
        );
}

#[test]
#[should_panic(expected: ('Proof traits_root mismatch', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_traits_root_rejected() {
    let (_, game_actions) = create_test_world();
    // Create game with a specific traits_root
    let traits_root: u256 = 0xdeadbeef_u256;
    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(traits_root, 0_u8);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.join_game(game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(1, 101), 0_u256);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.commit_character(game_id, core::pedersen::pedersen(2, 202), 0_u256);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // Send proof with wrong traits_root at PI[5] lo/hi (indices 11, 12) — both 0, actual is 0xdeadbeef
    game_actions
        .answer_question_with_proof(
            game_id,
            array![7, game_id, 0, 1, 0, PLAYER2().into(), 0, 0, 0, 1, 0, 0, 0, 1, 0].span(),
        );
}

#[test]
#[should_panic(expected: ('Proof commitment mismatch', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_commitment_rejected() {
    let (_, game_actions) = create_test_world();
    let zk_commitment_p2: u256 = 0xabcd1234_u256;
    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(0_u256, 0_u8);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.join_game(game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(1, 101), 0_u256);
    starknet::testing::set_contract_address(PLAYER2());
    // P2 commits with zk_commitment = 0xabcd1234
    game_actions.commit_character(game_id, core::pedersen::pedersen(2, 202), zk_commitment_p2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // Send proof with wrong commitment at PI[3] lo (index 7) — 1 instead of 0xabcd1234
    game_actions
        .answer_question_with_proof(
            game_id,
            array![7, game_id, 0, 1, 0, PLAYER2().into(), 0, 1, 0, 1, 0, 0, 0, 1, 0].span(),
        );
}

#[test]
fn test_create_game_stores_traits_root_and_question_set_id() {
    let (mut world, game_actions) = create_test_world();
    let traits_root: u256 = 0x1234567890abcdef_u256;
    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(traits_root, 3_u8);

    let game: Game = world.read_model(game_id);
    assert(game.traits_root == traits_root, 'traits_root not stored');
    assert(game.question_set_id == 3_u8, 'question_set_id not stored');
}
