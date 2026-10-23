# Latch walkthrough

Target: about two minutes. Record the actual app and verified explorer links. Repeating the live flow needs a fresh loan and wallet approvals. Do not present visual fixtures as live transactions.

| Time | Screen | Point |
| --- | --- | --- |
| 0:00–0:20 | Positions | Existing locked BTC position and the liquidity problem |
| 0:20–0:45 | Request and review | Principal, fixed interest, term and lock horizon |
| 0:45–1:10 | Second wallet, Credit market | Lender supplies existing MUSD |
| 1:10–1:35 | Repayment and collateral claim | Debt settled; NFT returned |
| 1:35–1:50 | Lender Activity | Repayment withdrawn; explorer evidence |
| 1:50–2:00 | Positions | Scope and next development step |

## Voiceover

Bitcoin can stay locked while its owner needs liquidity. Latch lets owners of eligible veBTC positions request short-term MUSD loans against the position NFT they already hold.

Here is a position on Mezo. The app reads its owner, locked BTC and unlock date directly from the chain. The borrower chooses the loan amount, fixed interest and duration. Latch checks that the lock covers the funding window, repayment term and grace period.

Submitting places the NFT in escrow. The request then appears in the credit market. A separate lender reviews the terms, approves MUSD and funds the borrower. Latch transfers existing MUSD; it does not mint new tokens.

The borrower can repay early. Repayment settles the debt and creates a claim for the NFT. The borrower claims their position, and the lender withdraws the repayment.

We completed this entire cycle on Mezo Testnet using the deployed MUSD token and veBTC collection. Every step has an explorer link in the repository.

Lenders choose which requests to fund and bear collateral and recovery risk. In default, they can claim the NFT after grace, while Bitcoin withdrawal still depends on the underlying lock. This version has no price oracle or voting and reward forwarding.

Latch gives an existing locked Bitcoin position another use: access to negotiated, fixed-term MUSD credit.

## Submission description

Latch is a lender-funded credit market for eligible veBTC positions on Mezo. Borrowers escrow their existing position NFT and request MUSD on fixed terms. A separate lender supplies MUSD; repayment returns the NFT claim to the borrower, while default after grace lets the lender claim the collateral. The app validates ownership, position type and lock duration, uses scoped approvals, and links transactions to the explorer. A complete two-wallet request, funding, repayment, collateral return and lender withdrawal cycle has been executed on Mezo Testnet. The current release is experimental and has no price oracle, automated LTV limits, voting/reward forwarding or production audit.
