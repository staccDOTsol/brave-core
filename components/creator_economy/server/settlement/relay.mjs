// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import assert from 'node:assert/strict'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { getOrderId } from '@relay-protocol/settlement-sdk'
import { POLICY, sameEvm, uint, usdMicros } from './policy.mjs'

const VM_TYPES = { evm: 'ethereum-vm', svm: 'solana-vm' }
const routerData = `0x${'0'.repeat(24)}${POLICY.router.slice(2)}`

export function quoteRequest(config, lamports) {
  assert(uint(lamports) > 0n && uint(lamports) <= uint(config.maxBatchLamports))
  return {
    user: config.solTreasury,
    recipient: config.evmReceiver,
    originChainId: POLICY.originChainId,
    destinationChainId: POLICY.destinationChainId,
    originCurrency: POLICY.sol,
    destinationCurrency: POLICY.weth,
    amount: lamports,
    tradeType: 'EXACT_INPUT',
    slippageTolerance: String(config.slippageBps),
    refundTo: config.solTreasury,
  }
}

export async function relayRequest(path, body, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.relay.link${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
  })
  assert(response.ok, `Relay HTTP ${response.status}`)
  return response.json()
}

export function depositInstruction(sender, lamports, orderId) {
  const programId = new PublicKey(POLICY.depository)
  const [state] = PublicKey.findProgramAddressSync(
    [Buffer.from('relay_depository')], programId)
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId)
  const data = Buffer.alloc(48)
  // deposit_native layout from the pinned Relay settlement SDK's Anchor IDL.
  Buffer.from('0d9e0ddf5fd51c06', 'hex').copy(data)
  data.writeBigUInt64LE(uint(lamports), 8)
  assert(/^0x[0-9a-f]{64}$/i.test(orderId))
  Buffer.from(orderId.slice(2), 'hex').copy(data, 16)
  return new TransactionInstruction({ programId, data, keys: [
    { pubkey: state, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(sender), isSigner: true, isWritable: true },
    { pubkey: new PublicKey(sender), isSigner: false, isWritable: false },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(POLICY.sol), isSigner: false, isWritable: false },
  ] })
}

