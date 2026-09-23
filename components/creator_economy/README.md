# Creator economy foundation

Owner: the creator-browser fork. This directory contains a local, dependency-free
accounting and interaction prototype. Brave's shared detector exposes a creator
context bridge, but the dashboard is not yet a native wallet surface and no
creator controller has been deployed.

- `prototype/economics.mjs`: integer quotes, fee allocation and pool transitions.
- `prototype/bootstrap.mjs`: creator-scoped setup and action idempotency model.
- `prototype/model.test.mjs`: conservation, rounding and retry tests.
- `prototype/creator-context.test.mjs`: tests the shared Brave detection bridge,
  stable identities, unresolved Twitch aliases and content candidates.
- `prototype/index.html`: responsive creator dashboard inspired by stacsol.app.
- [Design and integration contract](../../docs/creator_economy.md).

From this directory, with Node 24.16 or newer:

```sh
node --test prototype/model.test.mjs
node --test prototype/creator-context.test.mjs
node prototype/serve.mjs
```

Open `http://127.0.0.1:4179`. The demo uses fictional creators and local state;
refreshing resets it. It does not load credentials, call Privy, sign transactions,
or contact an RPC. The same calculation module runs in the browser and tests.

Only the three 6.9% starting fee rates are chosen product defaults. The demo's
90% fee burn, 5% temporary setup recovery, 10% fee ceiling, and setup cost are
illustrations, not finalized protocol parameters. Amounts use nine decimals.
