// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import { UNIT, parseUnits, formatUnits, policy, quoteMint, quoteRedeem,
  quoteTransfer, scheduleRates } from './economics.mjs'
import { BootstrapBook, creatorKey } from './bootstrap.mjs'

const $ = (id) => document.getElementById(id)
const text = (id, value) => { $(id).textContent = value }
const creator = creatorKey('youtube', 'demo-field-notes-stable-id')
const book = new BootstrapBook()
let pool = { backing: 0n, supply: 0n }
let config = policy({ burnShareBps: 9000n, setupShareBps: 500n })
let wallet = { sol: 100n * UNIT, shares: 0n }
let totals = { burn: 0n, curation: 0n, setup: 0n }
const content = { film: 0n, essay: 0n }
let ready = false
let mode = 'mint'
let quote
let epoch = 100n
let pendingRates

function getQuote() {
  const value = parseUnits($('amount').value.trim())
  if (value > (mode === 'mint' ? wallet.sol : wallet.shares)) {
    throw new Error(`Insufficient demo ${mode === 'mint' ? 'SOL' : 'NOTE'}`)
  }
  return { mint: quoteMint, redeem: quoteRedeem, transfer: quoteTransfer }[mode](
    pool, value, config, true)
}

function render() {
  text('backing', formatUnits(pool.backing))
  text('supply', formatUnits(pool.supply))
  text('nav', pool.supply ? formatUnits(pool.backing * UNIT / pool.supply) : '1.000000')
  text('nav-caption', pool.supply ? 'Backing ÷ current supply' : 'Initial issue rate')
  text('burned', formatUnits(totals.burn))
  text('position', formatUnits(wallet.shares))
  text('sol-balance', formatUnits(wallet.sol))
  let redeemable = 0n
  if (wallet.shares) {
    try { redeemable = quoteRedeem(pool, wallet.shares, config).received } catch { /* dust */ }
  }
  text('position-sol', `${formatUnits(redeemable)} SOL after the redemption fee`)
  text('curator-total', `${formatUnits(totals.curation)} NOTE`)
  text('setup-total', `${formatUnits(totals.setup)} NOTE`)
  for (const key of ['film', 'essay']) text(`${key}-budget`, `${formatUnits(content[key])} NOTE`)
  text('amount-label', mode === 'mint' ? 'YOU DEPOSIT' : mode === 'redeem' ? 'YOU REDEEM' : 'YOU SEND TO DEMO RECIPIENT')
  text('available', `Available: ${formatUnits(mode === 'mint' ? wallet.sol : wallet.shares, 4)} ${mode === 'mint' ? 'SOL' : 'NOTE'}`)
  text('input-unit', mode === 'mint' ? 'SOL' : 'NOTE')
  text('output-unit', mode === 'redeem' ? 'SOL' : 'NOTE')
  text('receive-label', mode === 'transfer' ? 'RECIPIENT RECEIVES' : 'YOU RECEIVE')
  text('fee-label', `${mode === 'mint' ? 'Mint' : mode === 'redeem' ? 'Redemption' : 'Transfer'} fee · ${Number(config[mode === 'mint' ? 'mintBps' : mode === 'redeem' ? 'redeemBps' : 'transferBps']) / 100}%`)
  text('execute', `Simulate ${mode === 'redeem' ? 'redemption' : mode === 'transfer' ? 'send' : 'mint'} →`)
  $('first-action').hidden = ready
  try {
    quote = getQuote()
    text('received', formatUnits(quote.received))
    text('fee', `${formatUnits(quote.fee)} NOTE`)
    text('quote-burn', `${formatUnits(quote.split.burn)} NOTE`)
    text('quote-curation', `${formatUnits(quote.split.curation)} NOTE`)
    text('quote-setup', `${formatUnits(quote.split.setup)} NOTE`)
    text('quote-error', '')
    $('execute').disabled = false
  } catch (error) {
    quote = undefined
    for (const id of ['received', 'fee', 'quote-burn', 'quote-curation', 'quote-setup']) text(id, '—')
    text('quote-error', error.message)
    $('execute').disabled = true
  }
}

