// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js'
import { getOrderId } from '@relay-protocol/settlement-sdk'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { encodeEventTopics, encodeAbiParameters, encodeFunctionData, parseAbi } from 'viem'
import { configuration, POLICY } from './policy.mjs'
import { depositInstruction, quoteRequest, validateQuote } from './relay.mjs'
import { Ledger } from './ledger.mjs'
import { tick } from './worker.mjs'
import { Chains, payoutCredits, receivedWeth } from './chains.mjs'

const signer = Keypair.generate()
const evmSigner = privateKeyToAccount(generatePrivateKey())
const config = configuration({ solTreasury: signer.publicKey.toBase58(),
  feeDistributor: Keypair.generate().publicKey.toBase58(),
  evmReceiver: evmSigner.address, solWalletId: 'test-sol', evmWalletId: 'test-evm',
  solRpc: 'https://example.invalid', evmRpc: 'https://example.invalid' })
const chains = [
  { id: POLICY.originChainId, vmType: 'svm', protocol: { v2: {
    chainId: 'solana', depository: POLICY.depository } } },
  { id: POLICY.destinationChainId, vmType: 'evm', protocol: { v2: { chainId: 'robinhood' } } },
  { id: 8453, vmType: 'evm', protocol: { v2: { chainId: 'base' } } },
]
const mapping = { solana: 'solana-vm', robinhood: 'ethereum-vm', base: 'ethereum-vm' }
const routerData = `0x${'0'.repeat(24)}${POLICY.router.slice(2)}`
const amount = '1000000000'
const requestId = `0x${'ab'.repeat(32)}`

function fixture() {
  const deadline = Math.floor(Date.now() / 1000) + 7 * 86400
  const orderData = { version: 'v1', solverChainId: 'base', solver: evmSigner.address,
    salt: `0x${'cd'.repeat(32)}`,
    inputs: [{ payment: { chainId: 'solana', currency: POLICY.sol, amount, weight: '1' },
      refunds: [
        { chainId: 'solana', currency: POLICY.sol, recipient: config.solTreasury,
          minimumAmount: '0', deadline, extraData: '0x' },
        { chainId: 'robinhood', currency: POLICY.eth, recipient: config.evmReceiver,
          minimumAmount: '0', deadline, extraData: routerData },
      ] }],
    output: { chainId: 'robinhood', calls: [], deadline, extraData: routerData,
      payments: [{ recipient: config.evmReceiver, currency: POLICY.weth,
        minimumAmount: '39800000000000000', expectedAmount: '40000000000000000' }] }, fees: [] }
  const orderId = getOrderId(orderData, mapping)
  const instruction = depositInstruction(config.solTreasury, amount, orderId)
  return {
    details: { sender: config.solTreasury, recipient: config.evmReceiver,
      currencyIn: { currency: { chainId: POLICY.originChainId, address: POLICY.sol },
        amount, amountUsd: '100.000000' },
      currencyOut: { currency: { chainId: POLICY.destinationChainId, address: POLICY.weth },
        amount: '40000000000000000', minimumAmount: '39800000000000000', amountUsd: '99.500000' } },
    fees: { app: { amount: '0' } },
    protocol: { v2: { orderId, orderData, hubType: 'onchain', paymentDetails: {
      chainId: 'solana', depository: POLICY.depository, currency: POLICY.sol, amount } } },
    steps: [{ id: 'deposit', kind: 'transaction', requestId, items: [{
      check: { method: 'GET', endpoint: `/intents/status/v3?requestId=${requestId}` },
      data: { instructions: [{ programId: instruction.programId.toBase58(),
        data: instruction.data.toString('hex'), keys: instruction.keys.map(k => ({
          ...k, pubkey: k.pubkey.toBase58() })) }] },
    }] }],
  }
}

function ledger(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faircreators-settlement-'))
  const file = path.join(dir, 'ledger.sqlite')
  let db = new Ledger(file, config)
  t.after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }) })
  return { get db() { return db }, reopen() { db.close(); db = new Ledger(file, config) }, file }
}
const credit = { id: 'finalized-payout:0', lamports: amount }

test('100% of deployer proceeds route to the pinned fanout, in bounded batches', t => {
  const store = ledger(t), db = store.db
  assert.equal(POLICY.deployerShareBps, 10000)
  db.credit({ ...credit, lamports: '3000000000' })
  assert.equal(db.reserve(config).amount, amount)
  assert.equal(db.available(), 2000000000n)
  assert.equal(db.reserve(config).amount, amount)
  assert.equal(db.summary().batches.length, 1)
})

test('receipt replay is idempotent and changed amounts are rejected', t => {
  const { db } = ledger(t)
  db.credit(credit); db.credit(credit)
  assert.equal(db.available(), 1000000000n)
  assert.throws(() => db.credit({ ...credit, lamports: '2' }), /Conflicting/)
  assert.equal(db.available(), 1000000000n)
})

