/// Maximum seconds a player may be inactive before their opponent can claim a timeout win.
pub const ACTION_TIMEOUT_SECONDS: u64 = 45;

// ---------------------------------------------------------------------------
// Game phases — stored as `u8` in `Game.phase`.
// Transitions always follow a strict linear order driven by `game_actions`.
// ---------------------------------------------------------------------------

/// Waiting for a second player to call `join_game`.
pub const PHASE_WAITING_FOR_PLAYER2: u8 = 0;
/// Both players must call `commit_character` before gameplay begins.
pub const PHASE_COMMIT_PHASE: u8 = 1;
/// P1 selects a question (or makes a final guess).
pub const PHASE_P1_QUESTION_SELECT: u8 = 2;
/// P2 must answer the question P1 just asked.
pub const PHASE_P2_ANSWER_PENDING: u8 = 3;
/// P1 may now eliminate characters from their board based on P2's answer.
pub const PHASE_P1_ELIMINATING: u8 = 4;
/// P2 selects a question (or makes a final guess).
pub const PHASE_P2_QUESTION_SELECT: u8 = 5;
/// P1 must answer the question P2 just asked.
pub const PHASE_P1_ANSWER_PENDING: u8 = 6;
/// P2 may now eliminate characters from their board based on P1's answer.
pub const PHASE_P2_ELIMINATING: u8 = 7;
/// One player has called `make_guess`; unused in current flow (reserved for future split-guess UX).
pub const PHASE_GUESS_ATTEMPT: u8 = 8;
/// Both players must call `reveal_character` to verify the commit and determine the winner.
pub const PHASE_REVEAL_PHASE: u8 = 9;
/// Game over — `Game.winner` holds the winning address.
pub const PHASE_COMPLETED: u8 = 10;

// ---------------------------------------------------------------------------
// Turn action types — stored in `Turn.action_type`.
// ---------------------------------------------------------------------------

/// The turn record represents a question asked by the active player.
pub const ACTION_TYPE_QUESTION: u8 = 0;
/// The turn record represents a final guess by the active player.
pub const ACTION_TYPE_GUESS: u8 = 1;
