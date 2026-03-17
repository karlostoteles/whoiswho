/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Starknet Mainnet chain ID
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// Game Contracts (Mainnet ZK World) — Dojo game_actions contract
// Must match GAME_CONTRACT in src/zk/config.ts
export const GAME_CONTRACT_NORMAL = '0x4d5c92ee4168c532d756e5e4f13a89990e94eb400d6a38108e64ebb5a1487fc';
export const GAME_CONTRACT_SCHIZO = '0x4d5c92ee4168c532d756e5e4f13a89990e94eb400d6a38108e64ebb5a1487fc';

// Methods required for game interaction (ZK Engine)
const GAME_METHODS = [
  'create_game',
  'join_game',
  'commit_character',
  'ask_question',
  'answer_question_with_proof',
  'make_guess',
  'reveal_character',
  'claim_timeout',
];

// Structural policies required by @cartridge/controller
export const SESSION_POLICIES = {
    contracts: {
        [GAME_CONTRACT_NORMAL]: {
            name: "Who Is Who",
            description: "On-chain ZK game actions",
            methods: GAME_METHODS.map(m => ({
                name: m.replace(/_/g, ' '),
                entrypoint: m
            }))
        }
    }
};
