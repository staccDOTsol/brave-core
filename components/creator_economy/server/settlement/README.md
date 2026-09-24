# Wizards deployer settlement

This separate Node service routes **100% of verified deployer SOL proceeds** to
the Wizards fanout on Robinhood Chain. With the current mint allocation, the
deployer receives half of the 50% referral allocation: 25% of the total mint fee,
before integer rounding and payout costs. Creator escrow, curation budgets and
LST backing are not settlement revenue.

```text
deployer-only distributor → Solana treasury → Relay → Robinhood WETH receiver
                                                    → Wizards ERC20 fanout
```

The fanout is pinned to `0x1b88A6c6516FD2918905186F21Bb9F5CaA1a15c8`, chain
4663, with 8,010 shares and collection
`0x7c165Ae6E7BFD939Fee1ACA99Ca5aeDf85c52dD4`. WETH is
`0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`.

The intermediate EVM wallet can receive Relay's native-ETH refund route. The
existing ERC20 fanout has no native-ETH receiver. After verifying a bridge fill,
the worker forwards exactly the received WETH and verifies the fanout receipt.
NFT holders use the existing fanout claim flow; this service does not claim for
them or change the fanout contract.

## Boundary with the creator service

The worker starts **after** the creator accounting/controller service isolates
the deployer fee allocation, converts its LST shares into SOL and pays a
dedicated distributor. That upstream controller, conversion and authenticated
payout integration are not implemented here. Never configure a shared creator
escrow, pool reserve, user wallet or general treasury as `feeDistributor`.

The payout service submits its finalized Solana signature to the `credit`
command. The worker reads the transaction itself and accepts only successful
System Program transfers from the configured distributor into its treasury.
Each signature/instruction pair is credited once. The source account is a trust
boundary: transfer provenance alone cannot prove the earlier mint allocation.
There is no balance sweep, user-supplied credit amount or automatic indexer.
Unrelated deposits, including separately supplied gas, are not credited.

## Installation and empty wallets

Requires Node 24.16 or newer. Run these commands from this directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
export PRIVY_APP_ID_FILE=/absolute/path/to/privy-app-id
export PRIVY_APP_SECRET_FILE=/absolute/path/to/privy-app-secret
node cli.mjs init-wallets /absolute/private/directory/config.json
```

Initialization creates or reuses two app-controlled Privy wallets, using fixed
external IDs and creation idempotency keys. These are service wallets, not user
wallets. The config records wallet IDs and public addresses, with a deliberately
unset `feeDistributor`; it cannot execute until that source is configured.
The SDK reads credentials from the named files. No secret belongs in this
repository, browser bundle, mobile app, CI artifact or config JSON.

The config also specifies `solRpc`, `evmRpc` and an absolute `database` path.
Use durable local storage under a private service directory. SQLite's WAL and
database together are settlement state; use its online backup facility or stop
all writers for a complete backup. Do not run independent database copies
against the same wallets, restore an old snapshot into a live worker, or use the
settlement wallets for other transactions. Wallet ownership and source/fanout
identity are checked before signing; each database pins its treasury and source.

## Read-only quote and activation

```sh
# A quote works before the distributor is configured. It does not sign.
node cli.mjs quote /absolute/private/directory/config.json 1000000000

# Set feeDistributor to the actual deployer-only payout source first.
node cli.mjs credit /absolute/private/directory/config.json FINALIZED_SOLANA_SIGNATURE
node cli.mjs status /absolute/private/directory/config.json

# Requires separately funded SOL and Robinhood ETH gas reserves.
FAIRCREATORS_SETTLEMENT_EXECUTE=1 node cli.mjs run-once /absolute/private/directory/config.json
FAIRCREATORS_SETTLEMENT_EXECUTE=1 node cli.mjs run /absolute/private/directory/config.json
```

`run` is a foreground service loop, not an installed daemon. A process supervisor
must retain this process and persistent ledger on the deployment host. The
default batch range is 0.05–1 SOL; smaller balances wait. The SOL reserve is
0.01 SOL, with a 0.0001 SOL transaction-fee cap. The EVM forwarding gas cap is
0.0001 ETH. Gas must be funded separately; no gas top-up or auto-unwrap is
implemented. Routing costs reduce the WETH received. All verified received WETH
is forwarded; there is no additional application fee.

The default quote permits 50 bps slippage and at most 150 bps difference between
Relay's quoted input/output USD values. Those USD fields are not an independent
price oracle. The implementation pins assets, chains, program/router and refund
recipients; recomputes the Relay order hash; and accepts only the expected native
SOL deposit instruction. It constructs its own transaction, validates the signed
message, and rejects arbitrary instructions, calls and deposit-address routes.
An incompatible API response stops processing rather than broadening the policy.

## Restart, confirmation and reconciliation

State advances through `reserved`, `bridge-prepared`, `bridge-signed`, `funded`,
`forward-prepared`, `forward-signed`, `delivered`. Every signed transaction is
saved **before** broadcast. After ambiguous network errors, the worker checks
the same signature/hash and can rebroadcast only those stored bytes. SQLite
reservations and compare-and-set transitions prevent concurrent workers from
spending the same credit. Destination transaction hashes cannot credit two
batches.

The origin deposit must be finalized. A Relay success response is checked against
the origin signature, chain IDs and an on-chain WETH receipt with at least 12
confirmations and a matching canonical block. The final fanout transfer receives
the same confirmation check. Twelve blocks are a configurable depth check, not
a guarantee of rollup settlement finality.

Refunds, failed transactions and unobserved expired deposits enter `review` and
hold their allocation. A stale unsigned quote or signing error also holds the
current stage. Automatic quote replacement, gas-price replacement, refund
wrapping/re-credit and manual recovery commands are not implemented. Reconcile
both chains and the stored order before changing state; never delete a batch or
re-import a refund as fresh revenue to make an error disappear. The worker does
not silently declare delivery based on API status or wallet balances alone.

The tests use temporary local signers, fake chain adapters and isolated ledgers;
they cover real transaction encoding, quote validation, confirmation depth,
refund holds, concurrency and restart after an ambiguous broadcast. They do not
claim a funded mainnet end-to-end payout has occurred.

References: [Relay Solana integration](https://docs.relay.link/references/api/api_guides/solana),
[Relay quote API](https://docs.relay.link/references/api/get-quote-v2),
[Privy Node setup](https://docs.privy.io/basics/nodeJS-node/setup).
