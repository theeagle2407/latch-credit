# Wallet-approved deployment

Version 6 already pins the corrected deployment at 0xf65dd90ffe34da7f5e12938a174b8bcaf46b67bd, transaction 0xe8986547642643c56b553cb0af37681ca01f80a811fe3f46daaa86a5fd0e4a04. Do not deploy again or import a receipt to use v6. The instructions below describe the earlier developer setup flow.

Version 5 corrects the immutable collateral collection to 0x38E35d92E6Bfc6787272A62345856B13eA12130a. The earlier deployment used another collection that also reports the name veBTC. Use the v5 prepared payload. The deployment page stores transaction hashes per collection, so the old successful transaction does not block this correction. Download latch-deployment-v5.json after confirmation and run `node scripts/activate-deployment.cjs ~/Downloads/latch-deployment-v5.json` to save the selection in the app config. Activation rejects receipts whose creation data does not match the prepared deployment.

This setup deploys LatchCredit on Mezo Testnet (31611) through an installed EVM wallet. It never asks for a private key. The deployment wallet is 0xB37b46F58cd7E384DbD051332EB0c6e110E3Ed7C.

1. Run `node scripts/prepare-deploy.cjs` in the project root. This compiles the existing contract with optimization and the London EVM target recommended in Mezo's getting-started guide. Token addresses come from config/mezo-testnet.json.
2. Start the local app: `PORT=3001 npm start`.
3. Open http://localhost:3001/deploy.html. This developer setup page is separate from the product.
4. Connect the specified wallet. Approve switching to Mezo Testnet if prompted. The page checks token code and estimates gas. Approve deployment only after reviewing the wallet's fee.
5. Click Check submitted transaction until it confirms. Download the receipt and retain the contract address and transaction hash.

The deployment transaction sends zero BTC as value; only the network fee is charged. It does not approve or transfer tokens or collateral. Refreshing preserves a submitted transaction hash in this browser to reduce accidental duplicate deployments. If a submitted deployment reverts, retain the hash for investigation rather than clearing it and retrying blindly.

After confirmation the main interface still needs integration with the new contract. Deployment does not automatically enable live lending or replace sample positions. Local contract tests are not an independent audit. Use this on testnet only.
