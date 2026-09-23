// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessCapacity, MIN_DISK_BYTES, MIN_RAM_BYTES } from './native-capacity.mjs'

const runner = { target: 'windows', platform: 'win32', configuration: 'Component',
  freeBytes: 213 * 1024 ** 3, ramBytes: 15.9 * 1024 ** 3, cpus: 4 }

test('nominal 16 GB Windows runner passes without rounding RAM down to 15', () => {
  const result = assessCapacity(runner)
  assert.deepEqual(result.errors, [])
  assert.equal(result.jobs, 4)
})

test('documented minimum is inclusive in bytes, with bounded parallelism', () => {
  const result = assessCapacity({ ...runner, freeBytes: MIN_DISK_BYTES,
    ramBytes: MIN_RAM_BYTES, cpus: 64 })
  assert.deepEqual(result.errors, [])
  assert.equal(result.jobs, 2)
  assert.equal(assessCapacity({ ...runner, freeBytes: MIN_DISK_BYTES - 1 }).errors.length, 1)
  assert.equal(assessCapacity({ ...runner, ramBytes: MIN_RAM_BYTES - 1 }).errors.length, 1)
})

test('observed Linux disk and Apple RAM shortages still fail', () => {
  const linux = assessCapacity({ ...runner, target: 'android', platform: 'linux',
    freeBytes: 79 * 1024 ** 3 })
  assert.deepEqual(linux.errors, ['disk below 100 GB minimum'])
  const apple = assessCapacity({ ...runner, target: 'ios', platform: 'darwin',
    freeBytes: 89 * 1024 ** 3, ramBytes: 7 * 1024 ** 3 })
  assert.equal(apple.errors.length, 2)
})

test('invalid targets, host mismatches and unreadable measurements are rejected', () => {
  assert.throws(() => assessCapacity({ ...runner, target: 'other' }))
  assert.throws(() => assessCapacity({ ...runner, configuration: 'Other' }))
  assert.throws(() => assessCapacity({ ...runner, platform: 'linux' }))
  assert.throws(() => assessCapacity({ ...runner, freeBytes: NaN }))
  assert.throws(() => assessCapacity({ ...runner, cpus: 0 }))
})
