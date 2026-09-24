// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import assert from 'node:assert/strict'
import { PublicKey } from '@solana/web3.js'
import { getAddress } from 'viem'

export const POLICY = Object.freeze({
  version: 'wizards-deployer-v1',
  deployerShareBps: 10_000,
  originChainId: 792703809,
  destinationChainId: 4663,
  sol: '11111111111111111111111111111111',
  eth: '0x0000000000000000000000000000000000000000',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  fanout: '0x1b88A6c6516FD2918905186F21Bb9F5CaA1a15c8',
  collection: '0x7c165Ae6E7BFD939Fee1ACA99Ca5aeDf85c52dD4',
  shares: 8010n,
  depository: '99vQwtBwYtrqqD9YSXbdum3KBdxPAVxYTaQ3cfnJSrN2',
  router: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
  solanaGenesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
})

export function uint(value, label = 'amount') {
  assert(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value),
    `${label} must be an integer string`)
  return BigInt(value)
}

export const sameEvm = (a, b) => typeof a === 'string'
  && a.toLowerCase() === b.toLowerCase()

export function configuration(input, { requireDistributor = true } = {}) {
  const c = {
    minBatchLamports: '50000000',
    maxBatchLamports: '1000000000',
    solReserveLamports: '10000000',
    maxSolFeeLamports: '100000',
    maxEvmFeeWei: '100000000000000',
    maxLossBps: 150,
    slippageBps: 50,
    evmConfirmations: 12,
    ...input,
  }
  c.solTreasury = new PublicKey(c.solTreasury).toBase58()
  if (requireDistributor || c.feeDistributor) {
    assert(c.feeDistributor, 'Configure the deployer-only feeDistributor before activation')
    c.feeDistributor = new PublicKey(c.feeDistributor).toBase58()
    assert.notEqual(c.solTreasury, c.feeDistributor, 'Use a separate payout source')
  }
  c.evmReceiver = getAddress(c.evmReceiver)
  assert(!sameEvm(c.evmReceiver, POLICY.fanout), 'Refunds need a wallet receiver')
  assert(!sameEvm(c.evmReceiver, POLICY.eth), 'Zero receiver')
  for (const key of ['minBatchLamports', 'maxBatchLamports',
    'solReserveLamports', 'maxSolFeeLamports', 'maxEvmFeeWei']) {
    assert(uint(c[key], key) > 0n)
  }
  assert(uint(c.minBatchLamports) <= uint(c.maxBatchLamports))
  assert(uint(c.maxBatchLamports) <= (1n << 64n) - 1n)
  for (const key of ['maxLossBps', 'slippageBps']) {
    assert(Number.isInteger(c[key]) && c[key] >= 0 && c[key] <= 500,
      `${key} must be between 0 and 500`)
  }
  assert(Number.isInteger(c.evmConfirmations) && c.evmConfirmations >= 12)
  return Object.freeze(c)
}

// Quoted USD figures are policy checks, not an independent price oracle.
export function usdMicros(value) {
  assert(typeof value === 'string' && /^\d+(\.\d{1,6})?$/.test(value))
  const [whole, part = ''] = value.split('.')
  return BigInt(whole) * 1_000_000n + BigInt(part.padEnd(6, '0'))
}
