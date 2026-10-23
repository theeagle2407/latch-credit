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

The initial LatchCredit at 0x3e59009e7b6ad6d6a556010f6ec3f16681952499 on chain 31611 used a different veBTC collection. Subsequent ownership checks found NFT #1705 in the builder wallet on the current collection 0x38E35d92E6Bfc6787272A62345856B13eA12130a. Its normal escrow type, owner, 0.001 BTC lock amount and non-permanent lock were confirmed by RPC. The initial Latch nextId was 1. Version 5 requires a corrected deployment with the current NFT address and verifies the creation hash, deployer and token getters before activation.

The corrected deployment is confirmed at 0xf65dd90ffe34da7f5e12938a174b8bcaf46b67bd. Version 6 pins it directly after successful receipt, exact creation-data hash and immutable getter checks. The earlier local receipt-import failure did not indicate a failed onchain deployment. The downloaded file was not available for inspection, so its precise failure cause was not established. Validation now distinguishes unavailable RPC data, reverted transactions, non-deployment transactions and mismatched receipt addresses.

## Integration boundary

Voting and reward forwarding are not implemented. This is a material part of Latch's proposed differentiation and must be verified before presenting the full product as working. Real veBTC fork tests, transfer behavior, current deployment identity, patched implementation identity, reentrancy adversarial tests, and deployment review remain outstanding. A forced ERC721 `transferFrom` outside the request flow can strand an NFT; only the approved request flow should be used. There is deliberately no administrator rescue route.

The local UI invokes the deployed contract through wallet-approved transactions and reads real positions. It supports requests, funding, cancellation, repayment, default claims, NFT claims and lender withdrawals. An end-to-end real veBTC loan on Mezo remains to be exercised. This is a testnet implementation.

## Sources inspected

- Mezo official pool/governance deployments: https://mezo.org/docs/developers/features/mezo-pools
- Official testnet network configuration: https://testnet.mezo.org/docs/users/getting-started/connect
- MUSD addresses: https://testnet.mezo.org/docs/users/resources/contracts-reference
- Mezo VotingEscrow source: https://github.com/mezo-org/tigris/tree/0a3b5e840ac8e187cc705fbeddcf00f88b09247e/solidity/contracts
- Incident report and patched meta-transaction behavior: https://mezo.org/blog/incident-report-october-5-2026/

Sources initially reviewed October 22, 2026. RPC checks on October 23 confirmed configured deployed code, token metadata, contract constructor targets and the successful Latch deployment.