function setMode(nextMode) {
  mode = nextMode
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-selected', String(button.dataset.mode === mode))
    button.tabIndex = button.dataset.mode === mode ? 0 : -1
  }
  $('trade-panel').setAttribute('aria-labelledby', `${mode}-tab`)
  render()
}
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => setMode(button.dataset.mode))
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const modes = ['mint', 'redeem', 'transfer']
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2
      : (modes.indexOf(mode) + (event.key === 'ArrowRight' ? 1 : 2)) % 3
    setMode(modes[index])
    $(`${mode}-tab`).focus()
  })
}
$('amount').addEventListener('input', render)
$('execute').addEventListener('click', () => {
  if (!quote) return
  const current = getQuote()
  const intentId = crypto.randomUUID()
  book.begin({ creator, intentId, actorId: 'demo-supporter',
    actionFingerprint: JSON.stringify([mode, current.input.toString(), $('attribution').value]) })
  if (!ready) {
    book.markReady(creator, UNIT)
    ready = true
    text('status', 'Creator pool initialized. Your original action completed. Profile remains unclaimed.')
  } else text('status', 'Action completed in the local simulation.')
  if (!book.complete(intentId)) return
  if (mode === 'mint') wallet = { sol: wallet.sol - current.input, shares: wallet.shares + current.received }
  else if (mode === 'redeem') wallet = { sol: wallet.sol + current.received, shares: wallet.shares - current.input }
  else wallet = { sol: wallet.sol, shares: wallet.shares - current.input }
  pool = current.next
  totals = { burn: totals.burn + current.split.burn,
    curation: totals.curation + current.split.curation, setup: totals.setup + current.split.setup }
  const attribution = $('attribution').value
  if (Object.hasOwn(content, attribution)) content[attribution] += current.split.curation
  const entry = document.createElement('li')
  entry.textContent = `${mode === 'mint' ? 'Minted' : mode === 'redeem' ? 'Received' : 'Sent net'} ${formatUnits(current.received)} ${mode === 'redeem' ? 'SOL' : 'NOTE'} · ${attribution ? 'content credited' : 'creator-level support'}`
  $('activity').prepend(entry)
  render()
})
for (const button of document.querySelectorAll('[data-content]')) {
  button.addEventListener('click', () => {
    $('attribution').value = button.dataset.content
    setMode('mint')
    $('amount').focus()
  })
}
$('claimed').addEventListener('change', () => {
  $('save-rates').disabled = !$('claimed').checked
  text('claim-state', $('claimed').checked ? 'VERIFIED · SIMULATED CLAIM' : 'UNCLAIMED PROFILE')
})
$('rates-form').addEventListener('submit', (event) => {
  event.preventDefault()
  try {
    const values = new FormData(event.target)
    const rates = Object.fromEntries(['mint', 'redeem', 'transfer'].map((name) => [
      `${name === 'redeem' ? 'redeem' : name}Bps`, parseUnits(values.get(name)) / 10_000_000n]))
    pendingRates = scheduleRates({ claimed: $('claimed').checked, current: config,
      rates, caps: { mintBps: 1000n, redeemBps: 1000n, transferBps: 1000n }, epoch })
    text('rate-status', `Rates scheduled for epoch ${pendingRates.effectiveEpoch}. Current rates remain active.`)
  } catch (error) { text('rate-status', error.message) }
})
$('advance-epoch').addEventListener('click', () => {
  epoch += 1n
  if (pendingRates && epoch >= pendingRates.effectiveEpoch) {
    config = pendingRates.config
    pendingRates = undefined
  }
  text('rate-status', `Epoch ${epoch} · ${pendingRates ? `new rates activate at ${pendingRates.effectiveEpoch}` : 'current rates active'}`)
  render()
})
$('reset').addEventListener('click', () => location.reload())
setMode('mint')