test('independent workers reserve one batch and stale transitions cannot overwrite it', t => {
  const store = ledger(t), other = new Ledger(store.file, config)
  try {
    store.db.credit(credit)
    const a = store.db.reserve(config), b = other.reserve(config)
    assert.equal(a.id, b.id)
    assert.equal(store.db.transition(a, 'bridge-prepared', { chosen: 1 }), true)
    assert.equal(other.transition(b, 'bridge-prepared', { chosen: 2 }), false)
    assert.equal(other.active().data.chosen, 1)
  } finally { other.close() }
})

test('quote commits recipient, assets, refunds and amount to the actual Solana deposit', () => {
  const q = fixture(), checked = validateQuote(q, config, amount, chains)
  assert.equal(checked.requestId, requestId)
  assert.equal(quoteRequest(config, amount).recipient, config.evmReceiver)
  assert.equal(checked.instruction.data.readBigUInt64LE(8), 1000000000n)
})

for (const [name, change] of [
  ['output recipient', q => { q.protocol.v2.orderData.output.payments[0].recipient = POLICY.fanout }],
  ['refund recipient', q => { q.protocol.v2.orderData.inputs[0].refunds[1].recipient = POLICY.fanout }],
  ['order hash', q => { q.protocol.v2.orderData.salt = `0x${'ee'.repeat(32)}` }],
  ['extra debit instruction', q => { q.steps[0].items[0].data.instructions.push(q.steps[0].items[0].data.instructions[0]) }],
  ['deposit amount', q => { q.steps[0].items[0].data.instructions[0].data = '00'.repeat(48) }],
  ['deposit account', q => { q.steps[0].items[0].data.instructions[0].keys[3].pubkey = config.feeDistributor }],
  ['destination chain', q => { q.details.currencyOut.currency.chainId = 1 }],
  ['fees above cap', q => { q.details.currencyOut.amountUsd = '90.000000' }],
  ['unapproved slippage', q => { q.details.currencyOut.minimumAmount = '1' }],
  ['extra calls', q => { q.protocol.v2.orderData.output.calls = ['0x01'] }],
]) {
  test(`rejects modified ${name}`, () => {
    const q = fixture(); change(q)
    assert.throws(() => validateQuote(q, config, amount, chains))
  })
}

test('only finalized transfers from the dedicated deployer distributor become credits', () => {
  const ix = (source, lamports) => ({ programId: SystemProgram.programId,
    parsed: { type: 'transfer', info: { source, destination: config.solTreasury, lamports } } })
  const tx = { slot: 10, meta: { err: null, innerInstructions: [] },
    transaction: { message: { instructions: [ix(config.evmReceiver, 100),
      ix(config.feeDistributor, 456)] } } }
  assert.deepEqual(payoutCredits(tx, 'signature', config).map(r => r.lamports), ['456'])
  tx.meta.err = { InstructionError: [0, 'failed'] }
  assert.throws(() => payoutCredits(tx, 'signature', config))
})

function fakeChains() {
  const calls = { solSign: 0, evmSign: 0, broadcasts: [] }
  return { calls,
    async prepareBridge() { return { requestId } },
    async signBridge() { calls.solSign++; return { raw: 'identical-sol', hash: 'solhash' } },
    async bridgeStatus() { return { pending: true } },
    async broadcastBridge(batch) {
      calls.broadcasts.push(batch.data.solSigned.raw)
      throw new Error('connection lost after broadcast')
    },
    async prepareForward() { return { nonce: 12 } },
    async signForward() { calls.evmSign++; return { raw: 'identical-evm', hash: 'evmhash' } },
    async forwardStatus() { return { hash: 'delivery', amount: '100' } },
    async broadcastForward() { throw new Error('not needed') },
  }
}

test('ambiguous broadcasts survive restart without re-signing or new debits', async t => {
  const store = ledger(t), chain = fakeChains()
  store.db.credit(credit)
  await tick(store.db, chain, config); await tick(store.db, chain, config)
  await assert.rejects(tick(store.db, chain, config), /connection lost/)
  store.reopen()
  await assert.rejects(tick(store.db, chain, config), /connection lost/)
  assert.equal(chain.calls.solSign, 1)
  assert.deepEqual(chain.calls.broadcasts, ['identical-sol', 'identical-sol'])
  assert.equal(store.db.summary().batches.length, 1)
})

test('refunds hold the credited budget and do not silently pay again', async t => {
  const { db } = ledger(t), chain = fakeChains()
  db.credit(credit)
  await tick(db, chain, config); await tick(db, chain, config)
  chain.bridgeStatus = async () => ({ review: 'refund' })
  await tick(db, chain, config)
  assert.equal(db.active().stage, 'review')
  assert.equal(db.available(), 0n)
  await tick(db, chain, config)
  assert.equal(chain.calls.solSign, 1)
})

