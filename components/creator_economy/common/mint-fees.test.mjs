// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateMintFee, parsePoolTokens, formatPoolTokens } from './mint-fees.ts'

test('6.9% mint fee pays 25% of the fee to each beneficiary', () => {
  assert.deepEqual(allocateMintFee(parsePoolTokens('100')), {
    user: parsePoolTokens('93.1'),
    totalFee: parsePoolTokens('6.9'),
    manager: parsePoolTokens('3.45'),
    referral: parsePoolTokens('3.45'),
    deployer: parsePoolTokens('1.725'),
    creator: parsePoolTokens('1.725'),
  })
})

test('allocation conserves shares across rounding, updated rates, and u64 limits', () => {
  for (const gross of [0n, 1n, 29n, 100n, 1234567890n, (1n << 64n) - 1n]) {
    for (const rate of [0n, 1n, 500n, 690n, 10000n]) {
      const q = allocateMintFee(gross, rate)
      assert.equal(gross, q.user + q.manager + q.deployer + q.creator)
      assert.equal(q.totalFee, q.referral + q.manager)
      assert.equal(q.referral, q.creator + q.deployer)
      assert.ok(q.creator === q.deployer || q.creator === q.deployer + 1n)
      assert.equal(q.referral, q.totalFee / 2n)
    }
  }
})

test('amount parsing is exact and rejects unsafe representations', () => {
  for (const value of ['0', '0.000000001', '100.123456789', '18446744073.709551615']) {
    assert.equal(formatPoolTokens(parsePoolTokens(value)), value)
  }
  for (const value of ['-1', '1e3', 'Infinity', '1.0000000001', '18446744074', '']) {
    assert.throws(() => parsePoolTokens(value))
  }
  assert.throws(() => allocateMintFee(-1n))
  assert.throws(() => allocateMintFee(1n << 64n))
  assert.throws(() => allocateMintFee(100n, 10001n))
})
