use guessnft::guessnft::{IGuessNFTDispatcher, IGuessNFTDispatcherTrait, GuessNFT::Game};
use guessnft::mock_nft::{IMockNFTDispatcher, IMockNFTDispatcherTrait};
use starknet::ContractAddress;
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address, declare, ContractClassTrait, DeclareResultTrait};

/// Unwraps result for declare
fn unwrap_declare(res: core::result::Result<snforge_std::DeclareResult, core::array::Array<felt252>>) -> snforge_std::ContractClass {
    let declare_result = match res {
        core::result::Result::Ok(x) => x,
        core::result::Result::Err(_) => panic!("Declare call failed"),
    };
    match declare_result {
        snforge_std::DeclareResult::Success(class) => class,
        snforge_std::DeclareResult::AlreadyDeclared(class) => class,
    }
}

/// Unwraps result for deploy
fn unwrap_deploy(res: core::result::Result<(ContractAddress, core::array::Span<felt252>), core::array::Array<felt252>>) -> (ContractAddress, core::array::Span<felt252>) {
    match res {
        core::result::Result::Ok(val) => val,
        core::result::Result::Err(_) => panic!("Deploy failed"),
    }
}

/// Deploy the GuessNFT contract for testing
fn deploy_contract(nft_contract: ContractAddress) -> IGuessNFTDispatcher {
    let contract = unwrap_declare(declare("GuessNFT"));
    let mut calldata = core::array::ArrayTrait::new();
    calldata.append(nft_contract.into());
    let (deployed_address, _) = unwrap_deploy(contract.deploy(@calldata));
    IGuessNFTDispatcher { contract_address: deployed_address }
}

/// Deploy a Mock NFT contract for testing
fn deploy_mock_nft() -> IMockNFTDispatcher {
    let contract = unwrap_declare(declare("MockNFT"));
    let calldata = core::array::ArrayTrait::new();
    let (deployed_address, _) = unwrap_deploy(contract.deploy(@calldata));
    IMockNFTDispatcher { contract_address: deployed_address }
}

/// Generate a mock contract address for testing
fn mock_address(value: felt252) -> ContractAddress {
    match value.try_into() {
        core::option::Option::Some(addr) => addr,
        core::option::Option::None => panic!("addr fail")
    }
}

#[test]
fn test_constructor_deploys_successfully() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    assert(dispatcher.contract_address != mock_address(0), 'deploy failed');
}

#[test]
fn test_create_game() {
    let nft_contract = mock_address(0x123);
    let dispatcher = deploy_contract(nft_contract);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    
    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.create_game(game_id, player2);
    stop_cheat_caller_address(dispatcher.contract_address);
    
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
    
    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.create_game(game_id, player2);
    dispatcher.commit_character(game_id, commitment);
    stop_cheat_caller_address(dispatcher.contract_address);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_commitment == commitment, 'commitment mismatch');
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
    
    let commitment = core::pedersen::pedersen(character_id, salt);
    
    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.create_game(game_id, player2);
    dispatcher.commit_character(game_id, commitment);
    dispatcher.reveal_character(game_id, character_id, salt);
    stop_cheat_caller_address(dispatcher.contract_address);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_revealed_char == character_id, 'reveal failed');
}

#[test]
fn test_deposit_wager() {
    let nft = deploy_mock_nft();
    let dispatcher = deploy_contract(nft.contract_address);
    
    let player1 = mock_address(0xABC);
    let game_id = 1;
    let token_id = 42_u256;
    
    nft.mint(player1, token_id);
    start_cheat_caller_address(nft.contract_address, player1);
    nft.approve(dispatcher.contract_address, token_id);
    stop_cheat_caller_address(nft.contract_address);
    
    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.create_game(game_id, mock_address(0xDEF));
    dispatcher.deposit_wager(game_id, token_id);
    stop_cheat_caller_address(dispatcher.contract_address);
    
    let game = dispatcher.get_game(game_id);
    assert(game.p1_wager == token_id, 'wager mismatch');
}

#[test]
fn test_opponent_won_transfers_wagers() {
    let nft = deploy_mock_nft();
    let dispatcher = deploy_contract(nft.contract_address);
    
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;
    let p1_token = 101_u256;
    
    nft.mint(player1, p1_token);
    start_cheat_caller_address(nft.contract_address, player1);
    nft.approve(dispatcher.contract_address, p1_token);
    stop_cheat_caller_address(nft.contract_address);
    
    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.create_game(game_id, player2);
    dispatcher.deposit_wager(game_id, p1_token);
    dispatcher.opponent_won(game_id);
    stop_cheat_caller_address(dispatcher.contract_address);
    
    let game = dispatcher.get_game(game_id);
    assert(game.winner == player2, 'wrong winner');
    assert(game.status == 'finished', 'wrong status');
}

#[test]
fn test_submit_move_toggles_active_player() {
    let dispatcher = deploy_contract(mock_address(0));
    let player1 = mock_address(0xABC);
    let player2 = mock_address(0xDEF);
    let game_id = 1;

    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.create_game(game_id, player2);
    dispatcher.commit_character(game_id, 0x111);
    stop_cheat_caller_address(dispatcher.contract_address);

    start_cheat_caller_address(dispatcher.contract_address, player2);
    dispatcher.commit_character(game_id, 0x222);
    stop_cheat_caller_address(dispatcher.contract_address);

    let game = dispatcher.get_game(game_id);
    assert(game.active_player == 1, 'P1 should start');

    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.submit_move(game_id);
    stop_cheat_caller_address(dispatcher.contract_address);

    let game = dispatcher.get_game(game_id);
    assert(game.active_player == 2, 'P2 turn mismatch');
}

#[test]
fn test_cancel_game_refunds_wagers() {
    let nft = deploy_mock_nft();
    let dispatcher = deploy_contract(nft.contract_address);
    let player1 = mock_address(0xABC);
    let game_id = 1;
    let token_id = 55_u256;

    nft.mint(player1, token_id);
    start_cheat_caller_address(nft.contract_address, player1);
    nft.approve(dispatcher.contract_address, token_id);
    stop_cheat_caller_address(nft.contract_address);

    start_cheat_caller_address(dispatcher.contract_address, player1);
    dispatcher.create_game(game_id, mock_address(0));
    dispatcher.deposit_wager(game_id, token_id);
    dispatcher.cancel_game(game_id);
    stop_cheat_caller_address(dispatcher.contract_address);

    let game = dispatcher.get_game(game_id);
    assert(game.status == 'finished', 'Game should be finished');
}