test('only confirmed delivery finishes a batch; destination hashes cannot be reused', async t => {
  const { db } = ledger(t), chain = fakeChains()
  db.credit({ ...credit, lamports: '2000000000' })
  chain.bridgeStatus = async () => ({ hash: 'fill', amount: '100' })
  for (let i = 0; i < 6; i++) await tick(db, chain, config)
  assert.equal(db.active(), null)
  assert.equal(db.summary().batches[0].stage, 'delivered')
  for (let i = 0; i < 2; i++) await tick(db, chain, config)
  await assert.rejects(tick(db, chain, config), /UNIQUE constraint/)
  assert.equal(db.active().stage, 'bridge-signed')
})

const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])
function log(from, to, value) {
  return { address: POLICY.weth, topics: encodeEventTopics({ abi: transferAbi,
    eventName: 'Transfer', args: { from, to } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [value]) }
}

test('receipt verification counts net WETH and the exact forwarding sender', () => {
  const receipt = { status: 'success', logs: [log(config.evmReceiver, POLICY.fanout, 10n),
    log(POLICY.router, POLICY.fanout, 99n), log(POLICY.fanout, POLICY.router, 1n)] }
  assert.equal(receivedWeth(receipt, POLICY.fanout, config.evmReceiver), 9n)
  assert.throws(() => receivedWeth({ ...receipt, status: 'reverted' }, POLICY.fanout))
})

test('Privy Solana adapter checks signed bytes and rejects a changed message', async () => {
  const q = fixture(), checked = validateQuote(q, config, amount, chains)
  const tx = new Transaction({ feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(checked.instruction)
  const bridge = { quote: q, chains, unsigned: tx.serialize({ requireAllSignatures: false })
    .toString('base64'), blockhash: tx.recentBlockhash,
  preparedAt: Date.now(), deadline: checked.deadline, lastValidBlockHeight: 99 }
  let modifyMessage = false
  const mock = { wallets: () => ({ solana: () => ({ signTransaction: async (_id, input) => {
    const signed = Transaction.from(Buffer.from(input.transaction, 'base64'))
    if (modifyMessage) signed.recentBlockhash = Keypair.generate().publicKey.toBase58()
    signed.sign(signer)
    return { encoding: 'base64', signed_transaction: signed.serialize().toString('base64') }
  } }) }) }
  const client = new Chains(config, mock)
  client.sol.getBlockHeight = async () => 1
  const result = await client.signBridge({ id: 'test', amount, data: { bridge } })
  assert(result.hash.length >= 80)
  modifyMessage = true
  await assert.rejects(client.signBridge({ id: 'test', amount, data: { bridge } }), /Signer changed/)
  bridge.preparedAt = Date.now() - 100000
  await assert.rejects(client.signBridge({ id: 'test', amount, data: { bridge } }), /stale/)
})

test('Privy EVM adapter verifies chain, nonce, amount, calldata and signer', async () => {
  const mock = { wallets: () => ({ ethereum: () => ({ signTransaction: async (_id, input) => {
    const t = input.params.transaction
    return { signed_transaction: await evmSigner.signTransaction({ type: 'legacy',
      chainId: t.chain_id, to: t.to, data: t.data, value: BigInt(t.value),
      nonce: Number(BigInt(t.nonce)), gas: BigInt(t.gas_limit), gasPrice: BigInt(t.gas_price) }) }
  } }) }) }
  const client = new Chains(config, mock)
  const transfer = encodeFunctionData({
    abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
    functionName: 'transfer', args: [POLICY.fanout, 100n] })
  const batch = { id: 'test', data: { fill: { amount: '100' }, forward: {
    chainId: 4663, to: POLICY.weth, data: transfer, value: '0', nonce: 12,
    gas: '50000', gasPrice: '1000000',
  } } }
  const result = await client.signForward(batch)
  assert.match(result.hash, /^0x[0-9a-f]{64}$/)
  batch.data.forward.chainId = 1
  await assert.rejects(client.signForward(batch))
})

test('quoting permits an unset payout source but activation rejects it', () => {
  assert.doesNotThrow(() => configuration({ ...config, feeDistributor: null },
    { requireDistributor: false }))
  assert.throws(() => configuration({ ...config, feeDistributor: null }), /feeDistributor/)
})

test('receipt confirmation waits for depth and rejects a replaced canonical block', async () => {
  const client = new Chains(config, null)
  const receipt = { blockNumber: 100n, blockHash: '0xabc' }
  client.evm = { getTransactionReceipt: async () => receipt,
    getBlockNumber: async () => 110n, getBlock: async () => ({ hash: '0xabc' }) }
  assert.equal(await client.confirmedReceipt('0xhash'), null)
  client.evm.getBlockNumber = async () => 111n
  assert.equal(await client.confirmedReceipt('0xhash'), receipt)
  client.evm.getBlock = async () => ({ hash: '0xdef' })
  await assert.rejects(client.confirmedReceipt('0xhash'), /reorged/)
})
