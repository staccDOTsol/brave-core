// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import test from 'node:test'
import assert from 'node:assert/strict'
import { UNIT, U64_MAX, parseUnits, policy, feeFor, quoteMint, quoteRedeem,
  quoteTransfer, quotePayout, scheduleRates } from './economics.mjs'
import { BootstrapBook, creatorKey, contentKey } from './bootstrap.mjs'

const config = policy({ burnShareBps: 9000n, setupShareBps: 500n })
const pool = { backing: 1000n * UNIT, supply: 800n * UNIT }
const caps = { mintBps: 1000n, redeemBps: 1000n, transferBps: 1000n }

test('integer input preserves a single lamport and rejects unsafe inputs', () => {
  assert.equal(parseUnits('0.000000001'), 1n)
  assert.equal(parseUnits('18446744073.709551615'), U64_MAX)
  for (const value of ['-1', '1e3', 'NaN', '0.0000000001', '18446744074']) {
    assert.throws(() => parseUnits(value))
  }
})

test('fee rounding and maximum match economic boundaries', () => {
  assert.equal(feeFor(1n, 690n), 1n)
  assert.equal(feeFor(100n * UNIT, 690n), 6900000000n)
  assert.equal(feeFor(100n * UNIT, 690n, UNIT), UNIT)
  assert.equal(feeFor(U64_MAX, 10000n), U64_MAX)
})

test('mint conserves backing and issued shares, with setup paid from fees', () => {
  const q = quoteMint(pool, 100n * UNIT, config, true)
  assert.equal(q.gross, 80n * UNIT)
  assert.equal(q.received, 74480000000n)
  assert.equal(q.fee, q.split.burn + q.split.setup + q.split.curation
    + q.split.creator + q.split.deployer)
  assert.equal(q.next.supply - pool.supply,
    q.received + q.split.setup + q.split.curation + q.split.creator + q.split.deployer)
  assert.equal(q.next.backing - pool.backing, 100n * UNIT)
  assert.ok(q.next.backing * pool.supply >= pool.backing * q.next.supply)
})

test('a first deposit creates backing and claim together', () => {
  const q = quoteMint({ backing: 0n, supply: 0n }, UNIT, config, true)
  assert.equal(q.next.backing, UNIT)
  assert.equal(q.next.supply, q.received + q.split.curation + q.split.setup
    + q.split.creator + q.split.deployer)
  assert.throws(() => quoteMint({ backing: UNIT, supply: 0n }, UNIT, config))
  assert.throws(() => quoteMint(pool, 1n, config))
})

test('redemption distinguishes principal burn from fee burn', () => {
  const q = quoteRedeem(pool, 10n * UNIT, config)
  assert.equal(q.principalBurn, 9310000000n)
  assert.equal(q.split.creator, 0n)
  assert.equal(q.split.deployer, 0n)
  assert.equal(q.received, 11637500000n)
  assert.equal(pool.backing - q.next.backing, q.received)
  assert.equal(pool.supply - q.next.supply, q.principalBurn + q.split.burn)
  assert.ok(q.next.backing * pool.supply >= pool.backing * q.next.supply)
})

test('withholding is not a burn until settlement', () => {
  const q = quoteTransfer(pool, 10n * UNIT, config)
  assert.equal(q.received + q.fee, 10n * UNIT)
  assert.equal(q.split.creator, 0n)
  assert.equal(q.split.deployer, 0n)
  assert.equal(q.beforeSettlement.supply, pool.supply)
  assert.equal(q.next.backing, pool.backing)
  assert.equal(pool.supply - q.next.supply, q.split.burn)
})

test('curator payout states net amount, with no invented fee exemption', () => {
  const payout = quotePayout(UNIT, config)
  assert.equal(payout.net, 931000000n)
  assert.equal(payout.net + payout.withheld, payout.gross)
})

test('fee splits cannot spend more than collected and stop setup diversion', () => {
  assert.throws(() => policy({ burnShareBps: 9000n, setupShareBps: 1001n }))
  const active = quoteMint(pool, UNIT, config, true)
  const paid = quoteMint(pool, UNIT, config, false)
  assert.equal(paid.split.setup, 0n)
  assert.equal(paid.split.curation, active.split.curation + active.split.setup)
  assert.equal(paid.split.burn, active.split.burn)
})

