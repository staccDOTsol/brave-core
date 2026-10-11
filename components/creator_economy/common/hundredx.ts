// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

/**
 * Link builders for 100x.broker, the ±100× long/short and delta-neutral vault
 * venue that every creator surface links to. Pure functions: nothing here
 * fetches, signs or stores. Node's type stripping runs this file directly in
 * tests, so the syntax stays erasable (no enums, no parameter properties) and
 * on ES2019 (no bigint literals) for the wallet-model type check.
 */

export const HUNDREDX_ORIGIN = 'https://100x.broker'

/** r-fstacc stake-pool token: the venue's quote asset for markets and vaults. */
export const HUNDREDX_QUOTE_MINT = 'pSYRpDqr847kB2nD5ZhjcPsHLV2ZpUxweXm1MwiSTcc'

/** SanctumSpl, the same program the creator pools use (docs/creator_economy.md). */
export const HUNDREDX_STAKE_POOL_PROGRAM =
  'SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY'

export const HUNDREDX_PITCH =
  'You long it? Long it. Short? Short it. '
  + "Don't want to be long or short but think it's gonna be a wild ride? Park it."

/**
 * Referral wallet the browser attaches to every 100x.broker link. The site
 * stores it and routes 50% of its 0.1% stake-pool deposit fee to that wallet,
 * on-chain, for as long as the visitor keeps using the site.
 *
 * TODO(creator-economy): set this to the deployer wallet, the key entitled to
 * the deployer half of the mint referral (docs/creator_economy.md, "Mint-only
 * referral and creator escrow"). No deployer address exists in source yet: the
 * settlement service's `feeDistributor` is private config
 * (server/settlement/README.md). While null, links carry no `ref`.
 */
// The house wallet: the same key 100x.broker itself shares links under. Half of the 0.1% deposit fee on anything a
// browser user does there lands in its r-fstacc account, on-chain.
export const HUNDREDX_DEFAULT_REF: string | null = '331nEBz4i3XjyaUHVyHnpw9xBoW7D6P1qMPnUPd76Mth'

/** `?side=0` preselects UP (long); `?side=1` preselects DOWN (short). */
export const HUNDREDX_SIDE_LONG = 0
export const HUNDREDX_SIDE_SHORT = 1
export type HundredxSide = 0 | 1

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const PATH_TOKEN = /^[A-Za-z0-9_-]{1,128}$/

/** A 32-byte Solana public key in base58: mints and wallets. */
export function isSolanaAddress(value: unknown): value is string {
  if (
    typeof value !== 'string'
    || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  ) {
    return false
  }
  // Each leading '1' is a zero byte; the rest is the byte length of the value.
  let bytes = 0
  while (bytes < value.length && value[bytes] === '1') bytes++
  let n = BigInt(0)
  for (const char of value) n = n * BigInt(58) + BigInt(BASE58.indexOf(char))
  for (; n > BigInt(0); n >>= BigInt(8)) bytes++
  return bytes === 32
}

function address(value: string, name: string): string {
  if (!isSolanaAddress(value)) {
    throw new TypeError(`${name} must be a base58 Solana address`)
  }
  return value
}

function pathToken(value: string, name: string): string {
  if (typeof value !== 'string' || !PATH_TOKEN.test(value)) {
    throw new TypeError(`${name} must be a URL-safe key`)
  }
  return value
}

/** Attach or replace the referral wallet on a 100x.broker URL only. */
export function withRef(
  url: string,
  ref: string | null | undefined = HUNDREDX_DEFAULT_REF,
): string {
  const target = new URL(url)
  if (target.origin !== HUNDREDX_ORIGIN) {
    throw new TypeError('Referrals apply to 100x.broker links only')
  }
  if (ref === null || ref === undefined) return target.href
  target.searchParams.set('ref', address(ref, 'ref'))
  return target.href
}

function build(
  path: string,
  params: Record<string, string>,
  ref: string | null | undefined,
): string {
  const url = new URL(path, HUNDREDX_ORIGIN)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return withRef(url.href, ref)
}

/** `/m/<marketKey>`; market keys come from the venue and are never invented. */
export function marketUrl(
  key: string,
  side?: HundredxSide | null,
  ref: string | null | undefined = HUNDREDX_DEFAULT_REF,
): string {
  const params: Record<string, string> = {}
  if (side !== null && side !== undefined) {
    if (side !== HUNDREDX_SIDE_LONG && side !== HUNDREDX_SIDE_SHORT) {
      throw new RangeError('side must be 0 (long) or 1 (short)')
    }
    params.side = String(side)
  }
  return build(`/m/${pathToken(key, 'market key')}`, params, ref)
}

/**
 * `/new?mint=`: the token's market if one exists, else the one-transaction
 * "cook up a market" flow. Markets need a Raydium CLMM pool against
 * SOL/USDC/USDT, which a fresh creator receipt mint will not have at first.
 */
export function mintUrl(
  mint: string,
  ref: string | null | undefined = HUNDREDX_DEFAULT_REF,
): string {
  return build('/new', { mint: address(mint, 'mint') }, ref)
}

/** `/yield` lists the delta-neutral vaults; `/yield/<vault>` opens one. */
export function yieldUrl(
  vault?: string | null,
  ref: string | null | undefined = HUNDREDX_DEFAULT_REF,
): string {
  return build(vault ? `/yield/${pathToken(vault, 'vault')}` : '/yield', {}, ref)
}

/** `/meta`: the curated market list. */
export function metaUrl(
  ref: string | null | undefined = HUNDREDX_DEFAULT_REF,
): string {
  return build('/meta', {}, ref)
}

/** `/p/<wallet>`: a wallet's bag. */
export function bagUrl(
  wallet: string,
  ref: string | null | undefined = HUNDREDX_DEFAULT_REF,
): string {
  return build(`/p/${address(wallet, 'wallet')}`, {}, ref)
}

/** The three venue actions for one creator token. */
export interface HundredxCreatorLinks {
  mint: string
  /** Long and short both resolve the mint; `/new` has no side preselect. */
  long: string
  short: string
  /** Vaults are not per mint: parking is the venue-wide delta-neutral list. */
  park: string
}

export function creatorLinks(
  mint: string,
  ref: string | null | undefined = HUNDREDX_DEFAULT_REF,
): HundredxCreatorLinks {
  const trade = mintUrl(mint, ref)
  return { mint, long: trade, short: trade, park: yieldUrl(null, ref) }
}
