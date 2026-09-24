// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { POLICY, uint } from './policy.mjs'

export const json = value => JSON.stringify(value,
  (_, v) => typeof v === 'bigint' ? v.toString() : v)

export class Ledger {
  constructor(file, config) {
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS identity (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS credits (id TEXT PRIMARY KEY, amount TEXT NOT NULL,
        evidence TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, amount TEXT NOT NULL,
        stage TEXT NOT NULL, data TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active ON batches((1))
        WHERE stage != 'delivered';
      CREATE TABLE IF NOT EXISTS receipts (tx TEXT PRIMARY KEY, batch TEXT NOT NULL);`)
    const identity = json({ policy: POLICY.version, source: config.feeDistributor,
      sol: config.solTreasury, evm: config.evmReceiver, fanout: POLICY.fanout })
    this.db.prepare('INSERT OR IGNORE INTO identity VALUES (1, ?)').run(identity)
    assert.equal(this.db.prepare('SELECT value FROM identity WHERE id=1').get().value,
      identity, 'Ledger belongs to a different treasury or policy')
  }

  atomic(fn) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }

  credit(receipt) {
    assert(uint(receipt.lamports) > 0n)
    const evidence = json(receipt)
    this.atomic(() => {
      const old = this.db.prepare('SELECT * FROM credits WHERE id=?').get(receipt.id)
      if (old) assert.equal(old.evidence, evidence, 'Conflicting payout receipt')
      else this.db.prepare('INSERT INTO credits VALUES (?, ?, ?)')
        .run(receipt.id, receipt.lamports, evidence)
    })
  }

  available() {
    const sum = table => this.db.prepare(`SELECT amount FROM ${table}`).all()
      .reduce((n, row) => n + uint(row.amount), 0n)
    return sum('credits') - sum('batches')
  }

  active() {
    const row = this.db.prepare("SELECT * FROM batches WHERE stage != 'delivered'").get()
    return row ? { ...row, data: JSON.parse(row.data) } : null
  }

  reserve(config) {
    return this.atomic(() => {
      const existing = this.active()
      if (existing) return existing
      const available = this.available()
      if (available < uint(config.minBatchLamports)) return null
      const amount = (available < uint(config.maxBatchLamports)
        ? available : uint(config.maxBatchLamports)).toString()
      const id = randomUUID()
      this.db.prepare('INSERT INTO batches VALUES (?, ?, ?, ?)')
        .run(id, amount, 'reserved', '{}')
      return this.active()
    })
  }

  transition(batch, nextStage, patch = {}, receiptHash) {
    return this.atomic(() => {
      const current = this.active()
      // A competing worker may already have advanced the same immutable job.
      if (!current || current.id !== batch.id || current.stage !== batch.stage) {
        return false
      }
      if (receiptHash) {
        this.db.prepare('INSERT INTO receipts VALUES (?, ?)').run(receiptHash, batch.id)
      }
      this.db.prepare('UPDATE batches SET stage=?, data=? WHERE id=?')
        .run(nextStage, json({ ...current.data, ...patch }), batch.id)
      return true
    })
  }

  summary() {
    return { availableLamports: this.available().toString(),
      batches: this.db.prepare('SELECT id, amount, stage FROM batches').all() }
  }

  close() { this.db.close() }
}
