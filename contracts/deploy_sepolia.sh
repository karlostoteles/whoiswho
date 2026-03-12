#!/bin/bash
# Helper script to deploy GuessNFT to Sepolia using existing whoiswho_deployer account

set -e

# Configuration
RPC_URL="https://starknet-sepolia.public.blastapi.io"
ACCOUNT_FILE="/Users/carlosdelafiguera/.starknet_accounts/starknet_open_zeppelin_accounts.json"
ACCOUNT_NAME="whoiswho_deployer"
NFT_CONTRACT="0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa"

echo "Building contract..."
scarb build

CONTRACT_CLASS_FILE="target/dev/guessnft_GuessNFT.contract_class.json"

echo "Declaring contract class..."
# Note: This might require the user to provide the password for the account if it's encrypted
starkli declare "$CONTRACT_CLASS_FILE" \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT_FILE" \
    --name "$ACCOUNT_NAME"

# Get Class Hash (Mocked for script guidance, starkli will output it)
echo "Contract declared! Now deploy using the class hash from above:"
echo "starkli deploy <CLASS_HASH> $NFT_CONTRACT --rpc $RPC_URL --account $ACCOUNT_FILE --name $ACCOUNT_NAME"
