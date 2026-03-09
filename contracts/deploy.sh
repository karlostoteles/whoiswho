#!/bin/bash

# GuessNFT Contract Deployment Script
# Usage: ./deploy.sh [network] [nft_contract_address]
#
# Examples:
#   ./deploy.sh sepolia 0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa
#   ./deploy.sh mainnet 0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           GuessNFT Contract Deployment Script              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Parse arguments
NETWORK=${1:-"sepolia"}
NFT_CONTRACT=${2:-""}

# Set RPC URLs based on network
if [ "$NETWORK" = "mainnet" ]; then
    RPC_URL="https://starknet-mainnet.public.blastapi.io"
    NETWORK_ID="SN_MAIN"
    echo -e "${YELLOW}Network: Starknet Mainnet${NC}"
else
    RPC_URL="https://starknet-sepolia.public.blastapi.io"
    NETWORK_ID="SN_SEPOLIA"
    echo -e "${YELLOW}Network: Starknet Sepolia Testnet${NC}"
fi

# Default SCHIZODIO NFT contract
DEFAULT_NFT="0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa"

if [ -z "$NFT_CONTRACT" ]; then
    echo -e "${YELLOW}No NFT contract provided, using SCHIZODIO: $DEFAULT_NFT${NC}"
    NFT_CONTRACT=$DEFAULT_NFT
fi

# Check if scarb is installed
if ! command -v scarb &> /dev/null; then
    echo -e "${RED}Error: scarb is not installed.${NC}"
    echo "Install from: https://docs.swmansion.com/scarb/"
    exit 1
fi

# Check if starkli is installed
if ! command -v starkli &> /dev/null; then
    echo -e "${RED}Error: starkli is not installed.${NC}"
    echo "Install from: https://book.starkli.rs/"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 1: Building contract...${NC}"
scarb build

CONTRACT_CLASS_FILE="target/dev/guessnft_GuessNFT.contract_class.json"

if [ ! -f "$CONTRACT_CLASS_FILE" ]; then
    echo -e "${RED}Error: Contract class file not found at $CONTRACT_CLASS_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Contract built successfully${NC}"

echo ""
echo -e "${BLUE}Step 2: Declaring contract class...${NC}"
echo -e "RPC: $RPC_URL"

# Check if already declared
DECLARE_OUTPUT=$(starkli declare "$CONTRACT_CLASS_FILE" --rpc "$RPC_URL" 2>&1 || true)

if echo "$DECLARE_OUTPUT" | grep -q "Already declared"; then
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | head -1)
    echo -e "${YELLOW}⚠ Contract already declared${NC}"
    echo -e "Class hash: $CLASS_HASH"
else
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | tail -1)
    echo -e "${GREEN}✓ Contract declared${NC}"
    echo -e "Class hash: $CLASS_HASH"
fi

echo ""
echo -e "${BLUE}Step 3: Deploying contract...${NC}"
echo -e "Constructor arg (NFT contract): $NFT_CONTRACT"

DEPLOY_OUTPUT=$(starkli deploy "$CLASS_HASH" "$NFT_CONTRACT" --rpc "$RPC_URL" 2>&1 || true)

if echo "$DEPLOY_OUTPUT" | grep -q "Already deployed"; then
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | head -1)
    echo -e "${YELLOW}⚠ Contract already deployed${NC}"
else
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | tail -1)
    echo -e "${GREEN}✓ Contract deployed${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}               Deployment Complete!                         ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Network:        ${GREEN}$NETWORK ($NETWORK_ID)${NC}"
echo -e "Class Hash:     ${GREEN}$CLASS_HASH${NC}"
echo -e "Contract Addr:  ${GREEN}$CONTRACT_ADDRESS${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Add the contract address to your config:"
echo ""
echo "   // src/services/starknet/config.ts"
echo "   export const GAME_CONTRACT = '$CONTRACT_ADDRESS';"
echo ""
echo "2. Update session policies to include the new contract"
echo ""
echo "3. Verify on explorer:"
if [ "$NETWORK" = "mainnet" ]; then
    echo "   https://starkscan.co/contract/$CONTRACT_ADDRESS"
else
    echo "   https://sepolia.starkscan.co/contract/$CONTRACT_ADDRESS"
fi
echo ""
