// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

// One step per invocation keeps restart behavior explicit. The runner calls this
// again later. API timeouts never release a reservation or create a new payment.
export async function tick(ledger, chains, config) {
  const batch = ledger.reserve(config)
  if (!batch) return { stage: 'waiting-for-fees' }
  const advance = (stage, patch, receipt) => ledger.transition(batch, stage, patch, receipt)
  switch (batch.stage) {
    case 'reserved':
      advance('bridge-prepared', { bridge: await chains.prepareBridge(batch) })
      break
    case 'bridge-prepared':
      advance('bridge-signed', { solSigned: await chains.signBridge(batch) })
      break
    case 'bridge-signed': {
      const state = await chains.bridgeStatus(batch)
      if (state.review) advance('review', { reason: state.review })
      else if (!state.pending) advance('funded', { fill: state }, state.hash)
      else if (state.broadcast !== false) await chains.broadcastBridge(batch)
      break
    }
    case 'funded':
      advance('forward-prepared', { forward: await chains.prepareForward(batch) })
      break
    case 'forward-prepared':
      advance('forward-signed', { evmSigned: await chains.signForward(batch) })
      break
    case 'forward-signed': {
      const state = await chains.forwardStatus(batch)
      if (state.review) advance('review', { reason: state.review })
      else if (!state.pending) advance('delivered', { delivery: state }, state.hash)
      else await chains.broadcastForward(batch)
      break
    }
    case 'review':
      return { id: batch.id, stage: batch.stage, reason: batch.data.reason }
    default:
      throw new Error(`Unknown settlement stage ${batch.stage}`)
  }
  return ledger.summary()
}
