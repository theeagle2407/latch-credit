# Publish the interface

The interface serves the existing Mezo Testnet deployment. Vercel's production hosting environment does not change the blockchain network.

## Build and publish

From the repository root:

```sh
npm run build
npx vercel --prod
```

For an existing Vercel project, retain its link. For a new project, choose a lowercase name such as `latch-credit` and use the repository root as its directory.

The checked-in Vercel configuration uses framework Other, skips dependency installation, builds with `node scripts/build-public.cjs`, and serves `public-app`. No server process, environment variables or private keys are required.

The build includes nine product assets and excludes developer deployment pages and payloads. Source documentation is maintained in GitHub, not served as part of the app.

## Verify the release

- Open the public URL without a hosting login.
- Connect an installed wallet and confirm the requested Mezo network.
- Check actual positions and loans for the connected account.
- Confirm explorer links use `explorer.test.mezo.org`.
- Confirm `dist/network.json` still points to the intended lending contract.

Browser transaction rows are stored per origin and do not move from localhost to the hosted app. Loan state is read from the chain. Hosting remains available independently of the developer's local machine.
