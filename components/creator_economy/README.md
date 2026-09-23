# Creator economy foundation

Owner: the creator-browser fork. This directory contains a local, dependency-free
accounting and interaction prototype. It is not wired into Brave or a deployed
Solana program.

- `prototype/economics.mjs`: integer quotes, fee allocation and pool transitions.
- `prototype/bootstrap.mjs`: creator-scoped setup and action idempotency model.
- `prototype/model.test.mjs`: conservation, rounding and retry tests.
- `prototype/index.html`: responsive creator dashboard inspired by stacsol.app.
- [Design and integration contract](../../docs/creator_economy.md).

From this directory, with Node 22 or newer:

```sh
node --test prototype/model.test.mjs
node prototype/serve.mjs
```

Open `http://127.0.0.1:4179`. The demo uses fictional creators and local state;
refreshing resets it. It does not load credentials, call Privy, sign transactions,
or contact an RPC. The same calculation module runs in the browser and tests.

Only the three 6.9% starting fee rates are chosen product defaults. The demo's
90% fee burn, 5% temporary setup recovery, 10% fee ceiling, and setup cost are
illustrations, not finalized protocol parameters. Amounts use nine decimals.
