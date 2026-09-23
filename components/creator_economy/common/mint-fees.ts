// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

const U64_MAX = (BigInt(1) << BigInt(64)) - BigInt(1)
const BPS = BigInt(10_000)
export const DEFAULT_MINT_FEE_BPS = BigInt(690)
export const MINT_REFERRAL_PERCENT = BigInt(50)

/** Pool-token base units, before any transfer or redemption of fee shares. */
export interface MintFeeAllocation {
  user: bigint
  totalFee: bigint
  manager: bigint
  referral: bigint
  deployer: bigint
  creator: bigint
}

/** Mirrors Sanctum's rounded-up deposit fee and rounded-down referral share. */
export function allocateMintFee(
  grossPoolTokens: bigint,
  mintFeeBps = DEFAULT_MINT_FEE_BPS,
): MintFeeAllocation {
  if (
    grossPoolTokens < BigInt(0)
    || grossPoolTokens > U64_MAX
    || mintFeeBps < BigInt(0)
    || mintFeeBps > BPS
  ) {
    throw new RangeError('Invalid pool-token amount or fee rate')
  }
  const totalFee = (grossPoolTokens * mintFeeBps + BPS - BigInt(1)) / BPS
  const referral = (totalFee * MINT_REFERRAL_PERCENT) / BigInt(100)
  const deployer = referral / BigInt(2)
  return {
    user: grossPoolTokens - totalFee,
    totalFee,
    manager: totalFee - referral,
    referral,
    deployer,
    // Assign an indivisible remaining base unit to the creator.
    creator: referral - deployer,
  }
}

/** Parse a display amount without passing token quantities through Number. */
export function parsePoolTokens(value: string, decimals = 9): bigint {
  if (
    !Number.isInteger(decimals)
    || decimals < 0
    || decimals > 18
    || !/^\d{1,20}(?:\.\d{1,18})?$/.test(value)
  ) {
    throw new RangeError('Invalid amount')
  }
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > decimals) throw new RangeError('Too many decimals')
  const result =
    BigInt(whole) * BigInt(10) ** BigInt(decimals)
    + BigInt(fraction.padEnd(decimals, '0') || '0')
  if (result > U64_MAX) throw new RangeError('Amount exceeds u64')
  return result
}

export function formatPoolTokens(value: bigint, decimals = 9): string {
  if (
    value < BigInt(0)
    || value > U64_MAX
    || !Number.isInteger(decimals)
    || decimals < 0
    || decimals > 18
  ) {
    throw new RangeError('Invalid amount')
  }
  const scale = BigInt(10) ** BigInt(decimals)
  if (decimals === 0) return value.toString()
  const fraction = (value % scale)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')
  return `${value / scale}${fraction ? `.${fraction}` : ''}`
}
