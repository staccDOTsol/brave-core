// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

function identifier(value) {
  if (typeof value !== 'string' || !value || value.length > 512) {
    throw new TypeError('A stable identifier is required')
  }
  return value
}

/** Stable provider IDs, not mutable handles. This key is not a Solana address. */
export function creatorKey(platform, providerId) {
  return JSON.stringify([identifier(platform), identifier(providerId)])
}

export function contentKey(creator, providerContentId) {
  return JSON.stringify([identifier(creator), identifier(providerContentId)])
}

/**
 * In-memory state machine for a persistent worker/DB implementation.
 * begin() must be a transactional upsert in production; this is not a lock service.
 * Authentication, proof verification and on-chain receipts are adapter boundaries.
 */
export class BootstrapBook {
  #creators = new Map()
  #intents = new Map()
  #repayments = new Map()

  begin({ creator, intentId, actorId, actionFingerprint }) {
    for (const key of [creator, intentId, actorId, actionFingerprint]) identifier(key)
    const prior = this.#intents.get(intentId)
    if (prior) {
      if (prior.creator !== creator || prior.actorId !== actorId
        || prior.actionFingerprint !== actionFingerprint) {
        throw new Error('Intent already belongs to a different action')
      }
      return { intent: { ...prior }, creator: this.getCreator(creator), created: false }
    }
    const created = !this.#creators.has(creator)
    if (created) {
      this.#creators.set(creator, { status: 'provisioning', claimed: false,
        sponsorAdvanced: 0n, sponsorRepaid: 0n })
    }
    const intent = { creator, intentId, actorId, actionFingerprint, status: 'pending' }
    this.#intents.set(intentId, intent)
    return { intent: { ...intent }, creator: this.getCreator(creator), created }
  }

  getCreator(creator) {
    const value = this.#creators.get(creator)
    if (!value) throw new Error('Unknown creator')
    return { ...value }
  }

  markReady(creator, actualSponsorLamports) {
    if (typeof actualSponsorLamports !== 'bigint' || actualSponsorLamports < 0n) {
      throw new RangeError('Invalid setup cost')
    }
    const state = this.getCreator(creator)
    if (state.status === 'ready') {
      if (state.sponsorAdvanced !== actualSponsorLamports) {
        throw new Error('Setup receipt conflicts with the recorded cost')
      }
      return state
    }
    const next = { ...state, status: 'ready', sponsorAdvanced: actualSponsorLamports }
    this.#creators.set(creator, next)
    return { ...next }
  }

  complete(intentId) {
    const intent = this.#intents.get(intentId)
    if (!intent) throw new Error('Unknown intent')
    if (this.getCreator(intent.creator).status !== 'ready') {
      throw new Error('Setup must complete before the original action')
    }
    if (intent.status === 'complete') return false
    this.#intents.set(intentId, { ...intent, status: 'complete' })
    return true
  }

  // Only finalized actual SOL receipts repay SOL debt, not marked LST value.
  repay(creator, netLamports, receiptId) {
    identifier(receiptId)
    const key = JSON.stringify([creator, receiptId])
    if (typeof netLamports !== 'bigint' || netLamports < 0n) {
      throw new RangeError('Invalid repayment')
    }
    const previous = this.#repayments.get(key)
    if (previous) {
      if (previous.netLamports !== netLamports) throw new Error('Conflicting repayment')
      return 0n
    }
    const state = this.getCreator(creator)
    if (state.status !== 'ready') throw new Error('Setup is not ready')
    const debt = state.sponsorAdvanced - state.sponsorRepaid
    const applied = netLamports < debt ? netLamports : debt
    this.#creators.set(creator, { ...state, sponsorRepaid: state.sponsorRepaid + applied })
    this.#repayments.set(key, { netLamports })
    return applied
  }
}
