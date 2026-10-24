# Latch

**Short-term MUSD credit against the Bitcoin you have already locked.**

Latch lets owners of eligible veBTC positions request fixed-term loans funded by another wallet. The NFT enters escrow; a lender supplies existing MUSD; repayment returns the right to claim the NFT to its owner.

Built on Mezo Testnet. A complete two-wallet loan cycle has been executed with Mezo's deployed MUSD token and veBTC collection.

## Why Latch

Owners who have already locked BTC cannot use that same BTC as ordinary liquid collateral. Latch accepts the transferable position NFT, subject to eligibility and a lock horizon covering the funding window, loan term and grace period.

Borrowers choose principal, fixed interest and duration. Lenders review requests individually. Funding is not guaranteed. Latch does not mint MUSD or set an automatic credit limit.

## Verified loan cycle

On October 23, 2026, Loan #1 used veBTC #1705, representing 0.001 BTC, for a 1 MUSD loan at zero interest with a seven-day term. It was repaid early using two separate wallets controlled by the builder. This is an integration test, not evidence of independent customer demand.

| Step | On-chain evidence |
| --- | --- |
| Request and escrow | [Request](https://explorer.test.mezo.org/tx/0xe407fbbdddffbaf43d91c468b8a29cd0d98421e55ba61f51e1170935112d2637) |
| Lender funds borrower | [Funding](https://explorer.test.mezo.org/tx/0xab16a01501b2dd46d544cf39c0f2740285679fda0d78caba5a42ff6ded936428) |
| Borrower repays | [Repayment](https://explorer.test.mezo.org/tx/0x20cf917014d8c2f714cf2b7caca9a941fd08fc78d7a706969e37ad19312f916d) |
| Borrower claims NFT | [Collateral claim](https://explorer.test.mezo.org/tx/0x4b09e55660ff79b5427747a31a1c6ed89573b670ddfbd4fcf9591ea44d7f9b7a) |
| Lender withdraws repayment | [Withdrawal](https://explorer.test.mezo.org/tx/0x323bb79a8b59f56f68c329b152633309470be5ec765689fbec84986a1e8f50fc) |

Final state was independently read through Mezo RPC: Loan #1 Repaid, NFT #1705 owned by the borrower, positionLoan and collateralClaimant cleared, lender repaymentBalance zero, and lender MUSD balance restored to 1,800. These are observations at verification time, not a live balance feed.

## Run locally

Node 22 or newer. No dependency installation is required to run the bundled interface.

```sh
PORT=3001 npm start
```

Open http://localhost:3001. Keep the Terminal open. Stop with Control+C. If the port is busy, use `PORT=3002 npm start` and the corresponding URL.

## Use Latch

1. Connect an installed EVM wallet and switch to Mezo Testnet when prompted.
2. Select an eligible veBTC NFT; choose principal, fixed interest and term.
3. Approve the individual NFT and submit the escrow request.
4. A different wallet reviews the request in Credit market, approves the exact MUSD principal and funds it.
5. The borrower approves and repays principal plus interest, then claims the NFT separately.
6. The lender withdraws repayment from Activity.

The UI uses a 24-hour funding window. The repayment term begins when funded, followed by a one-day grace period. Unfunded requests can be cancelled, creating a borrower NFT claim. After grace, only the lender can claim default and become entitled to claim the NFT.

## Mezo integration

| Contract | Mezo Testnet address |
| --- | --- |
| LatchCredit | `0xf65dd90ffe34da7f5e12938a174b8bcaf46b67bd` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| veBTC | `0x38E35d92E6Bfc6787272A62345856B13eA12130a` |

Chain ID **31611**. RPC: `https://rpc.test.mezo.org`. Gas: BTC.

[Deployment transaction](https://explorer.test.mezo.org/tx/0xe8986547642643c56b553cb0af37681ca01f80a811fe3f46daaa86a5fd0e4a04). The app already points to this deployment. Visitors never deploy a contract.

The client reads actual ownership, lock amounts, expiration, escrow type and loan state. Enumeration supports Mezo's ownerToNFTokenIdList with an enumerable fallback. The contract rejects managed or permanent positions, empty locks and insufficient lock horizons. Both request and funding check eligibility.

## Architecture

- `contracts/LatchCredit.sol`: immutable token integration, escrow, funding, repayment and claims. No admin or upgrade mechanism.
- `dist/chain.js`: chain reads, integer amounts, signer checks, scoped approvals and transaction preflight.
- `dist/wallet.js`: EIP-6963 wallet discovery, account changes and network switching.
- `dist/app.js`: Positions, Credit market and Activity. Actual transaction hashes are stored in the browser.
- `dist/refined.css`: responsive interface and reduced-motion support.
- `scripts/build-public.cjs`: dependency-free preparation of the public static app.

Separate NFT delivery and repayment withdrawal prevent receiver failures from blocking settlement. Token operations use OpenZeppelin SafeERC20 and ReentrancyGuard. These protections do not constitute an audit.

## Validation

```sh
npm ci
npm test
npm run test:client
npm run check:network
```

The local suites include 13 contract checks and eight client integration groups with mock tokens. They cover authorization, eligibility, escrow, self-funding rejection, exact approvals, failed repayment, settlement, claims, withdrawal and default timing. Additional DOM checks exercise wallet switching, requests, lender funding and state clearing. Desktop and mobile visual fixtures were inspected. The live repayment cycle is linked above; default recovery has been tested locally, not demonstrated on the live deployment.

Ganache may warn about its optional native uWS binary and fall back to JavaScript. A previously reported dependency audit contained 39 findings; those development dependencies have not been remediated. Public hosting skips installing them and serves the bundled interface. Ethers' license is under `dist/vendor`.

## Hosting

```sh
node scripts/build-public.cjs
npx vercel --prod
```

The checked-in configuration serves `public-app`. No environment variables, server process or private keys are required. See [publishing instructions](docs/PUBLISH.md).

## Limits and lender economics

There is no price oracle, LTV enforcement, guaranteed liquidity, partial repayment, protocol fee, mobile QR wallet connection or production audit. Lenders bear BTC price risk, MUSD risk, contract risk and the delay before locked BTC can be withdrawn. Default recovery is the NFT, not an immediate BTC payment. Voting restrictions may affect withdrawal.

Latch provides no voting or reward forwarding while an NFT is escrowed. Fixed interest is paid in full on early repayment. A zero-interest integration test does not validate lender profitability. Production work requires independent security review, lender pricing research and explicit treatment of governance and reward rights.

See [contract behavior](docs/CONTRACTS.md).