export function validateQuote(q, config, lamports, chains, now = Date.now()) {
  const origin = chains.find(c => c.id === POLICY.originChainId)
  const destination = chains.find(c => c.id === POLICY.destinationChainId)
  assert(origin && destination && !origin.disabled && !destination.disabled)
  assert.equal(origin.protocol?.v2?.depository, POLICY.depository)
  assert.equal(origin.protocol.v2.chainId, 'solana')
  assert.equal(destination.protocol?.v2?.chainId, 'robinhood')
  const d = q.details
  assert.equal(d.sender, config.solTreasury)
  assert(sameEvm(d.recipient, config.evmReceiver))
  assert.equal(d.currencyIn.currency.chainId, POLICY.originChainId)
  assert.equal(d.currencyIn.currency.address, POLICY.sol)
  assert.equal(d.currencyIn.amount, lamports)
  assert.equal(d.currencyOut.currency.chainId, POLICY.destinationChainId)
  assert(sameEvm(d.currencyOut.currency.address, POLICY.weth))
  assert.equal(uint(q.fees.app.amount), 0n)
  const minimum = uint(d.currencyOut.minimumAmount)
  const expected = uint(d.currencyOut.amount)
  assert(minimum > 0n && expected >= minimum)
  assert(minimum >= expected * BigInt(10_000 - config.slippageBps) / 10_000n)
  const inputUsd = usdMicros(d.currencyIn.amountUsd)
  const outputUsd = usdMicros(d.currencyOut.amountUsd)
  assert(inputUsd > 0n && outputUsd * 10_000n
    >= inputUsd * BigInt(10_000 - config.maxLossBps), 'Quote exceeds cost limit')

  const p = q.protocol?.v2
  assert(p && p.hubType === 'onchain', 'Require a verifiable Relay v2 order')
  assert.equal(p.paymentDetails.chainId, 'solana')
  assert.equal(p.paymentDetails.depository, POLICY.depository)
  assert.equal(p.paymentDetails.currency, POLICY.sol)
  assert.equal(p.paymentDetails.amount, lamports)
  const order = p.orderData
  assert.equal(order.version, 'v1')
  assert.equal(order.inputs.length, 1)
  const input = order.inputs[0]
  assert.deepEqual(input.payment, {
    chainId: 'solana', currency: POLICY.sol, amount: lamports, weight: '1',
  })
  assert(input.refunds.length > 0 && input.refunds.length <= 2)
  const seen = new Set()
  for (const refund of input.refunds) {
    assert(!seen.has(refund.chainId), 'Duplicate refund route')
    seen.add(refund.chainId)
    if (refund.chainId === 'solana') {
      assert.equal(refund.recipient, config.solTreasury)
      assert.equal(refund.currency, POLICY.sol)
      assert.equal(refund.extraData, '0x')
    } else {
      assert.equal(refund.chainId, 'robinhood')
      assert(sameEvm(refund.recipient, config.evmReceiver))
      assert(sameEvm(refund.currency, POLICY.eth))
      assert.equal(refund.extraData.toLowerCase(), routerData)
    }
    assert.equal(refund.deadline, order.output.deadline)
  }
  assert(seen.has('solana'))
  assert.equal(order.output.chainId, 'robinhood')
  assert.equal(order.output.payments.length, 1)
  const payment = order.output.payments[0]
  assert(sameEvm(payment.recipient, config.evmReceiver))
  assert(sameEvm(payment.currency, POLICY.weth))
  assert.equal(uint(payment.minimumAmount), minimum)
  assert.equal(uint(payment.expectedAmount), expected)
  assert.deepEqual(order.output.calls, [])
  assert.deepEqual(order.fees, [])
  assert.equal(order.output.extraData.toLowerCase(), routerData)
  assert(Number.isSafeInteger(order.output.deadline))
  assert(order.output.deadline * 1000 > now + 30_000, 'Expired order')
  // Protocol refund deadlines can be a week out; quote freshness is enforced
  // separately against the local preparation timestamp before signing.
  assert(order.output.deadline * 1000 < now + 8 * 86_400_000, 'Excessive order lifetime')
  const mapping = Object.fromEntries(chains.filter(c => c.protocol?.v2?.chainId
    && VM_TYPES[c.vmType]).map(c => [c.protocol.v2.chainId, VM_TYPES[c.vmType]]))
  assert.equal(getOrderId(order, mapping).toLowerCase(), p.orderId.toLowerCase(),
    'Order hash mismatch')

  assert.equal(q.steps.length, 1)
  const step = q.steps[0]
  assert.equal(step.id, 'deposit')
  assert.equal(step.kind, 'transaction')
  assert.equal(step.items.length, 1)
  assert(!step.depositAddress, 'Deposit-address routes are not supported')
  const requestId = step.requestId
  assert(/^0x[0-9a-f]{64}$/i.test(requestId))
  const item = step.items[0]
  assert.equal(item.check.method, 'GET')
  assert.equal(item.check.endpoint, `/intents/status/v3?requestId=${requestId}`)
  const ix = depositInstruction(config.solTreasury, lamports, p.orderId)
  // Build our own legacy transaction. Lookup tables and API-supplied extra
  // instructions never enter the message sent to Privy.
  assert.deepEqual(item.data.instructions, [{
    keys: ix.keys.map(k => ({ ...k, pubkey: k.pubkey.toBase58() })),
    programId: ix.programId.toBase58(), data: ix.data.toString('hex'),
  }], 'Unexpected Solana instructions')
  return { requestId, orderId: p.orderId, minimumWeth: minimum.toString(),
    deadline: order.output.deadline, instruction: ix }
}