test('last-share closeout is explicit; no orphaned backing or negative supply', () => {
  const zero = policy({ burnShareBps: 0n, redeemBps: 0n })
  const q = quoteRedeem(pool, pool.supply, zero)
  assert.deepEqual(q.next, { backing: 0n, supply: 0n })
  assert.throws(() => quoteRedeem(pool, pool.supply + 1n, config))
  assert.throws(() => quoteRedeem(pool, pool.supply,
    policy({ burnShareBps: 10000n })))
})

test('creator rates require a claim, respect bounds and schedule changes', () => {
  const rates = { mintBps: 500n, redeemBps: 500n, transferBps: 500n }
  const args = { claimed: true, current: config, rates, caps, epoch: 12n }
  assert.equal(scheduleRates(args).effectiveEpoch, 14n)
  assert.equal(scheduleRates(args).config.mintBps, 500n)
  assert.equal(config.mintBps, 690n)
  assert.throws(() => scheduleRates({ ...args, claimed: false }))
  assert.throws(() => scheduleRates({ ...args, rates: { ...rates, mintBps: 1001n } }))
})

test('many mixed operations conserve shares and backing', () => {
  let state = pool
  for (let i = 1n; i <= 100n; i++) {
    const before = state
    const mint = quoteMint(state, i * UNIT, config, true)
    const transfer = quoteTransfer(mint.next, mint.received / 3n, config, true)
    const redeem = quoteRedeem(transfer.next, mint.received / 3n, config, true)
    state = redeem.next
    assert.equal(state.backing, before.backing + i * UNIT - redeem.received)
    assert.equal(state.supply, before.supply + mint.gross - mint.split.burn
      - transfer.split.burn - redeem.principalBurn - redeem.split.burn)
    assert.ok(state.backing * before.supply >= before.backing * state.supply)
  }
})

test('creator and content keys keep distinct identities separate', () => {
  assert.notEqual(creatorKey('youtube', '42'), creatorKey('twitch', '42'))
  assert.notEqual(contentKey(creatorKey('youtube', '42'), 'video'),
    contentKey(creatorKey('youtube', '43'), 'video'))
  assert.notEqual(creatorKey('a:b', 'c'), creatorKey('a', 'b:c'))
})

test('two first actors share one setup, stay unclaimed and complete once', () => {
  const book = new BootstrapBook()
  const a = { creator: creatorKey('youtube', 'demo'), intentId: 'a', actorId: 'one',
    actionFingerprint: 'mint:100' }
  assert.equal(book.begin(a).created, true)
  assert.equal(book.begin({ ...a, intentId: 'b', actorId: 'two' }).created, false)
  assert.throws(() => book.complete('a'))
  book.markReady(a.creator, UNIT)
  assert.equal(book.markReady(a.creator, UNIT).sponsorAdvanced, UNIT)
  assert.equal(book.getCreator(a.creator).claimed, false)
  assert.equal(book.complete('a'), true)
  assert.equal(book.complete('a'), false)
  assert.equal(book.complete('b'), true)
  assert.throws(() => book.begin({ ...a, actionFingerprint: 'mint:101' }))
  assert.throws(() => book.begin({ ...a, actorId: 'attacker' }))
  assert.throws(() => book.markReady(a.creator, 2n * UNIT))
})

test('setup recovery uses actual SOL receipts once and never exceeds debt', () => {
  const book = new BootstrapBook()
  book.begin({ creator: 'c', intentId: 'i', actorId: 'a', actionFingerprint: 'mint' })
  book.markReady('c', UNIT)
  assert.equal(book.repay('c', UNIT / 2n, 'receipt1'), UNIT / 2n)
  assert.equal(book.repay('c', UNIT / 2n, 'receipt1'), 0n)
  assert.throws(() => book.repay('c', UNIT, 'receipt1'))
  assert.equal(book.repay('c', UNIT, 'receipt2'), UNIT / 2n)
  assert.equal(book.getCreator('c').sponsorRepaid, UNIT)
})
