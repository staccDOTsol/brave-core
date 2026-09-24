// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { PrivyClient } from '@privy-io/node'
import { configuration, POLICY } from './policy.mjs'
import { Ledger, json } from './ledger.mjs'
import { Chains } from './chains.mjs'
import { tick } from './worker.mjs'

function privyClient() {
  const read = key => {
    assert(process.env[key], `${key} must name a local credential file`)
    return fs.readFileSync(process.env[key], 'utf8').trim()
  }
  return new PrivyClient({ appId: read('PRIVY_APP_ID_FILE'),
    appSecret: read('PRIVY_APP_SECRET_FILE'), maxRetries: 0, timeout: 25_000 })
}

async function initialize(file) {
  assert(file && !fs.existsSync(file), 'Choose a new configuration file')
  const p = privyClient()
  const wallets = {}
  for (const [chain, label] of [
    ['solana', 'faircreators-wizards-sol-v1'],
    ['ethereum', 'faircreators-wizards-evm-v1'],
  ]) {
    const page = await p.wallets().list({ external_id: label })
    assert(page.data.length <= 1)
    const wallet = page.data[0] ?? await p.wallets().create({ chain_type: chain,
      display_name: label, external_id: label, idempotency_key: label })
    assert.equal(wallet.chain_type, chain)
    wallets[chain] = { id: wallet.id, address: wallet.address }
  }
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, json({
    solTreasury: wallets.solana.address, solWalletId: wallets.solana.id,
    evmReceiver: wallets.ethereum.address, evmWalletId: wallets.ethereum.id,
    feeDistributor: null,
    solRpc: 'https://api.mainnet-beta.solana.com',
    evmRpc: 'https://rpc.mainnet.chain.robinhood.com',
    database: path.join(path.dirname(path.resolve(file)), 'wizards.sqlite'),
  }) + '\n', { mode: 0o600, flag: 'wx' })
  console.log(json({ config: file, wallets,
    status: 'empty-wallets-created; configure deployer-only feeDistributor before activation' }))
}

async function main() {
  const [command, file, argument] = process.argv.slice(2)
  if (command === 'init-wallets') return initialize(file)
  assert(['status', 'quote', 'credit', 'run-once', 'run'].includes(command),
    'Usage: cli.mjs init-wallets|status|quote|credit|run-once|run CONFIG [LAMPORTS|SIGNATURE]')
  const c = configuration(JSON.parse(fs.readFileSync(file, 'utf8')),
    { requireDistributor: command !== 'quote' })
  if (command === 'quote') {
    const chains = new Chains(c, null)
    await chains.preflight()
    const { q, checked } = await chains.quote(argument)
    return console.log(json({ signed: false, inputLamports: argument,
      expectedWeth: q.details.currencyOut.amount, minimumWeth: checked.minimumWeth,
      receiver: c.evmReceiver, finalFanout: POLICY.fanout }))
  }
  assert(path.isAbsolute(c.database), 'Database path must be absolute')
  fs.mkdirSync(path.dirname(c.database), { recursive: true, mode: 0o700 })
  const execute = ['run-once', 'run'].includes(command)
  if (execute) assert.equal(process.env.FAIRCREATORS_SETTLEMENT_EXECUTE, '1',
    'Set FAIRCREATORS_SETTLEMENT_EXECUTE=1 to activate signing and broadcast')
  if (process.env.PRIVY_AUTHORIZATION_KEY_FILE) {
    // Configuration is immutable; keys are injected separately, never persisted.
    throw new Error('Configure a service-owned wallet for this v1 runner')
  }
  const chains = new Chains(c, execute ? privyClient() : null)
  const ledger = new Ledger(c.database, c)
  fs.chmodSync(c.database, 0o600)
  try {
    if (command === 'status') return console.log(json(ledger.summary()))
    await chains.preflight(execute)
    if (command === 'credit') {
      for (const receipt of await chains.payout(argument)) ledger.credit(receipt)
      return console.log(json(ledger.summary()))
    }
    do {
      try {
        // Each state commits before the next external action. Stop once awaiting
        // confirmation, funds, or operator reconciliation.
        for (let n = 0; n < 6; n++) {
          const before = ledger.active()?.stage
          const result = await tick(ledger, chains, c)
          console.log(json(result))
          const after = ledger.active()?.stage
          if (after === before || !after || after === 'review') break
        }
      } catch (e) {
        // SDK exceptions can embed request bodies. Emit a category, not secrets
        // or raw signed transactions, in unattended process logs.
        if (command === 'run-once') throw e
        console.error(json({ status: 'retry-held', type: e.constructor.name,
          http: e.status ?? null, batch: ledger.active()?.id }))
      }
      if (command !== 'run') break
      await setTimeout(30_000)
    } while (true)
  } finally { ledger.close() }
}

main().catch(e => {
  console.error(json({ error: e instanceof assert.AssertionError ? e.message
    : e.constructor.name, http: e.status ?? null }))
  process.exitCode = 1
})
