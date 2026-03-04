/// Public interface for the WhoisWho game contract.
///
/// All state-changing functions take a `game_id` to identify the session.
/// Turn order and phase validity are enforced on-chain; invalid calls revert.
#[starknet::interface]
pub trait IGameActions<T> {
    /// Creates a new game. Caller becomes player1.
    /// Returns the new `game_id` (derived from `world.uuid()`).
    fn create_game(ref self: T) -> felt252;

    /// Joins an existing game as player2. Caller must not be player1.
    /// Advances phase from `WAITING_FOR_PLAYER2` to `COMMIT_PHASE`.
    fn join_game(ref self: T, game_id: felt252);

    /// Records a commitment hash for the caller.
    /// `commitment_hash` must be `pedersen(character_id, salt)` with a non-zero salt.
    /// When both players have committed, phase advances to `P1_QUESTION_SELECT`.
    fn commit_character(ref self: T, game_id: felt252, commitment_hash: felt252);

    /// Active player asks a question identified by `question_id`.
    /// Advances phase to the opposing player's `ANSWER_PENDING` state.
    fn ask_question(ref self: T, game_id: felt252, question_id: u8);

    /// Non-active player answers the pending question with `true` (yes) or `false` (no).
    /// Advances phase to the active player's `ELIMINATING` state.
    fn answer_question(ref self: T, game_id: felt252, answer: bool);

    /// Active player OR-merges `eliminated_bitmap` into their Board and passes the turn.
    /// Sending zero is a no-op (does not reset previously eliminated characters).
    fn eliminate_characters(ref self: T, game_id: felt252, eliminated_bitmap: u128);

    /// Active player makes their final character guess.
    /// Advances phase to `REVEAL_PHASE`; winner determined after both players reveal.
    fn make_guess(ref self: T, game_id: felt252, character_id: felt252);

    /// Verifies `pedersen(character_id, salt) == stored_commitment` and records the reveal.
    /// When both players have revealed, the contract resolves the winner and completes the game.
    fn reveal_character(ref self: T, game_id: felt252, character_id: felt252, salt: felt252);

    /// Claims a win by timeout if the opponent has been inactive for at least
    /// `ACTION_TIMEOUT_SECONDS`. Only the non-active player (or player1 for abandoned games) may call.
    fn claim_timeout(ref self: T, game_id: felt252);
}
