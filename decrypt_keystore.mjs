import { wallet } from 'starknet';
import fs from 'fs';

const KEYSTORE_PATH = "/Users/carlosdelafiguera/.starkli-wallets/guessnft_mainnet/keystore.json";
const PASSWORD = "guessnft123";

async function main() {
    try {
        const keystore = JSON.parse(fs.readFileSync(KEYSTORE_PATH, 'utf8'));
        const privateKey = await wallet.decryptKeystoreJson(JSON.stringify(keystore), PASSWORD);
        console.log(`PRIVATE_KEY=${privateKey}`);
    } catch (e) {
        console.error("Failed to decrypt keystore:", e);
    }
}

main();
