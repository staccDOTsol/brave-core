import { test } from 'node:test'
import assert from 'node:assert/strict'
import { releasePlan, assertReleaseArtifacts } from './release-plan.mjs'

test('independent releases keep Release optimization without Brave service credentials', () => {
  for (const target of ['ios', 'macos', 'android', 'windows', 'linux']) {
    const { args } = releasePlan(target)
    assert.equal(args[0], 'Release')
    assert.ok(args.includes('brave_require_services_key:false'))
    assert.ok(args.includes(`enable_ai_chat:${target === 'ios' || target === 'android'}`))
    assert.ok(args.includes('enable_brave_ai_chat_service:false'))
    assert.ok(args.includes('enable_brave_speech_to_text:false'))
    assert.ok(!args.some((arg) => arg.startsWith('brave_services_key:')))
    assert.ok(!args.includes('is_official_build:false'))
  }
})

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
