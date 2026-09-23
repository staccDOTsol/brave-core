// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

const hosts = { linux: 'linux', android: 'linux', macos: 'darwin',
  ios: 'darwin', windows: 'win32' }

// Upstream lists 100 GB disk and 8 GB RAM as the build minimum, with >16 GB
// recommended. Compare bytes, not rounded GiB or the recommendation.
export const MIN_DISK_BYTES = 100 * 1000 ** 3
export const MIN_RAM_BYTES = 8 * 1000 ** 3

export function assessCapacity({ target, configuration, platform, freeBytes,
  ramBytes, cpus }) {
  if (!Object.hasOwn(hosts, target)
      || !['Component', 'Release'].includes(configuration)) {
    throw new Error('Invalid native build target or configuration')
  }
  if (platform !== hosts[target]) throw new Error(`Wrong host OS for ${target}`)
  if (![freeBytes, ramBytes, cpus].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid runner capacity measurement')
  }
  const errors = []
  if (freeBytes < MIN_DISK_BYTES) errors.push('disk below 100 GB minimum')
  if (ramBytes < MIN_RAM_BYTES) errors.push('RAM below 8 GB minimum')
  return {
    freeGiB: Number((freeBytes / 1024 ** 3).toFixed(2)),
    ramGiB: Number((ramBytes / 1024 ** 3).toFixed(2)),
    jobs: Math.max(1, Math.min(Math.floor(cpus), Math.floor(ramBytes / (3 * 1024 ** 3)))),
    errors,
  }
}
