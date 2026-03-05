/// Game not found (player1 address is zero — uuid was never written).
pub const ERR_GAME_NOT_FOUND: felt252 = 'GAME_NOT_FOUND';
/// The current game phase does not allow the requested action.
pub const ERR_INVALID_PHASE: felt252 = 'INVALID_PHASE';
/// Caller is not player1 or player2 of this game.
pub const ERR_NOT_PLAYER: felt252 = 'NOT_PLAYER';
/// Caller is not the active player for this action.
pub const ERR_NOT_YOUR_TURN: felt252 = 'NOT_YOUR_TURN';
/// A second player has already joined; the game is full.
pub const ERR_ALREADY_JOINED: felt252 = 'ALREADY_JOINED';
/// Caller already submitted a commitment for this game.
pub const ERR_ALREADY_COMMITTED: felt252 = 'ALREADY_COMMITTED';
/// Caller has no commitment stored — must call `commit_character` first.
pub const ERR_NO_COMMITMENT: felt252 = 'NO_COMMITMENT';
/// Caller already revealed their character in this game.
pub const ERR_ALREADY_REVEALED: felt252 = 'ALREADY_REVEALED';
/// `claim_timeout` called before `ACTION_TIMEOUT_SECONDS` has elapsed.
pub const ERR_TIMEOUT_NOT_REACHED: felt252 = 'TIMEOUT_NOT_REACHED';
/// Active player cannot claim timeout against themselves.
pub const ERR_CALLER_NOT_ELIGIBLE: felt252 = 'CALLER_NOT_ELIGIBLE';
/// Turn record not found for the given turn number.
pub const ERR_TURN_NOT_FOUND: felt252 = 'TURN_NOT_FOUND';
/// Reveal failed: `pedersen(character_id, salt)` does not match the stored commitment,
/// or salt is zero.
pub const ERR_INVALID_REVEAL: felt252 = 'INVALID_REVEAL';
/// Commitment hash is zero — invalid; use `pedersen(character_id, salt)` with non-zero salt.
pub const ERR_INVALID_COMMITMENT: felt252 = 'INVALID_COMMITMENT';

// ---------------------------------------------------------------------------
// ZK proof errors
// ---------------------------------------------------------------------------

/// `full_proof_with_hints` array does not contain the expected number of public input fields.
pub const ERR_INVALID_PROOF_INPUTS: felt252 = 'Invalid proof inputs length';
/// The `game_id` encoded in the proof public inputs does not match the on-chain game.
pub const ERR_PROOF_GAME_MISMATCH: felt252 = 'Proof game_id mismatch';
/// The `turn_id` in the proof does not match the current `game.turn_count` (replay attack).
pub const ERR_PROOF_TURN_MISMATCH: felt252 = 'Proof turn_id mismatch';
/// The `player` address in the proof does not match the caller.
pub const ERR_PROOF_PLAYER_MISMATCH: felt252 = 'Proof player mismatch';
/// The `question_id` in the proof does not match `game.last_question_id`.
pub const ERR_PROOF_QUESTION_MISMATCH: felt252 = 'Proof question_id mismatch';
/// The `traits_root` in the proof does not match `game.traits_root`.
pub const ERR_PROOF_TRAITS_ROOT_MISMATCH: felt252 = 'Proof traits_root mismatch';
/// The `commitment` in the proof does not match the stored `commitment.zk_commitment`.
pub const ERR_PROOF_COMMITMENT_MISMATCH: felt252 = 'Proof commitment mismatch';
/// The Garaga verifier rejected the proof.
pub const ERR_PROOF_VERIFICATION_FAILED: felt252 = 'ZK proof verification failed';
/// The Garaga verifier contract address is zero — not deployed yet.
pub const ERR_VERIFIER_NOT_DEPLOYED: felt252 = 'Verifier not deployed';
