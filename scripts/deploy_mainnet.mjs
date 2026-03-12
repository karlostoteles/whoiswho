import { Account, RpcProvider, json, num } from 'starknet';
import fs from 'fs';
import path from 'path';

// Starknet configuration
const RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet";
const KEYSTORE_PATH = "/Users/carlosdelafiguera/.starkli-wallets/guessnft_mainnet/keystore.json";
const ACCOUNT_PATH = "/Users/carlosdelafiguera/.starkli-wallets/guessnft_mainnet/account.json";
const PASSWORD = "guessnft123";
const NFT_CONTRACT = "0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa";

// Avnu Paymaster configuration
const AVNU_PAYMASTER_URL = "https://starknet-mainnet.avnu.fi/paymaster/v1/call";

async function main() {
    console.log("🚀 Starting Sponsored Mainnet Deployment via Avnu Paymaster...");

    const provider = new RpcProvider({ nodeUrl: RPC_URL });

    // Load Keystore and Account
    const keystore = JSON.parse(fs.readFileSync(KEYSTORE_PATH, 'utf8'));
    const accountConfig = JSON.parse(fs.readFileSync(ACCOUNT_PATH, 'utf8'));
    const accountAddress = accountConfig.variant.address || "0x041054baf4269e0603e4162144e18becec3ac58f89641f813f0099793576c00c";

    console.log(`Checking account status for ${accountAddress}...`);
    
    // For deployment, we need to handle the case where the account itself is undeployed.
    // However, sponsored account deployment is tricky without a specific API key for the paymaster.
    
    // Artifact paths
    const contractPath = "/Users/carlosdelafiguera/Desktop/projects/guessNFT/contracts/target/dev/guessnft_GuessNFT.contract_class.json";
    const casmPath = "/Users/carlosdelafiguera/Desktop/projects/guessNFT/contracts/target/dev/guessnft_GuessNFT.compiled_contract_class.json";

    if (!fs.existsSync(contractPath) || !fs.existsSync(casmPath)) {
        console.error("❌ Contract artifacts not found in target/dev/. Run 'scarb build' first.");
        return;
    }

    console.log("✅ Contract artifacts found.");

    // We proceed with the plan to use StarkZap for the sponsored flow if we can initialize it with a private key.
    // Since we don't have the raw private key here (it's in the keystore), we'll ask the user to provide it 
    // or to run a command that we prepare.

    console.log("\n--- DEPLOYMENT COMMANDS (Using sncast with specific flags if supported, else custom script) ---");
    console.log("To use Avnu Paymaster, you might need to use their CLI or a tool that supports it.");
    
    console.log("\nIf you have the Avnu CLI installed:");
    console.log("avnu paymaster sponsor --url " + AVNU_PAYMASTER_URL + " ...");

    console.log("\n[ACTION REQUIRED] I need to know if you have an Avnu API Key.");
    console.log("If not, I will try to use the public endpoint but it might fail without sponsorship authorization.");
}

main().catch(console.error);
