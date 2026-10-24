# Developer deployment

The public app already uses LatchCredit at `0xf65dd90ffe34da7f5e12938a174b8bcaf46b67bd` on Mezo Testnet (31611). Visitors and interface maintainers do not need a new contract. For hosting changes, follow [PUBLISH.md](PUBLISH.md).

## Reproduce a new deployment

These steps are for developers intentionally deploying a separate contract. Preserve the existing configuration before proceeding. A new contract has separate loan state; deploying it does not migrate existing loans.

1. Run `npm ci` and both test suites.
2. Review `config/mezo-testnet.json` and the immutable MUSD and veBTC addresses.
3. Review the deployer address in `scripts/prepare-deploy.cjs`. The supplied setup is pinned to the original builder wallet; adapt that address for your own deployment.
4. Run `node scripts/prepare-deploy.cjs`. It compiles with optimization and the London EVM target, then writes `dist/deployment.json` and `dist/network.json`. This changes generated configuration; do not publish it unintentionally.
5. Start the local server with `PORT=3001 npm start` and open `http://localhost:3001/deploy.html`.
6. Connect the configured wallet, switch to Mezo Testnet, review the transaction and approve deployment. The transaction sends zero BTC as value but requires BTC for gas. Never enter a private key into the app.
7. After confirmation, download the receipt. Activate it with `node scripts/activate-deployment.cjs /absolute/path/to/receipt.json`. The script validates the deployment before updating the configured address.
8. Run `npm run check:network`, reload the interface and exercise the intended lifecycle before publishing.

The public build excludes the developer deployment page and payload. Local mock tests are not an audit or proof of compatibility with every real veBTC state.
