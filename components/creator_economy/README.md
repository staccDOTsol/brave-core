# Creator browser

The creator surface is part of Brave Wallet at `brave://wallet/creators`.
The wallet root opens it. Desktop navigation, Android wallet panel and setup,
and iOS wallet panel and setup link to the same bundled WebUI. It does not
require creating or unlocking a self-custody seed wallet to follow creators.

The screen saves creator profiles and content curations in this browser profile
and shows the mint fee allocation. It does not represent local bookmarks as
verified ownership, reward entitlements, or financial positions. Custodial
sign-in, pool initialization, verified claims, funded quotes and payouts remain
to be integrated. No controller or new browser binary is deployed by this patch.

## Source

- `../brave_wallet_ui/page/screens/creators`: actual wallet screen and stories.
- `../brave_wallet_ui/common/creator-economy`: validated local creator library.
- `common/mint-fees.ts`: mint allocation used by the wallet and accounting model.
- `common/economics.mjs`: integer pool accounting and fee settlement model.
- `common/bootstrap.mjs`: setup and intent idempotency model.
- [Wizards settlement service](server/settlement/README.md): server-side Privy
  signer, verified deployer SOL receipts, Relay routing and fanout delivery ledger.
- `../brave_rewards/resources/creator_detection`: existing detector plus explicit
  creator-context bridge. Native automatic detection still needs a consumer.
- [Protocol and integration contract](../../docs/creator_economy.md).

## Mint referral policy

Of a 6.9% mint fee, 50% is allocated to a PDA-controlled referral token account.
That allocation is split equally between deployer and creator. Each entitlement
is 25% of the mint fee (1.725% of gross pool shares before rounding and payout
costs). Claim status changes withdrawal authority, not the creator allocation.
The other half remains available to the burn/curation policy. Its exact split
is not finalized. Redemption and transfer fees have no referral allocation here.

100% of the deployer's realized SOL allocation is designated for the Wizards
fanout on Robinhood Chain, after routing costs. The settlement worker accepts
only verified payouts from a dedicated deployer distributor. The upstream
controller, LST conversion and funded browser actions still need integration.

## Verification

With Node 24.16 or newer, from the repository root:

```sh
node --test "components/creator_economy/common/*.test.mjs" "components/creator_economy/ci/*.test.mjs"
python3 components/creator_economy/ci/check-resources.py
cd components/creator_economy/server/settlement
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

The GitHub workflow runs accounting, retry, identity and library tests on Linux,
macOS and Windows; checks TypeScript models and UI syntax; validates resources;
and parses changed Swift files on macOS. These checks do not replace native
compilation or on-device testing. `creator-native-build.yml` supports a
`preflight_only` dispatch to measure a runner before downloading Chromium.
It requires the documented 100 GB disk / 8 GB RAM minimum, compares raw bytes,
limits parallelism, and saves a diagnostic record even when preflight fails.
A passing capacity check is not a successful build. See the remote build section
in the integration contract for measured runner limits. The standalone demo
server has been retired.
