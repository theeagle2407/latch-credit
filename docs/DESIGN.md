# Latch interface refresh · v7

Warm ivory navigation, an ink-indigo collateral surface, soft lavender supporting cards, stronger numeric hierarchy, and quieter transaction details. The compact side drawer keeps financial actions in context. Positions become stacked cards on narrow screens. Motion respects reduced-motion preferences.

Research references:
- https://21st.dev/community/components/explore/react-cards
- https://21st.dev/community/components/explore/card-react
- https://preview.21st.dev/@uiable
- https://mercury.com/
- https://ramp.com/

These informed visual direction; no third-party component source was copied. The implementation uses the existing vanilla HTML/CSS/JavaScript application, with no new runtime dependency. The deployed contract and transaction rules are unchanged.

Validation: DOM and local-chain integration checks cover wallet/network switching, real mock NFT escrow, lender funding and balance refresh. Desktop (1440px) and mobile (390px) browser renders were inspected using a local visual fixture; those fixture balances are not shipped. Native wallet extension signing remains on the user's Mac.

Install by extracting this archive over latch-local after backing up the folder. Restart the local server and hard-refresh the browser. No redeployment or dependency reinstall is required.
