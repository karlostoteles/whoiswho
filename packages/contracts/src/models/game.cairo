use starknet::ContractAddress;

/// Core game session state. One record per game, keyed by `game_id`.
///
/// Phase transitions are linear and enforced by `game_actions`:
///   WaitingForPlayer2 → CommitPhase → P1QuestionSelect ↔ P2QuestionSelect → RevealPhase → Completed
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Game {
    /// Unique game identifier (derived from `world.uuid()`).
    #[key]
    pub game_id: felt252,
    /// Address of the player who created the game.
    pub player1: ContractAddress,
    /// Address of the player who joined (zero until `join_game` is called).
    pub player2: ContractAddress,
    /// Current game phase — see `constants::PHASE_*`.
    pub phase: u8,
    /// Which player must act next: `1` = player1, `2` = player2.
    pub current_turn: u8,
    /// Total number of turns played (incremented on `ask_question` and `make_guess`).
    pub turn_count: u16,
    /// Address of the winner (zero until the game is completed).
    pub winner: ContractAddress,
    /// NFT collection address that defines the character set. Both players use the same ordering.
    pub collection_id: felt252,
    /// Seconds of inactivity before the inactive player can be timed out.
    pub timeout_seconds: u64,
    /// Block timestamp when the game was created.
    pub created_at: u64,
    /// Block timestamp of the last state-changing action — used for timeout checks.
    pub last_action_at: u64,
    /// ID of the most recent question asked (echoed for client convenience).
    pub last_question_id: u16,
    /// Answer to the most recent question (echoed for client convenience).
    pub last_answer: bool,
    /// Character ID that the active player guessed in `make_guess` — verified during reveal.
    pub guess_character_id: felt252,
    /// Poseidon2 BN254 Merkle root of the character collection — stored as u256 because BN254
    /// outputs may exceed the Stark field prime (~16% of outputs). Never recomputed on-chain.
    pub traits_root: u256,
    /// Which question schema this game uses (0 = SCHIZODIO v1).
    pub question_set_id: u8,
}

/// Commit-reveal record for a single player in a game.
///
/// The commitment scheme: player computes `hash = pedersen(character_id, salt)` client-side
/// and submits only the hash on-chain. After the guess is made, both players reveal
/// `(character_id, salt)`. The contract re-hashes and checks against the stored value,
/// preventing either player from changing their character after seeing the guess.
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Commitment {
    /// Game this commitment belongs to.
    #[key]
    pub game_id: felt252,
    /// Player who made this commitment.
    #[key]
    pub player: ContractAddress,
    /// `pedersen(character_id, salt)` — zero means no commitment yet.
    /// Used in the reveal phase to verify the character choice.
    pub hash: felt252,
    /// Poseidon2 BN254 commitment: hash4(game_id, player, character_id, salt).
    /// Used in ZK proof verification. Separate from `hash` — different scheme, different purpose.
    pub zk_commitment: u256,
    /// True after the player successfully calls `reveal_character`.
    pub revealed: bool,
    /// Set to the revealed `character_id` after a successful reveal (zero before reveal).
    pub character_id: felt252,
}

/// Per-player elimination state. One record per (game, player).
///
/// `eliminated_bitmap` is a bitfield where bit `i` = 1 means character at index `i`
/// has been eliminated from this player's board. New eliminations are OR-merged into the
/// existing bitmap so clients cannot accidentally un-eliminate characters.
///
/// Note: `u128` supports up to 128 characters. Phase 1 standardizes on this limit.
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Board {
    #[key]
    pub game_id: felt252,
    #[key]
    pub player: ContractAddress,
    /// OR-accumulating bitfield of eliminated character indices.
    pub eliminated_bitmap: u128,
    /// Remaining non-eliminated characters (informational; not enforced by contract).
    pub remaining_count: u16,
}

/// Immutable record of a single turn action (question or final guess).
///
/// Written once per turn by `ask_question` (action_type = QUESTION) or
/// `make_guess` (action_type = GUESS). The answer is filled in by `answer_question`.
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Turn {
    #[key]
    pub game_id: felt252,
    /// 1-based turn counter within this game.
    #[key]
    pub turn_number: u16,
    /// `ACTION_TYPE_QUESTION` or `ACTION_TYPE_GUESS` — see `constants`.
    pub action_type: u8,
    /// Question template ID chosen by the asker.
    pub question_id: u16,
    /// Answer provided by the responding player (false for guess turns).
    pub answer: bool,
    /// Player who asked the question or made the guess.
    pub asked_by: ContractAddress,
    /// Player who answered (zero for guess turns or before answer is submitted).
    pub answered_by: ContractAddress,
    /// Character ID guessed (zero for question turns).
    pub guessed_character_id: felt252,
    /// Block timestamp of the last write to this record.
    pub action_timestamp: u64,
    /// True if the answer was verified by a ZK proof via `answer_question_with_proof`.
    pub proof_verified: bool,
}
