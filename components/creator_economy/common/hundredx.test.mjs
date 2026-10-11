// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HUNDREDX_ORIGIN, HUNDREDX_QUOTE_MINT, HUNDREDX_STAKE_POOL_PROGRAM, HUNDREDX_PITCH,
  HUNDREDX_DEFAULT_REF, HUNDREDX_SIDE_LONG, HUNDREDX_SIDE_SHORT,
  isSolanaAddress, withRef, marketUrl, mintUrl, yieldUrl, metaUrl, bagUrl, creatorLinks,
} from './hundredx.ts'

const mint = 'So11111111111111111111111111111111111111112'
const wallet = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const ref = HUNDREDX_QUOTE_MINT

test('venue constants are the documented origin, quote asset and verbatim pitch', () => {
  assert.equal(HUNDREDX_ORIGIN, 'https://100x.broker')
  assert.equal(HUNDREDX_QUOTE_MINT, 'pSYRpDqr847kB2nD5ZhjcPsHLV2ZpUxweXm1MwiSTcc')
  assert.ok(isSolanaAddress(HUNDREDX_QUOTE_MINT))
  assert.ok(isSolanaAddress(HUNDREDX_STAKE_POOL_PROGRAM))
  assert.equal(HUNDREDX_PITCH, 'You long it? Long it. Short? Short it. '
    + "Don't want to be long or short but think it's gonna be a wild ride? Park it.")
  // Null until the deployer wallet is configured; never an arbitrary string.
  assert.ok(HUNDREDX_DEFAULT_REF === null || isSolanaAddress(HUNDREDX_DEFAULT_REF))
})

test('base58 validation checks the decoded length, not just the alphabet', () => {
  for (const value of [mint, wallet, ref, '1'.repeat(32)]) {
    assert.ok(isSolanaAddress(value), value)
  }
  for (const value of ['', 'not-base58', '0'.repeat(44), 'z'.repeat(44), '2'.repeat(32),
    '1'.repeat(31), '1'.repeat(33), mint.slice(1), `${mint} `, 42, null, undefined]) {
    assert.equal(isSolanaAddress(value), false, String(value))
  }
})

test('builders emit the documented routes and only the given query parameters', () => {
  assert.equal(marketUrl('abc_DEF-123', null, null), `${HUNDREDX_ORIGIN}/m/abc_DEF-123`)
  assert.equal(marketUrl('k', HUNDREDX_SIDE_LONG, null), `${HUNDREDX_ORIGIN}/m/k?side=0`)
  assert.equal(marketUrl('k', HUNDREDX_SIDE_SHORT, null), `${HUNDREDX_ORIGIN}/m/k?side=1`)
  assert.equal(mintUrl(mint, null), `${HUNDREDX_ORIGIN}/new?mint=${mint}`)
  assert.equal(yieldUrl(null, null), `${HUNDREDX_ORIGIN}/yield`)
  assert.equal(yieldUrl(undefined, null), `${HUNDREDX_ORIGIN}/yield`)
  assert.equal(yieldUrl('vault1', null), `${HUNDREDX_ORIGIN}/yield/vault1`)
  assert.equal(metaUrl(null), `${HUNDREDX_ORIGIN}/meta`)
  assert.equal(bagUrl(wallet, null), `${HUNDREDX_ORIGIN}/p/${wallet}`)
})

test('an explicit ref wallet is appended and the default ref applies when omitted', () => {
  assert.equal(marketUrl('k', 1, ref), `${HUNDREDX_ORIGIN}/m/k?side=1&ref=${ref}`)
  assert.equal(mintUrl(mint, ref), `${HUNDREDX_ORIGIN}/new?mint=${mint}&ref=${ref}`)
  assert.equal(yieldUrl(null, ref), `${HUNDREDX_ORIGIN}/yield?ref=${ref}`)
  assert.equal(yieldUrl('v', ref), `${HUNDREDX_ORIGIN}/yield/v?ref=${ref}`)
  assert.equal(metaUrl(ref), `${HUNDREDX_ORIGIN}/meta?ref=${ref}`)
  assert.equal(bagUrl(wallet, ref), `${HUNDREDX_ORIGIN}/p/${wallet}?ref=${ref}`)
  for (const [withDefault, explicit] of [
    [mintUrl(mint), mintUrl(mint, null)],
    [yieldUrl(), yieldUrl(null, null)],
    [metaUrl(), metaUrl(null)],
    [bagUrl(wallet), bagUrl(wallet, null)],
    [marketUrl('k', 0), marketUrl('k', 0, null)],
  ]) {
    assert.equal(withDefault, withRef(explicit, HUNDREDX_DEFAULT_REF))
    assert.equal(withDefault.includes('ref='), HUNDREDX_DEFAULT_REF !== null)
  }
})

test('withRef replaces an existing ref, keeps other parameters and refuses other hosts', () => {
  const url = `${HUNDREDX_ORIGIN}/new?mint=${mint}&ref=${wallet}#deep`
  assert.equal(withRef(url, ref), `${HUNDREDX_ORIGIN}/new?mint=${mint}&ref=${ref}#deep`)
  assert.equal(withRef(url, null), url)
  assert.equal(withRef(`${HUNDREDX_ORIGIN}/meta`, undefined),
    HUNDREDX_DEFAULT_REF ? `${HUNDREDX_ORIGIN}/meta?ref=${HUNDREDX_DEFAULT_REF}`
      : `${HUNDREDX_ORIGIN}/meta`)
  for (const other of ['https://100x.broker.example.com/meta', 'http://100x.broker/meta',
    'https://example.com/?ref=x', 'javascript:alert(1)', 'not a url']) {
    assert.throws(() => withRef(other, ref), other)
  }
  assert.throws(() => withRef(`${HUNDREDX_ORIGIN}/meta`, 'not-a-wallet'))
})

test('malformed mints, wallets, keys and sides are rejected instead of linked', () => {
  for (const bad of ['', 'not-a-mint', '2'.repeat(32), `${mint}/../x`, '0'.repeat(44)]) {
    assert.throws(() => mintUrl(bad, null), bad)
    assert.throws(() => bagUrl(bad, null), bad)
    assert.throws(() => creatorLinks(bad, null), bad)
    assert.throws(() => mintUrl(mint, bad), bad)
  }
  for (const bad of ['', 'a/b', '../etc', 'a b', 'k?side=1', 'k#x', 'x'.repeat(129)]) {
    assert.throws(() => marketUrl(bad, null, null), bad)
    // An empty vault means the vault list, so only non-empty junk is rejected.
    if (bad) assert.throws(() => yieldUrl(bad, null), bad)
  }
  for (const bad of [2, -1, '0', 0.5, true]) {
    assert.throws(() => marketUrl('k', bad, null), String(bad))
  }
})

test('creator links resolve the mint for long and short, park in the vaults, and never invent a market', () => {
  const links = creatorLinks(mint, ref)
  assert.deepEqual(links, {
    mint,
    long: mintUrl(mint, ref),
    short: mintUrl(mint, ref),
    park: yieldUrl(null, ref),
  })
  for (const url of [links.long, links.short, links.park]) {
    assert.ok(url.startsWith(`${HUNDREDX_ORIGIN}/`))
    assert.ok(!url.includes('/m/'))
    assert.ok(url.endsWith(`ref=${ref}`))
  }
  assert.deepEqual(creatorLinks(mint), creatorLinks(mint, HUNDREDX_DEFAULT_REF))
})
