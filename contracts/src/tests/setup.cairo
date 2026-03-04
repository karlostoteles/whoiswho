use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{
    ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
    spawn_test_world,
};
use starknet::{ContractAddress, contract_address_const};
use whoiswho::events::{
    e_CharacterCommitted, e_CharacterRevealed, e_CharactersEliminated, e_GameCompleted,
    e_GameCreated, e_GuessMade, e_GuessResult, e_PlayerJoined, e_QuestionAnswered, e_QuestionAsked,
    e_TimeoutClaimed,
};
use whoiswho::interfaces::game_actions::{IGameActionsDispatcher, IGameActionsDispatcherTrait};
use whoiswho::models::game::{m_Board, m_Commitment, m_Game, m_Turn};
use whoiswho::systems::game_actions::game_actions;

pub fn PLAYER1() -> ContractAddress {
    contract_address_const::<'PLAYER1'>()
}
pub fn PLAYER2() -> ContractAddress {
    contract_address_const::<'PLAYER2'>()
}
pub fn OUTSIDER() -> ContractAddress {
    contract_address_const::<'OUTSIDER'>()
}

pub fn create_test_world() -> (WorldStorage, IGameActionsDispatcher) {
    let ndef = NamespaceDef {
        namespace: "whoiswho",
        resources: [
            TestResource::Model(m_Game::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Commitment::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Board::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Turn::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GameCreated::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_PlayerJoined::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_CharacterCommitted::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_QuestionAsked::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_QuestionAnswered::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_CharactersEliminated::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GuessMade::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GuessResult::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_CharacterRevealed::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_TimeoutClaimed::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GameCompleted::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Contract(game_actions::TEST_CLASS_HASH.try_into().unwrap()),
        ]
            .span(),
    };

    let cdef: Span<ContractDef> = [
        ContractDefTrait::new(@"whoiswho", @"game_actions")
            .with_writer_of([dojo::utils::bytearray_hash(@"whoiswho")].span()),
    ]
        .span();

    let mut world = spawn_test_world([ndef].span());
    world.sync_perms_and_inits(cdef);

    let (game_actions_addr, _) = world.dns(@"game_actions").unwrap();
    let dispatcher = IGameActionsDispatcher { contract_address: game_actions_addr };

    (world, dispatcher)
}

/// Create a game and have P2 join. Returns game_id.
pub fn setup_game(game_actions: IGameActionsDispatcher) -> felt252 {
    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game();

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.join_game(game_id);

    game_id
}

/// Commit characters for both players. Returns (char_p1, salt_p1, char_p2, salt_p2).
pub fn do_commits(
    game_actions: IGameActionsDispatcher, game_id: felt252,
) -> (felt252, felt252, felt252, felt252) {
    let char_p1: felt252 = 1;
    let salt_p1: felt252 = 101;
    let char_p2: felt252 = 2;
    let salt_p2: felt252 = 202;

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(char_p1, salt_p1));

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.commit_character(game_id, core::pedersen::pedersen(char_p2, salt_p2));

    (char_p1, salt_p1, char_p2, salt_p2)
}

/// Run one full Q&A + elimination cycle starting from P1 asking.
/// After this call the turn flips to P2.
pub fn do_qa_cycle_p1_asks(game_actions: IGameActionsDispatcher, game_id: felt252) {
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.answer_question(game_id, true);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.eliminate_characters(game_id, 0xFF);
}

/// Run one full Q&A + elimination cycle starting from P2 asking.
/// After this call the turn flips to P1.
pub fn do_qa_cycle_p2_asks(game_actions: IGameActionsDispatcher, game_id: felt252) {
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.ask_question(game_id, 2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.answer_question(game_id, false);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.eliminate_characters(game_id, 0xF0);
}
