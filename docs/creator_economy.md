# Creator economy: first funded interaction

Status: interaction and accounting prototype, September 23, 2026. Native wallet
integration, deployed controller, identity verification and payment services
remain implementation work. The prototype does not submit transactions.

## Product decisions

- Desktop, Android and iOS share the protocol and identity model.
- Use the [stacsol.app dashboard](https://stacsol.app/app) as the v1 interaction
  reference: backing, supply, SOL per token, mint/redeem and personal position.
  eat.ag is secondary inspiration for v2.
- Each creator has a namespace, a distinct Sanctum single-validator pool and a
  Token-2022 receipt mint. Multiple creator pools may select the same validator.
- Mint/deposit, redemption and transfer fees each start at **690 basis points**.
  A verified creator may change the three rates within protocol bounds.
- Most collected fee shares are burned; a separate portion funds curation of
  individual content items. The exact split and rate ceilings are undecided.
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

The demo uses a **1 SOL illustrative sponsor advance**. While recovery is due,
its illustrative allocation is 90% burn, 5% recovery and 5% curation. After
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
transfer and referral split. The prototype assumes no third-party referral
diversion and illustrates the final settled transition, not every CPI.

For backing `A`, outstanding shares `S`, mint input `d`:

```text
gross shares g = floor(d × S / A)        (initial issue rate handled separately)
fee shares f = ceil(g × mint_bps / 10_000)
user receives g − f
fee f = burn b + setup recovery r + curator budget c
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
digest and controller program ID. The prototype uses logical keys, not real
PDAs. Public metadata alone does not prove ownership, original authorship or
endorsement. Claims require the appropriate OAuth/provider proof or domain
challenge, with explicit conflict resolution for recycled handles.

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

| Surface | Existing integration point | Planned change |
| --- | --- | --- |
| Shared detection | `components/brave_rewards/resources/creator_detection` | Stable creator/content adapter and explicit support event |
| Shared wallet | `components/brave_wallet` | Creator service contract, quotes, intent status, custodial account mode |
| Desktop | Wallet WebUI resources and browser service | Creator panel and position view |
| Android | `android/java/org/chromium/chrome/browser/crypto_wallet` | Native creator sheet backed by shared service |
| iOS | `ios/brave-ios/Sources/BraveWallet` | Equivalent SwiftUI flow and service adapter |

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

The [prototype README](../components/creator_economy/README.md) has run commands.
The foundation workflow runs the same accounting and bootstrap tests on Linux,
macOS and Windows, then publishes a runnable prototype artifact. It does not
initialize Chromium.

`creator-native-build.yml` is a manual GitHub Actions build recipe for Linux,
Android arm64, macOS, iOS simulator and Windows. Supply a provisioned runner
label with the appropriate OS, toolchain, at least 120 GiB free disk and 16 GiB
RAM. The preflight checks these before downloading Chromium. macOS/iOS require
the supported Xcode installation; Windows requires the Chromium-supported
Visual Studio toolchain. The workflow has not yet compiled a native product.

Use [Brave's build instructions](https://github.com/brave/brave-core#clone-and-initialize)
and [iOS instructions](https://github.com/brave/brave-browser/wiki/iOS-Development-Environment)
for runner provisioning. Persistent remote workspaces/caches should be added to
those runners after a successful baseline build. Do not cache credentials or
assume a container can supply an Apple toolchain. Native jobs save build records
and logs; distributable packaging, signing and store publication are subsequent
milestones. No native compilation runs on the user's computer.

Remaining decisions: validator vote account/policy, fee ceilings and split,
setup sponsor budget and recovery terms, creator claim proofs, curator reward
rules, controller governance, and native runner provisioning. Production work
also needs deployed-pool compatibility tests, backend/Privy implementation,
on-chain controller implementation and integration into all three client types.
