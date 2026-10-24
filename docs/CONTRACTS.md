# Latch credit: first implementation

## Implemented

An immutable fixed-term loan contract accepts a normal, non-permanent veBTC NFT into escrow. The borrower specifies principal, fixed interest, duration, and request expiry. A lender funds the principal with MUSD. Repayment credits the lender and gives the borrower an NFT claim. After maturity plus a one-day grace period, the lender can claim default. Cancelled or expired unfunded requests return the NFT claim to the borrower.

Settlement and delivery are separate. The borrower claims the NFT to an address of their choice; the lender withdraws repaid MUSD. Receiver errors cannot prevent debt settlement. All lifecycle mutations are protected by OpenZeppelin ReentrancyGuard; token transfers use SafeERC20. There is no administrator, upgrade entry point, arbitrary execution, or ability to withdraw underlying BTC.

## Eligibility and timing

Normal escrow type is enum value 0 in the inspected Mezo interface. Reject managed, attached, permanent, empty, and insufficient-duration positions. The lock must extend through the latest possible funding time, loan duration, and grace period. At funding, eligibility is checked again. The repayment deadline is measured from funding, not request creation. Repayment is allowed through the final second of grace; default starts after grace.

## Financial model

The lender provides existing MUSD. Latch does not mint MUSD, open a Mezo trove, or supply a guaranteed borrowing rate. Interest is an agreed absolute amount, paid in full even on early repayment. There is no oracle, automated LTV cap, partial repayment, liquidation auction, or protocol fee in this version. The UI accepts borrower-selected principal and fixed interest; it does not invent a valuation or underwriting limit.

## Verification

Run `npm ci`, then `npm test` and `npm run test:client`. The runners compile Solidity targeting London and exercise an in-process local EVM using mock MUSD and mock veBTC. The mocks implement the ABI shape but do not establish full real Mezo compatibility. The actual deployment succeeded on Mezo Testnet with London-targeted bytecode.

The active Mezo Testnet deployment is `0xf65dd90ffe34da7f5e12938a174b8bcaf46b67bd`, configured with MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` and veBTC `0x38E35d92E6Bfc6787272A62345856B13eA12130a`. The public app points directly to this contract; visitors do not deploy a contract.

Loan #1 completed request, funding, repayment, collateral claim and lender withdrawal on Mezo Testnet. It used NFT #1705, representing 0.001 BTC, for a 1 MUSD principal, zero fixed interest and a seven-day term, repaid early. Both wallets were controlled by the builder. Transaction links are in the README. This establishes an exercised integration path, not independent adoption or profitable lending.

At the recorded verification, the loan was Repaid, the NFT was back with the borrower, its loan and claimant mappings were cleared, and the lender had withdrawn repayment. Live default recovery has not been demonstrated; default timing was tested locally with mocks.

## Integration boundary

Voting and reward forwarding are not implemented. Do not claim that escrow preserves a borrower's governance access or reward delivery. Real veBTC fork tests, transfer behavior, current deployment identity, patched implementation identity, reentrancy adversarial tests, and deployment review remain outstanding. A forced ERC721 `transferFrom` outside the request flow can strand an NFT; only the approved request flow should be used. There is deliberately no administrator rescue route.

The local UI invokes the deployed contract through wallet-approved transactions and reads real positions. It supports requests, funding, cancellation, repayment, default claims, NFT claims and lender withdrawals. The repayment lifecycle has been exercised with the deployed veBTC collection as described above. This remains an unaudited testnet implementation.

## Sources inspected

- Mezo official pool/governance deployments: https://mezo.org/docs/developers/features/mezo-pools
- Official testnet network configuration: https://testnet.mezo.org/docs/users/getting-started/connect
- MUSD addresses: https://testnet.mezo.org/docs/users/resources/contracts-reference
- Mezo VotingEscrow source: https://github.com/mezo-org/tigris/tree/0a3b5e840ac8e187cc705fbeddcf00f88b09247e/solidity/contracts
- Incident report and patched meta-transaction behavior: https://mezo.org/blog/incident-report-october-5-2026/

Sources initially reviewed October 22, 2026. RPC checks on October 23 confirmed configured deployed code, token metadata, contract constructor targets and the successful Latch deployment.
