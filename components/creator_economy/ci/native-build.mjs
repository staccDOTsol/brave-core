// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import { statfsSync, writeFileSync, createWriteStream } from 'node:fs'
import { spawn } from 'node:child_process'
import { availableParallelism, totalmem } from 'node:os'

if (process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Native builds run in GitHub CI; no local Chromium build is allowed')
}
const target = process.env.CREATOR_BUILD_TARGET
const configuration = process.env.CREATOR_BUILD_CONFIGURATION
const hostFor = { linux: 'linux', android: 'linux', macos: 'darwin',
  ios: 'darwin', windows: 'win32' }
if (!Object.hasOwn(hostFor, target) || !['Component', 'Release'].includes(configuration)) {
  throw new Error('Invalid native build target or configuration')
}
if (process.platform !== hostFor[target]) throw new Error(`Wrong host OS for ${target}`)
const disk = statfsSync('.')
const freeGiB = Math.floor(disk.bavail * disk.bsize / 1024 ** 3)
const ramGiB = Math.floor(totalmem() / 1024 ** 3)
if (freeGiB < 120 || ramGiB < 16) {
  throw new Error(`Chromium needs a provisioned runner: found ${freeGiB} GiB free, ${ramGiB} GiB RAM; require at least 120/16`)
}
process.stdout.write(`Remote build preflight: ${target}, ${freeGiB} GiB free, ${ramGiB} GiB RAM, ${availableParallelism()} CPUs\n`)
if (process.argv.includes('--preflight')) process.exit(0)

const log = createWriteStream('creator-build.log')
async function run(command, args) {
  process.stdout.write(`Running ${command} ${args.join(' ')}\n`)
  await new Promise((resolve, reject) => {
    // Command and arguments below are fixed; no free-form workflow input is executed.
    const child = spawn(command, args, { shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'] })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => {
      process.stdout.write(data)
      log.write(data)
    })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)))
  })
}
const args = target === 'android' ? ['--target_os=android', '--target_arch=arm64']
  : target === 'ios' ? ['--target_os=ios', `--target_arch=${process.arch === 'arm64' ? 'arm64' : 'x64'}`]
    : []
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const record = { target, configuration, revision: process.env.GITHUB_SHA,
  startedAt: new Date().toISOString(), status: 'started', freeGiB, ramGiB }
writeFileSync('creator-build-record.json', JSON.stringify(record, null, 2))
try {
  await run(pnpm, ['run', 'init', ...args])
  if (process.platform === 'linux') {
    await run('sudo', ['../build/install-build-deps.sh', '--no-prompt',
      ...(target === 'android' ? ['--android'] : [])])
  }
  if (target === 'ios') {
    await run(pnpm, ['run', 'ios_bootstrap'])
    await run('xcodebuild', ['-project', 'ios/brave-ios/App/Client.xcodeproj',
      '-scheme', configuration, '-configuration', configuration === 'Component' ? 'Debug' : 'Release',
      '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
      '-derivedDataPath', '../../out/creator-ios', 'CODE_SIGNING_ALLOWED=NO', 'build'])
  } else await run(pnpm, ['run', 'build', configuration, ...args])
  record.status = 'compiled'
} catch (error) {
  record.status = 'failed'
  record.error = error.message
  process.exitCode = 1
} finally {
  record.finishedAt = new Date().toISOString()
  writeFileSync('creator-build-record.json', JSON.stringify(record, null, 2))
  log.end()
}
