# Creator economy: first funded interaction

Status: Brave source integration, September 23, 2026. The shared wallet now has
`brave://wallet/creators`, desktop navigation, Android panel/setup links and iOS
panel/setup links. Local following and curation work without seed-wallet setup.
The screen includes the current mint-referral allocation. It does not create
financial positions or claim that a bookmarked profile is verified.

The shared Brave creator-detection scripts expose an explicit
`braveCreatorEconomy.detectContext()` bridge. Native automatic detection, the
custodial backend, verified claims and the on-chain controller remain to be
connected. Native binaries have not yet been built.

## Product decisions

- Desktop, Android and iOS share the protocol and identity model.
- Use the [stacsol.app dashboard](https://stacsol.app/app) as the v1 interaction
  reference: backing, supply, SOL per token, mint/redeem and personal position.
  eat.ag is secondary inspiration for v2.
- Each creator has a namespace, a distinct Sanctum single-validator pool and a
  Token-2022 receipt mint. Multiple creator pools may select the same validator.
- Mint/deposit, redemption and transfer fees each start at **690 basis points**.
  A verified creator may change the three rates within protocol bounds.
- On minting only, Sanctum's referral percentage is **50% of the deposit fee**.
  Half of that referral allocation belongs to the deployer, half to the creator,
  whether claimed or unclaimed. Each receives 25% of the total mint fee before
  rounding and payout costs. The remaining manager allocation funds burns,
  curation and any approved setup recovery.
- Redemption and transfer fees retain their separate burn/curation policy.
  Exact burn/curation splits and rate ceilings are undecided.
- Privy service-controlled Solana wallets support custodial accounts. The
  application operates these wallets; users should see that custody model.
- A creator can be supported before claiming. The first funded interaction
  initializes the necessary accounts and continues the original action.

## First interaction

Recognizing a creator creates a logical namespace reservation. It does not
require eagerly creating an on-chain account, stake pool or wallet for every
identity on the internet. A funded action materializes the reservation.

1. Resolve a stable provider identity and optional content ID. Show the profile
   as unclaimed until ownership is verified.
2. Create a durable intent bound to the authenticated actor, creator, action,
   amount, content attribution, quote version, expiry and minimum net output.
3. Quote the requested action including fees. Estimate actual account rent,
   transaction costs and any required stake funding from the chain.
4. A setup sponsor advances the required SOL. Atomically reserve the sponsor
   budget and acquire the creator's setup record before starting transactions.
5. Initialize the creator controller record, pool, Token-2022 mint, pool reserve,
   validator list, fee accounts and recipient account as required by the chosen
   pool program. Validate all existing accounts on retries.
6. Execute the original action after readiness is proven. Bind the content
   receipt to its actual on-chain result and credit fees only once finalized.
7. Show a single result. The supporter receives their position; the creator
   remains unclaimed. Paying setup never confers creator authority.

Try one transaction when account count, size and compute allow it. Otherwise use
an idempotent sequence under one user intent. An external bundle is atomic only
if the chosen submission service provides that property; do not label a normal
multi-transaction sequence atomic. A crash after submission must reconcile the
signature before resubmitting. Requote if a quote expires or rates change.

Depositing and minting can precede stake activation. Actual delegated, active
stake is a separately observed state. Do not display reserve SOL as already
active on a validator.

### Setup funding proposal

Expected fees can economically fund setup, but account creation requires SOL
before those fee shares exist. Proposed v1: advance setup from a capped sponsor
budget and direct a bounded portion of collected fees into a recovery escrow.
After actual conversion to SOL, net receipts repay that creator's setup advance.
Stop recovery at the funded amount. Excess belongs to the declared fee policy.

Do not count marked LST value as repayment of a SOL liability. Conversion costs,
transfer fees and redemption fees matter. Refundable rent and locked stake
principal are tracked separately from spent network fees; neither is silently
treated as a burned expense. Define who receives reclaimed rent on close-out.

This supports a small first interaction without inventing an upfront fee larger
than the requested amount. If sponsor capacity is exhausted, do not accept an
unfulfillable quote. A fully self-funded alternative needs sufficient up-front
SOL and a disclosed quote allocation. The sponsor design is a proposal, not an
already deployed facility.

The reference tests use a **1 SOL illustrative sponsor advance**. While recovery is due,
the manager fee budget has an illustrative allocation of 90% burn, 5% recovery
and 5% curation. On mints this budget is what remains after the 50% referral
allocation. After
recovery the curation share becomes 10%. These figures are not rent estimates or
approved final economics.

## Pool and controller authorities

Use Sanctum's deployed **SanctumSpl** program
`SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY` with a one-validator policy.
The inspected [source revision](https://github.com/igneous-labs/sanctum-spl-stake-pool/tree/81f7e922a4cad340da8347a2ef244445d0cc3e26)
allows Token-2022 `TransferFeeConfig`. This source inspection is not a deployed
binary match or a completed integration test. Deployment addresses are in
[Sanctum's program directory](https://learn.sanctum.so/docs/for-developers/deployed-programs).

The distinct [SPL Single Pool](https://www.solana-program.com/docs/single-pool)
program is a different primitive: it is canonical per validator and fee-free.
The creator-specific configurable pools here use SanctumSpl, with one validator
enforced by the controller.

| Authority | Holder | Scope |
| --- | --- | --- |
| Pool manager | Creator-controller PDA | Bounded pool fee changes |
| Pool staker | Controller-governed PDA | Enforce approved single validator |
| LST mint authority | Sanctum pool withdraw PDA | Issue only through pool accounting |
| Transfer fee config authority | Controller PDA | Bounded fee schedule |
| Withheld fee withdrawal authority | Settlement PDA | Collect into prescribed fee vault |
| Fee vault token owner | Settlement PDA | Burn, budget rewards, repay setup |
| Creator claim authority | Verified creator/controller record | Request permitted settings |
| Custodial user wallet signer | Privy service authorization | User-authorized transactions |

The pool's required mint authority cannot be replaced by an arbitrary creator
PDA. Creators call the controller, which validates identity and bounds before
signing CPIs. A PDA is not a background worker: keepers submit settlement calls.
Claims never transfer ownership of holder backing or give unrestricted minting.
Upgrade authority and controller governance remain explicit deployment decisions.

## Fee accounting

The [Token-2022 transfer-fee extension](https://solana.com/docs/tokens/extensions/transfer-fees)
withholds tokens at destinations. Collection and burning are separate steps.
The extension does not impose a mint or redemption fee: those use pool fee
settings. Its updated transfer rate becomes effective two epochs later.

The inspected Sanctum `Fee::apply` rounds up. All amounts in the reference model
are integers; the transfer fee also obeys `maximumFee`. User output must be
computed from actual account deltas for real routes, including any fee-account
transfer and referral split. The reference model illustrates the final settled
transition, not every CPI. The native fee display is an illustration in gross
pool shares; it is not a SOL deposit quote or proof of an executed allocation.

### Mint-only referral and creator escrow

Set `sol_referral_fee = 50` (and the stake-deposit referral field to 50 when that
entry path is supported). Sanctum splits the deposit fee and directly mints
referral shares to the supplied `referrer_fee_info` token account. The mint
itself is not a Token-2022 transfer. The account must be for this creator pool's
mint and be controlled by the controller PDA.

The referral percentage is pool state; its destination is supplied per deposit.
The creator deposit route must supply and validate the expected vault. If this
must cover every SOL deposit into the pool, configure the pool's SOL deposit
authority to the controller instead of assuming a client default constrains
other callers. No such controller is deployed by this patch.

Credit half of the referral allocation to the deployer and half to the creator's
stable namespace. An indivisible remaining token base unit goes to the creator.
Unclaimed status never redirects the creator share to the deployer. A verified
claim binds withdrawal authority to the same namespace and existing escrow;
claiming does not require transferring the reserved tokens. Actual payout
transfers or redemptions apply their respective fees and must be quoted net.
The underlying pool mint authority remains the stake-pool withdraw PDA.

The controller must reconcile finalized mint receipts once, isolate liabilities
per creator/mint, and preserve creator credits through claims and fee changes.
Privy wallets sign authorized user actions; they do not replace the on-chain
escrow ledger or proof of creator ownership.

For backing `A`, outstanding shares `S`, mint input `d`:

```text
gross shares g = floor(d × S / A)        (initial issue rate handled separately)
fee shares f = ceil(g × mint_bps / 10_000)
user receives g − f
referral = floor(f × 50 / 100)
deployer = floor(referral / 2)
creator = referral − deployer
manager = f − referral = burn b + setup recovery r + curator budget c
fee f = deployer + creator + b + r + c
new backing = A + d
new supply = S + g − b
```

For redemption of `q` shares:

```text
fee f = ceil(q × redeem_bps / 10_000)
principal shares p = q − f
SOL paid = floor(p × A / S)
new backing = A − SOL paid
new supply = S − p − fee shares burned
```

Principal burned during redemption pays for SOL leaving the pool. Fee-share
burns retain their backing. Burning genuine outstanding claims without removing
backing increases backing per remaining share. That is an accounting effect in
SOL per share, not a claim about USD price or market demand.

Externally burned shares must be reconciled with cached pool-token supply via
the supported pool update path before subsequent pricing. Integration tests
must establish exact instruction order, freshness, account extensions and
reserve availability. Final-holder close-out and donated backing require an
explicit policy; the model rejects ambiguous zero-supply/backing combinations.

A curator payout in the same LST incurs a transfer fee. Show gross entitlement,
withheld amount and net receipt. Internal settlement does not itself create
curation credit or engagement. Fee budgets are denominated per mint; do not add
different creators' tokens together as one token amount.

## Creator identity and content graph

Canonical creator key: `(platform, immutable_provider_id)`. Handles and URLs are
aliases. Canonical content key: `(creator_key, provider_content_id)`. Domain
ownership and individual authorship are separate claims.

Reserve namespaces before funding; derive addresses from a versioned namespace
digest and controller program ID. The reference model uses logical keys, not real
PDAs. Public metadata alone does not prove ownership, original authorship or
endorsement. Claims require the appropriate OAuth/provider proof or domain
challenge, with explicit conflict resolution for recycled handles.

The bridge recognizes the existing YouTube, X/Twitter, Reddit, Vimeo and Twitch
detector formats. Twitch's current detector yields a mutable login name, so its
context has a null namespace until the backend resolves the immutable provider
ID. Detected content-to-creator associations remain unverified until checked by
the service; parsing a video/post URL is not proof of authorship. Navigation
during detection invalidates the result. Ordinary website/domain detection still
needs the native publisher-service adapter and domain claim flow.

Privy supplies wallet execution. A database supplies creator identities, user
accounts, follows, content records, curation events, intent state and accounting.
Content does not need a separate custodial wallet for every URL.

To reward discovery of a particular piece, record a content-specific attribution
receipt with a funded action. An ordinary Token-2022 transfer cannot identify
which post or video deserves credit. Unattributed fees go to a declared
creator-level budget. Eligibility, attribution windows and curator weights are
not chosen yet; rewards must remain within actually collected budgets.

Use a unique finalized `(signature, instruction_index, mint)` event key, a
separate payout-intent key, and atomic budget reservation. Confirm payouts from
actual net deltas. Prevent self-referrals and fabricated traffic from increasing
the finite reward budget. Do not turn passive browsing history into a remote
social graph; transmit explicit support/curation actions.

## Browser integration

Reuse Brave's creator detection and claim concepts; introduce a distinct creator
economy service instead of changing the BAT ledger into SOL accounting.

| Surface | Integration now present | Still required |
| --- | --- | --- |
| Shared detection | Typed creator/content candidate bridge | Native caller and identity resolution |
| Desktop wallet | Root route, navigation, creator/curation library and fee breakdown | Funded positions and authenticated service |
| Android | Native wallet menu and onboarding button open bundled creator route | Device build and funded service flow |
| iOS | SwiftUI panel menu and setup button open bundled creator route | Simulator/device build and funded service flow |

The full wallet is already a shared WebUI in this Brave revision. It is bundled
into the browser through the existing page and panel GN targets. Native menu
links do not load a hosted website or localhost app. Profile bookmarks and
curation candidates are local only; persisted data is revalidated and cannot
supply claimed status or balances.

Existing self-custody keys stay in their existing model. Users enter the new
custodial account flow explicitly. Privy application secrets remain on the
backend, never in browser/mobile bundles or CI artifacts. A read-only Privy
wallet-list request succeeded during discovery; no wallet was created and no
transaction signed. That does not constitute a finished wallet integration.

## Existing permissionless router

[OKX PR #4](https://github.com/okxlabs/Web3-DEX-Router-Solana-V1/pull/4)
adds an adapter for the user's permissionless router and remains open as of this
check. Its historical program is
`9XPcSKi9zHn2eqZGUFEDpPC5PBF1oAu3NhyzTrkoe3h3`.

Mainnet read on September 23, 2026: the program account remains executable, but
ProgramData `97rzqrmMdcbceCnPBcGEqE4pCTeroQQYvxjseyzohPch` no longer exists.
`solana program show` reports the program closed. The finalized
[close transaction](https://explorer.solana.com/tx/BeyY6fQT2iAXjmGPFdEh4WJyACdyjGpL1qtLqoEFQQ8nGr42T96vRRRUFHBjyAtoo97bEYpxPJkSwL5nik53sSc)
at slot 446869005 occurred September 14, 2026, 03:02:45 UTC.

The user chose to defer relaunch. No deployment or live transaction is part of
this change. Router source is recoverable from `solana-liquidity-engine` Git
history and its retained build copy. The working tree has staged removals;
those have not been modified. Integrate a reviewed redeployment by explicit
program version later; do not use the closed ID as a default live route.

## Verification and remote builds

The [component README](../components/creator_economy/README.md) has run commands.
The checks workflow runs accounting, referral, bootstrap, detection, runner
capacity and creator-library tests on Linux, macOS and Windows. It type-checks the pure models,
transpiles the new wallet UI, validates localized resources and parses changed
Swift files. It does not initialize Chromium or assert that the native browser
compiles. Storybook includes empty and populated creator states. The standalone
demo server and its HTML/CSS/JS entry points have been retired.

`creator-native-build.yml` is a manual GitHub Actions build recipe for Linux,
Android arm64, macOS, iOS simulator and Windows. Supply a runner label with the
appropriate OS/toolchain. A `preflight_only` dispatch measures capacity without
initializing Chromium. Run names include platform/configuration/runner, and
preflight failures produce a build record and job summary.

The minimum check uses 100 GB free disk and 8 GB RAM in raw bytes, matching
[Chromium's documented build minimum](https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md).
Passing does not guarantee completion: more than 16 GB RAM is recommended and
large Release builds may need substantially more disk. Initialization uses
`--no-history`; desktop/Android builds disable debug symbols and cap concurrent
jobs by RAM and CPU count. Native toolchain requirements still apply.

The first hosted attempts on September 23, 2026 stopped before compilation.
Linux/Android reported 79 GiB free disk; Apple ARM runners reported 88–89 GiB
and 7 GiB RAM. Windows reported 213 GiB and 15 GiB RAM and was incorrectly
rejected by the original hard 16 GiB threshold. That threshold has been fixed;
insufficient disk/RAM remains an error, not a successful native build.

Use [Brave's build instructions](https://github.com/brave/brave-core#clone-and-initialize)
and [iOS instructions](https://github.com/brave/brave-browser/wiki/iOS-Development-Environment)
for runner provisioning. Persistent remote workspaces/caches should be added to
those runners after a successful baseline build. Do not cache credentials or
assume a container can supply an Apple toolchain. Native jobs save build records
and logs; distributable packaging, signing and store publication are subsequent
milestones. No native compilation runs on the user's computer.

Remaining decisions: validator vote account/policy, fee ceilings and the remaining burn/curation split,
setup sponsor budget and recovery terms, creator claim proofs, curator reward
rules, controller governance, and native runner provisioning. Production work
also needs deployed-pool compatibility tests, backend/Privy implementation,
on-chain controller implementation and funded flows in the three client types.

## FairCreators release packaging

The private `kekloldyormarket/creator-browser-ci` repository runs
`release.yml` against an immutable reviewed source SHA. These jobs use Release
configuration and produce the actual native application, not the prototype or
simulator. The artifact directory includes SHA256SUMS and release-manifest.json.
Missing or empty platform artifacts fail the job.

FairCreators sets `brave_require_services_key=false` while keeping the optimized
Release configuration. It does not provide a Brave services API key; features
requiring that credential remain unavailable. The default upstream official
build still requires a key. This setting only controls the local build check.

| Target | Artifact | Distribution |
| --- | --- | --- |
| iOS arm64 device | IPA | App Store Connect export, Apple Distribution signing |
| Android arm64 | AAB and APK | Persistent upload key; AAB for Play App Signing |
| macOS arm64 | DMG and ZIP | Developer ID signed, notarized and stapled |
| Windows x64 | installer EXE | Website distribution; currently unsigned |
| Linux x64 | DEB and RPM | Website distribution; currently unsigned |

Apple jobs explicitly select Xcode 26.3. Windows installs the Chromium-required
28000 SDK if absent. Signing credentials are imported into temporary job storage,
verified, and removed in an always-run cleanup step; they are not source assets
or release artifacts. iOS uses the FairCreators bundle ID and app group; a
successful archive and export, not merely a credential check, proves provisioning.
The iOS build number includes the workflow run number and attempt.

FairCreators has its own product names, application identifiers, Windows install
registration, and generated native icons. Regenerate the icon renditions from
`components/creator_economy/branding/mark.svg` with `generate-icons.mjs` and Sharp.
macOS release jobs compile a fresh Assets.car with actool before source setup.
Upstream automatic updates are disabled for these distributions. Further in-app
service branding remains separate from native app identity. Store listings,
review approval, and a Windows signing certificate are not produced by compiling.
