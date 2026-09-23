import { test } from 'node:test'
import assert from 'node:assert/strict'
import { releasePlan, assertReleaseArtifacts } from './release-plan.mjs'

test('iOS releases target physical arm64 devices, never the simulator', () => {
  const plan = releasePlan('ios')
  assert.ok(plan.args.includes('--target_environment=device'))
  assert.ok(plan.args.includes('--target_arch=arm64'))
  assert.ok(!plan.args.some((arg) => arg.includes('simulator')))
})
test('logs and successful compilation cannot satisfy release outputs', () => {
  for (const target of ['ios', 'macos', 'android', 'windows', 'linux']) {
    assert.throws(() => assertReleaseArtifacts(target, ['creator-build.log']))
  }
  assert.throws(() => assertReleaseArtifacts('android', ['FairCreators.apk']))
  assertReleaseArtifacts('android', ['FairCreators.apk', 'FairCreators.aab'])
  assertReleaseArtifacts('ios', ['FairCreators.ipa'])
})
