// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import assert from 'node:assert/strict'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { createPublicClient, http, parseAbi, decodeEventLog, encodeFunctionData,
  keccak256, parseTransaction, recoverTransactionAddress } from 'viem'
import { POLICY, sameEvm, uint } from './policy.mjs'
import { quoteRequest, relayRequest, validateQuote } from './relay.mjs'

const tokenAbi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])
const fanoutAbi = parseAbi([
  'function tokenCount() view returns (uint256)',
  'function collection() view returns (address)',
])

export function payoutCredits(tx, signature, config) {
  assert(tx && tx.meta && tx.meta.err === null, 'Payout must be finalized and successful')
  const credits = []
  const inspect = (ix, index) => {
    if (ix.programId?.toString() !== POLICY.sol || ix.parsed?.type !== 'transfer') return
    const p = ix.parsed.info
    if (p.source !== config.feeDistributor || p.destination !== config.solTreasury) return
    assert(Number.isSafeInteger(p.lamports) && p.lamports > 0,
      'Unsafe RPC transfer amount')
    credits.push({ id: `${signature}:${index}`, signature, instruction: index,
      slot: tx.slot, source: p.source, recipient: p.destination,
      lamports: String(p.lamports), allocation: POLICY.version })
  }
  tx.transaction.message.instructions.forEach((ix, i) => inspect(ix, String(i)))
  for (const group of tx.meta.innerInstructions ?? []) {
    group.instructions.forEach((ix, i) => inspect(ix, `${group.index}.${i}`))
  }
  assert(credits.length > 0, 'No payout from the configured deployer-only distributor')
  return credits
}

export function receivedWeth(receipt, recipient, from) {
  assert.equal(receipt.status, 'success', 'Destination transaction reverted')
  let net = 0n
  for (const log of receipt.logs) {
    if (!sameEvm(log.address, POLICY.weth)) continue
    let event
    try { event = decodeEventLog({ abi: tokenAbi, ...log }) } catch { continue }
    if (event.eventName !== 'Transfer') continue
    const a = event.args
    if (sameEvm(a.to, recipient) && (!from || sameEvm(a.from, from))) net += a.value
    if (sameEvm(a.from, recipient)) net -= a.value
  }
  return net
}

export class Chains {
  constructor(config, privy) {
    this.config = config
    this.privy = privy
    this.sol = new Connection(config.solRpc, 'finalized')
    this.evm = createPublicClient({ transport: http(config.evmRpc,
      { timeout: 20_000, retryCount: 1 }) })
  }

  async preflight(signing = false) {
    const c = this.config
    assert.equal(await this.sol.getGenesisHash(), POLICY.solanaGenesis)
    assert.equal(await this.evm.getChainId(), POLICY.destinationChainId)
    assert.equal(await this.evm.readContract({ address: POLICY.fanout,
      abi: fanoutAbi, functionName: 'tokenCount' }), POLICY.shares)
    assert(sameEvm(await this.evm.readContract({ address: POLICY.fanout,
      abi: fanoutAbi, functionName: 'collection' }), POLICY.collection))
    const code = await this.evm.getCode({ address: c.evmReceiver })
    assert(!code || code === '0x', 'Settlement receiver must be an ordinary wallet')
    if (signing) {
      for (const [id, address, chain] of [
        [c.solWalletId, c.solTreasury, 'solana'],
        [c.evmWalletId, c.evmReceiver, 'ethereum'],
      ]) {
        const wallet = await this.privy.wallets().get(id)
        assert.equal(wallet.chain_type, chain)
        assert(chain === 'solana' ? wallet.address === address
          : sameEvm(wallet.address, address), 'Privy wallet/address mismatch')
      }
    }
  }

