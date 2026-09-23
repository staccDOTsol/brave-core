// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { allocateMintFee } from './mint-fees.ts'

export const BPS = 10_000n
export const UNIT = 1_000_000_000n
export const U64_MAX = (1n << 64n) - 1n
export const DEFAULT_RATE = 690n

function amount(value, name = 'amount') {
  if (typeof value !== 'bigint' || value < 0n || value > U64_MAX) {
    throw new RangeError(`${name} must be an unsigned 64-bit integer`)
  }
  return value
}

function rate(value) {
  amount(value, 'rate')
  if (value > BPS) throw new RangeError('Rate exceeds 100%')
  return value
}

export function parseUnits(text) {
  if (!/^\d+(\.\d{0,9})?$/.test(text)) {
    throw new RangeError('Enter a positive amount with at most nine decimals')
  }
  const [whole, fraction = ''] = text.split('.')
  return amount(BigInt(whole) * UNIT + BigInt(fraction.padEnd(9, '0')))
}

export function formatUnits(value, digits = 6) {
  amount(value)
  if (!Number.isInteger(digits) || digits < 0 || digits > 9) {
    throw new RangeError('Invalid decimal precision')
  }
  const whole = (value / UNIT).toLocaleString('en-US')
  const fraction = (value % UNIT).toString().padStart(9, '0').slice(0, digits)
  return digits ? `${whole}.${fraction}` : whole
}

// Both the inspected Sanctum Fee::apply and T22 transfer fees round up.
export function feeFor(value, bps, maximum = U64_MAX) {
  amount(value)
  rate(bps)
  amount(maximum)
  const fee = (value * bps + BPS - 1n) / BPS
  return fee < maximum ? fee : maximum
}

/** Split choices must be supplied: they are not settled product defaults. */
export function policy({ burnShareBps, setupShareBps = 0n,
  mintBps = DEFAULT_RATE, redeemBps = DEFAULT_RATE,
  transferBps = DEFAULT_RATE, maximumTransferFee = U64_MAX }) {
  for (const bps of [burnShareBps, setupShareBps, mintBps, redeemBps, transferBps]) {
    rate(bps)
  }
  if (burnShareBps + setupShareBps > BPS) {
    throw new RangeError('Fee allocation exceeds collected fees')
  }
  amount(maximumTransferFee)
  return Object.freeze({ burnShareBps, setupShareBps, mintBps, redeemBps,
    transferBps, maximumTransferFee })
}

export function splitFee(fee, config, recoveringSetup = false,
  entitlement = { creator: 0n, deployer: 0n }) {
  amount(fee)
  const { creator, deployer } = entitlement
  amount(creator)
  amount(deployer)
  const manager = amount(fee - creator - deployer)
  const burn = manager * config.burnShareBps / BPS
  const setup = recoveringSetup ? manager * config.setupShareBps / BPS : 0n
  return { burn, setup, curation: manager - burn - setup, creator, deployer }
}

function checkPool(pool) {
  amount(pool.backing, 'backing')
  amount(pool.supply, 'supply')
  if ((pool.backing === 0n) !== (pool.supply === 0n)) {
    throw new RangeError('Backing and supply need an explicit bootstrap or loss policy')
  }
}

function positive(value) {
  amount(value)
  if (value === 0n) throw new RangeError('Enter an amount greater than zero')
}

/** A settled reference transition, excluding rent, gas and route-specific CPIs. */
export function quoteMint(pool, lamports, config, recoveringSetup = false) {
  checkPool(pool)
  positive(lamports)
  const gross = pool.supply === 0n
    ? lamports : lamports * pool.supply / pool.backing
  amount(gross)
  const allocation = allocateMintFee(gross, config.mintBps)
  const fee = allocation.totalFee
  const received = gross - fee
  if (received <= 0n) throw new RangeError('Amount is too small after fees')
  const split = splitFee(fee, config, recoveringSetup, allocation)
  const next = { backing: pool.backing + lamports,
    supply: pool.supply + gross - split.burn }
  checkPool(next)
  return { kind: 'mint', input: lamports, gross, fee, received, split, next }
}

export function quoteRedeem(pool, shares, config, recoveringSetup = false) {
  checkPool(pool)
  positive(shares)
  if (shares > pool.supply) throw new RangeError('Amount exceeds pool supply')
  const fee = feeFor(shares, config.redeemBps)
  const principalBurn = shares - fee
  const received = principalBurn * pool.backing / pool.supply
  if (received <= 0n) throw new RangeError('Amount is too small after fees')
  const split = splitFee(fee, config, recoveringSetup)
  const next = { backing: pool.backing - received,
    supply: pool.supply - principalBurn - split.burn }
  // A production close-out rule is needed before burning the last fee shares.
  checkPool(next)
  return { kind: 'redeem', input: shares, gross: shares, fee, received,
    principalBurn, split, next }
}

/** Withholding alone leaves supply unchanged; settlement later burns the fee. */
export function quoteTransfer(pool, shares, config, recoveringSetup = false) {
  checkPool(pool)
  positive(shares)
  if (shares > pool.supply) throw new RangeError('Amount exceeds pool supply')
  const fee = feeFor(shares, config.transferBps, config.maximumTransferFee)
  const split = splitFee(fee, config, recoveringSetup)
  const next = { backing: pool.backing, supply: pool.supply - split.burn }
  checkPool(next)
  return { kind: 'transfer', input: shares, gross: shares, fee,
    received: shares - fee, split,
    beforeSettlement: { ...pool },
    next }
}

/** Same-token curator payouts are themselves subject to the transfer fee. */
export function quotePayout(shares, config) {
  positive(shares)
  const withheld = feeFor(shares, config.transferBps, config.maximumTransferFee)
  return { gross: shares, net: shares - withheld, withheld }
}

/** Proposed coordinated change window; native CPI constraints still apply. */
export function scheduleRates({ claimed, current, rates, caps, epoch }) {
  if (!claimed) throw new Error('A verified creator claim is required')
  amount(epoch, 'epoch')
  for (const name of ['mintBps', 'redeemBps', 'transferBps']) {
    rate(rates[name])
    rate(caps[name])
    if (rates[name] > caps[name]) throw new RangeError('Rate exceeds the creator cap')
  }
  return { config: policy({ ...current, mintBps: rates.mintBps,
    redeemBps: rates.redeemBps, transferBps: rates.transferBps }),
  effectiveEpoch: epoch + 2n }
}
