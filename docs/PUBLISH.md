# Publish Latch

This publishes the interface for the existing contract. The site uses Mezo Testnet even when Vercel calls its hosting environment Production.

## Deploy from your Mac

```sh
cd ~/Desktop/latch/latch-local
node scripts/build-public.cjs
npx vercel --prod
```

Accept installation of Vercel CLI if npm asks. Complete browser sign-in. Choose your Vercel account/team, set up this directory, choose not to link an existing project unless you already created Latch, and name the project `latch-credit`. The code directory is `./`. Do not select the unrelated Drift project. If the name is unavailable, use another name such as `latch-mezo`.

Keep the checked-in configuration: framework Other, dependency installation skipped, build command `node scripts/build-public.cjs`, output `public-app`. No environment variables or private keys are required.

Open the Production URL in an incognito window. If visitors are asked to log into Vercel, adjust the project's Deployment Protection settings to allow public access to the production deployment.

## GitHub

Open https://github.com/new. Create a public repository named `latch-credit`. Leave the initialization options unchecked because the local folder already contains a README.

```sh
cd ~/Desktop/latch/latch-local
git init
git add README.md .gitignore .vercelignore vercel.json package.json package-lock.json contracts config scripts dist docs
git commit -m "Ship Latch with verified Mezo loan cycle"
git branch -M main
git remote -v
```

If there is no origin remote, add the repository URL shown by GitHub. For the `theeagle2407` account:

```sh
git remote add origin https://github.com/theeagle2407/latch-credit.git
git push -u origin main
```

If origin already exists, inspect its URL before proceeding. If the remote has commits that block the push, inspect that history; do not force-push. Use your existing Git credential manager or GitHub authentication flow. Never commit credentials.

## Verify the hosted release

- Site opens without a hosting login.
- Wallet connection selects the correct account and Mezo network.
- Borrower sees NFT #1705 if still owned, and Loan #1 as Repaid.
- Lender sees Loan #1 as Repaid.
- Explorer links use explorer.test.mezo.org.
- Old localhost transaction rows do not automatically move: each origin has its own browser storage. On-chain loan history still loads.
- Add the final hosted URL to README after publishing.

Once hosted, the website stays available independently of your Mac. Visitors do not deploy a contract.
