// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import { statfsSync, writeFileSync, createWriteStream, appendFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { availableParallelism, totalmem } from 'node:os'
import { assessCapacity } from './native-capacity.mjs'
import { buildRelease } from './release.mjs'

if (process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Native builds run in GitHub CI; no local Chromium build is allowed')
}
const target = process.env.CREATOR_BUILD_TARGET
const configuration = process.env.CREATOR_BUILD_CONFIGURATION
const preflightOnly = process.argv.includes('--preflight')
const distribution = process.env.CREATOR_BUILD_DISTRIBUTION === 'true'
if (distribution && configuration !== 'Release') throw new Error('Distribution requires Release configuration')
const log = createWriteStream('creator-build.log', { flags: 'a' })
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
  : target === 'ios' ? ['--target_os=ios', `--target_arch=${distribution || process.arch === 'arm64' ? 'arm64' : 'x64'}`]
    : target === 'macos' && distribution ? ['--target_arch=arm64'] : []
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const record = { target, configuration, distribution, workflowRevision: process.env.GITHUB_SHA,
  startedAt: new Date().toISOString(), status: 'started', phase: 'preflight' }
writeFileSync('creator-build-record.json', JSON.stringify(record, null, 2))
try {
  record.revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const disk = statfsSync('.')
  const capacity = assessCapacity({ target, configuration, platform: process.platform,
    freeBytes: disk.bavail * disk.bsize, ramBytes: totalmem(), cpus: availableParallelism() })
  record.capacity = capacity
  const measurement = `${target}: ${capacity.freeGiB} GiB free, ${capacity.ramGiB} GiB RAM, ${capacity.jobs} build jobs`
  process.stdout.write(`${measurement}\n`)
  log.write(`${measurement}\n`)
  if (capacity.errors.length) throw new Error(capacity.errors.join('; '))
  if (preflightOnly) {
    record.status = 'capacity-passed'
  } else {
    if (distribution && target === 'macos') await run('python3', ['components/creator_economy/ci/mac-icon-catalog.py'])
    record.phase = 'initialize'
    writeFileSync('creator-build-record.json', JSON.stringify(record, null, 2))
    await run(pnpm, ['run', 'init', '--no-history', ...args])
    if (process.platform === 'linux') {
      await run('sudo', ['../build/install-build-deps.sh', '--no-prompt',
        ...(target === 'android' ? ['--android'] : [])])
    }
    record.phase = 'compile'
    writeFileSync('creator-build-record.json', JSON.stringify(record, null, 2))
    if (distribution) {
      record.release = await buildRelease({ target, run, pnpm, jobs: capacity.jobs })
    } else if (target === 'ios') {
      await run(pnpm, ['run', 'ios_bootstrap'])
      await run('xcodebuild', ['-project', 'ios/brave-ios/App/Client.xcodeproj',
        '-scheme', configuration, '-configuration', configuration === 'Component' ? 'Debug' : 'Release',
        '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
        '-derivedDataPath', '../../out/creator-ios', 'CODE_SIGNING_ALLOWED=NO', 'build'])
    } else await run(pnpm, ['run', 'build', configuration, ...args,
      '--ninja', `j:${capacity.jobs}`, '--gn', 'symbol_level:0',
      '--gn', 'blink_symbol_level:0', '--gn', 'v8_symbol_level:0'])
    record.status = distribution ? 'packaged' : 'compiled'
  }
} catch (error) {
  record.status = 'failed'
  record.error = error.message
  process.stderr.write(`Native ${record.phase} failed: ${error.message}\n`)
  log.write(`Native ${record.phase} failed: ${error.message}\n`)
  process.exitCode = 1
} finally {
  record.finishedAt = new Date().toISOString()
  writeFileSync('creator-build-record.json', JSON.stringify(record, null, 2))
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### Native build result\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`)
  }
  log.end()
}
