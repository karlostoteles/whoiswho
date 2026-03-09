use guessnft::{IGuessNFTDispatcher, IGuessNFTDispatcherTrait, GuessNFT::Game};
use starknet::{ContractAddress, declare, deploy};
use array::ArrayTrait;
use option::OptionTrait;

/// Deploy the GuessNFT contract for testing
fn deploy_contract(nft_contract: ContractAddress) -> IGuessNFTDispatcher {
    let calldata = array![nft_contract];
    let class_hash = declare("GuessNFT").unwrap();
    let deployed_address = deploy(class_hash, calldata.span()).unwrap();
    IGuessNFTDispatcher { contract_address: deployed_address }
}

/// Generate a mock contract address for testing
fn mock_address(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

#[test]
fn test_constructor_deploys_successfully() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    assert(dispatcher.contract_address != 0_felt252.try_into().unwrap(), 'deploy failed');
}

#[test]
fn test_create_game() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    let game = dispatcher.get_game(game_id);
    assert(game.player1 == player1, 'player1 mismatch');
    assert(game.player2 == player2, 'player2 mismatch');
    assert(game.p1_commitment == 0, 'p1 commitment not zero');
    assert(game.p2_commitment == 0, 'p2 commitment not zero');
}

#[test]
fn test_commit_character_player1() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    let commitment = 0x123456789;
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    starknet::testing::prank(player1);
    dispatcher.commit_character(game_id, commitment);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_commitment == commitment, 'commitment mismatch');
    assert(game.p2_commitment == 0, 'p2 should be zero');
}

#[test]
fn test_commit_character_player2() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    let commitment = 0x987654321;
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    starknet::testing::prank(player2);
    dispatcher.commit_character(game_id, commitment);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_commitment == 0, 'p1 should be zero');
    assert(game.p2_commitment == commitment, 'commitment mismatch');
}

#[test]
fn test_both_players_commit() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    let p1_commitment = 0x111;
    let p2_commitment = 0x222;
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    starknet::testing::prank(player1);
    dispatcher.commit_character(game_id, p1_commitment);
    
    starknet::testing::prank(player2);
    dispatcher.commit_character(game_id, p2_commitment);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_commitment == p1_commitment, 'p1 mismatch');
    assert(game.p2_commitment == p2_commitment, 'p2 mismatch');
}

#[test]
fn test_get_commitment() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    let commitment = 0xDEADBEEF;
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    starknet::testing::prank(player1);
    dispatcher.commit_character(game_id, commitment);
    
    let stored = dispatcher.get_commitment(game_id, player1);
    assert(stored == commitment, 'commitment mismatch');
    
    let p2_stored = dispatcher.get_commitment(game_id, player2);
    assert(p2_stored == 0, 'p2 should be zero');
}

#[test]
fn test_reveal_character_valid() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    let character_id = 0x42;
    let salt = 0x1234;
    
    // pedersen_hash(0x42, 0x1234) = some value we compute
    let commitment = core::pedersen_hash(character_id, salt);
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    starknet::testing::prank(player1);
    dispatcher.commit_character(game_id, commitment);
    
    // Reveal with correct character_id and salt
    starknet::testing::prank(player1);
    dispatcher.reveal_character(game_id, character_id, salt);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_revealed_char == character_id, 'reveal failed');
}

#[test]
fn test_reveal_character_both_players() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    
    let p1_char = 0x42;
    let p1_salt = 0x1111;
    let p1_commitment = core::pedersen_hash(p1_char, p1_salt);
    
    let p2_char = 0x99;
    let p2_salt = 0x2222;
    let p2_commitment = core::pedersen_hash(p2_char, p2_salt);
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    starknet::testing::prank(player1);
    dispatcher.commit_character(game_id, p1_commitment);
    
    starknet::testing::prank(player2);
    dispatcher.commit_character(game_id, p2_commitment);
    
    // Both reveal
    starknet::testing::prank(player1);
    dispatcher.reveal_character(game_id, p1_char, p1_salt);
    
    starknet::testing::prank(player2);
    dispatcher.reveal_character(game_id, p2_char, p2_salt);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_revealed_char == p1_char, 'p1 reveal wrong');
    assert(game.p2_revealed_char == p2_char, 'p2 reveal wrong');
}

#[test]
fn test_multiple_games_independent() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let player3 = mock_address(0x111);
    let player4 = mock_address(0x222);
    
    // Create game 1
    starknet::testing::prank(player1);
    dispatcher.create_game(1, player2);
    starknet::testing::prank(player1);
    dispatcher.commit_character(1, 0x111);
    
    // Create game 2
    starknet::testing::prank(player3);
    dispatcher.create_game(2, player4);
    starknet::testing::prank(player3);
    dispatcher.commit_character(2, 0x222);
    
    // Verify games are independent
    let game1 = dispatcher.get_game(1);
    let game2 = dispatcher.get_game(2);
    
    assert(game1.player1 == player1, 'game1 player1 wrong');
    assert(game1.p1_commitment == 0x111, 'game1 commitment wrong');
    assert(game2.player1 == player3, 'game2 player1 wrong');
    assert(game2.p1_commitment == 0x222, 'game2 commitment wrong');
}

#[test]
fn test_get_commitment_non_player_returns_zero() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let non_player = mock_address(0x999);
    let game_id = 1;
    
    starknet::testing::prank(player1);
    dispatcher.create_game(game_id, player2);
    
    let commitment = dispatcher.get_commitment(game_id, non_player);
    assert(commitment == 0, 'should return zero');
}