  async payout(signature) {
    assert(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature), 'Invalid Solana signature')
    const tx = await this.sol.getParsedTransaction(signature,
      { commitment: 'finalized', maxSupportedTransactionVersion: 0 })
    return payoutCredits(tx, signature, this.config)
  }

  async quote(lamports) {
    const { chains } = await relayRequest('/chains')
    const q = await relayRequest('/quote/v2', quoteRequest(this.config, lamports))
    const checked = validateQuote(q, this.config, lamports, chains)
    return { q, chains, checked }
  }

  async prepareBridge(batch) {
    const c = this.config
    const { q, chains, checked } = await this.quote(batch.amount)
    const latest = await this.sol.getLatestBlockhash('finalized')
    const tx = new Transaction({ feePayer: new PublicKey(c.solTreasury), ...latest })
      .add(checked.instruction)
    const fee = (await this.sol.getFeeForMessage(tx.compileMessage(), 'finalized')).value
    assert(Number.isSafeInteger(fee) && BigInt(fee) <= uint(c.maxSolFeeLamports),
      'Solana gas exceeds limit')
    const balance = await this.sol.getBalance(new PublicKey(c.solTreasury), 'finalized')
    assert(Number.isSafeInteger(balance))
    assert(BigInt(balance) >= uint(batch.amount) + BigInt(fee) + uint(c.solReserveLamports),
      'Treasury needs its separate gas reserve')
    const unsigned = tx.serialize({ requireAllSignatures: false }).toString('base64')
    return { quote: q, chains, unsigned, ...latest, preparedAt: Date.now(),
      requestId: checked.requestId, minimumWeth: checked.minimumWeth,
      deadline: checked.deadline }
  }

  async signBridge(batch) {
    const p = batch.data.bridge
    assert(Date.now() - p.preparedAt < 90_000, 'Prepared quote is stale')
    assert(Date.now() + 15_000 < p.deadline * 1000, 'Order expired before signing')
    const checked = validateQuote(p.quote, this.config, batch.amount, p.chains)
    const original = Transaction.from(Buffer.from(p.unsigned, 'base64'))
    const expected = new Transaction({ feePayer: new PublicKey(this.config.solTreasury),
      recentBlockhash: p.blockhash }).add(checked.instruction)
    assert.deepEqual(original.serializeMessage(), expected.serializeMessage(),
      'Prepared transaction differs from the validated order')
    assert(await this.sol.getBlockHeight('finalized') <= p.lastValidBlockHeight,
      'Solana blockhash expired before signing')
    const response = await this.privy.wallets().solana().signTransaction(
      this.config.solWalletId, {
        transaction: p.unsigned, authorization_context: this.config.authorizationContext,
        idempotency_key: `faircreators:${batch.id}:sol`,
      })
    assert.equal(response.encoding, 'base64')
    const signed = Transaction.from(Buffer.from(response.signed_transaction, 'base64'))
    assert.deepEqual(signed.serializeMessage(), original.serializeMessage(),
      'Signer changed the prepared transaction')
    assert(signed.verifySignatures())
    // web3.js does not export a base58 encoder; encode the public signature only.
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let n = BigInt(`0x${signed.signature.toString('hex')}`), hash = ''
    while (n) { hash = alphabet[Number(n % 58n)] + hash; n /= 58n }
    for (const byte of signed.signature) { if (byte !== 0) break; hash = `1${hash}` }
    return { raw: signed.serialize().toString('base64'), hash }
  }

  async bridgeStatus(batch) {
    const { solSigned, bridge } = batch.data
    const status = (await this.sol.getSignatureStatuses([solSigned.hash],
      { searchTransactionHistory: true })).value[0]
    if (status?.err) return { review: 'Solana deposit failed; reconcile before retrying' }
    if (status?.confirmationStatus !== 'finalized') {
      if (!status && await this.sol.getBlockHeight('finalized') > bridge.lastValidBlockHeight) {
        return { review: 'Expired or unobserved deposit; do not sign a replacement automatically' }
      }
      return { pending: true, broadcast: !status }
    }
    const result = await relayRequest(`/intents/status/v3?requestId=${bridge.requestId}`)
    if (['failure', 'refund'].includes(result.status)) {
      return { review: `Relay ${result.status}; funds remain reserved until reconciled` }
    }
    if (result.status !== 'success') return { pending: true, broadcast: false }
    assert.equal(result.originChainId, POLICY.originChainId)
    assert.equal(result.destinationChainId, POLICY.destinationChainId)
    assert(result.inTxHashes?.includes(solSigned.hash), 'Origin receipt mismatch')
    // One recipient and one output payment are accepted. A split fill needs a
    // reviewed reconciliation rather than guessing which amounts belong here.
    assert.equal(result.txHashes?.length, 1, 'Unexpected fill receipt count')
    const receipt = await this.confirmedReceipt(result.txHashes[0])
    if (!receipt) return { pending: true, broadcast: false }
    const amount = receivedWeth(receipt, this.config.evmReceiver)
    assert(amount >= uint(bridge.minimumWeth), 'Fill below committed minimum')
    return { hash: receipt.transactionHash, amount: amount.toString() }
  }

  async broadcastBridge(batch) {
    const hash = await this.sol.sendRawTransaction(
      Buffer.from(batch.data.solSigned.raw, 'base64'),
      { skipPreflight: false, preflightCommitment: 'finalized', maxRetries: 0 })
    assert.equal(hash, batch.data.solSigned.hash)
  }

  async confirmedReceipt(hash) {
    const receipt = await this.evm.getTransactionReceipt({ hash }).catch(e => {
      if (e.name === 'TransactionReceiptNotFoundError') return null
      throw e
    })
    if (!receipt) return null
    const head = await this.evm.getBlockNumber()
    if (head - receipt.blockNumber + 1n < BigInt(this.config.evmConfirmations)) return null
    assert.equal((await this.evm.getBlock({ blockNumber: receipt.blockNumber })).hash,
      receipt.blockHash, 'Destination receipt reorged')
    return receipt
  }

  async prepareForward(batch) {
    const c = this.config, amount = uint(batch.data.fill.amount)
    assert(await this.evm.readContract({ address: POLICY.weth, abi: tokenAbi,
      functionName: 'balanceOf', args: [c.evmReceiver] }) >= amount)
    const data = encodeFunctionData({ abi: tokenAbi, functionName: 'transfer',
      args: [POLICY.fanout, amount] })
    const nonce = await this.evm.getTransactionCount({ address: c.evmReceiver, blockTag: 'pending' })
    assert.equal(nonce, await this.evm.getTransactionCount({ address: c.evmReceiver }),
      'Settlement wallet has another pending transaction')
    const gas = await this.evm.estimateGas({ account: c.evmReceiver,
      to: POLICY.weth, data, value: 0n }) * 125n / 100n
    // A legacy transaction fixes the maximum price for an idempotent replay.
    const gasPrice = await this.evm.getGasPrice() * 125n / 100n
    assert(gas * gasPrice <= uint(c.maxEvmFeeWei), 'Robinhood gas exceeds limit')
    assert(await this.evm.getBalance({ address: c.evmReceiver }) >= gas * gasPrice,
      'Settlement wallet needs Robinhood ETH for gas')
    return { chainId: POLICY.destinationChainId, to: POLICY.weth, data,
      value: '0', nonce, gas: gas.toString(), gasPrice: gasPrice.toString() }
  }

  async signForward(batch) {
    const p = batch.data.forward
    assert.equal(p.chainId, POLICY.destinationChainId)
    assert(sameEvm(p.to, POLICY.weth))
    assert.equal(p.value, '0')
    assert.equal(p.data, encodeFunctionData({ abi: tokenAbi, functionName: 'transfer',
      args: [POLICY.fanout, uint(batch.data.fill.amount)] }))
    assert(uint(p.gas) * uint(p.gasPrice) <= uint(this.config.maxEvmFeeWei))
    const hex = n => `0x${BigInt(n).toString(16)}`
    const { signed_transaction: raw } = await this.privy.wallets().ethereum()
      .signTransaction(this.config.evmWalletId, {
        params: { transaction: { from: this.config.evmReceiver, to: p.to,
          data: p.data, value: hex(p.value), nonce: hex(p.nonce),
          chain_id: p.chainId, gas_limit: hex(p.gas), gas_price: hex(p.gasPrice), type: 0 } },
        authorization_context: this.config.authorizationContext,
        idempotency_key: `faircreators:${batch.id}:evm`,
      })
    assert(sameEvm(await recoverTransactionAddress({ serializedTransaction: raw }),
      this.config.evmReceiver))
    const tx = parseTransaction(raw)
    assert.equal(tx.type, 'legacy')
    assert.equal(tx.chainId, p.chainId)
    assert.equal(tx.nonce, p.nonce)
    assert(sameEvm(tx.to, p.to))
    assert.equal(tx.data, p.data)
    assert.equal(tx.value ?? 0n, uint(p.value))
    assert.equal(tx.gas, uint(p.gas))
    assert.equal(tx.gasPrice, uint(p.gasPrice))
    return { raw, hash: keccak256(raw) }
  }

  async broadcastForward(batch) {
    const hash = await this.evm.sendRawTransaction({ serializedTransaction: batch.data.evmSigned.raw })
    assert.equal(hash, batch.data.evmSigned.hash)
  }

  async forwardStatus(batch) {
    const receipt = await this.confirmedReceipt(batch.data.evmSigned.hash)
    if (!receipt) return { pending: true }
    if (receipt.status !== 'success') return { review: 'WETH forward reverted' }
    assert.equal(receivedWeth(receipt, POLICY.fanout, this.config.evmReceiver),
      uint(batch.data.fill.amount), 'Fanout receipt amount mismatch')
    return { hash: receipt.transactionHash, amount: batch.data.fill.amount }
  }
}
