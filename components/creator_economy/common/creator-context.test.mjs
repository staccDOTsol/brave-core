// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { makeCreatorContext } from '../../brave_rewards/resources/creator_detection/creator_context.ts'

// Resolve Brave's extensionless TS imports without installing Chromium tooling.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/creator_detection.ts')
      && ['./helpers', './creator_context'].includes(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})
const { initializeDetector } = await import('../../brave_rewards/resources/creator_detection/creator_detection.ts')

const youtube = { id: 'youtube#channel:UCabcdefghijklmnopqrstuv', name: 'Example' }

test('creator namespace survives handles and separates content under one pool', () => {
  const first = makeCreatorContext(youtube, 'https://www.youtube.com/watch?v=abcdefghijk&tracking=private')
  const renamed = makeCreatorContext({ ...youtube, name: 'Renamed' }, 'https://m.youtube.com/shorts/lmnopqrstuv')
  assert.equal(first.namespace, renamed.namespace)
  assert.notEqual(first.content.providerId, renamed.content.providerId)
  assert.equal(first.claimStatus, 'unverified')
  assert.equal(first.content.associationStatus, 'unverified')
  assert(!JSON.stringify(first).includes('tracking'))
})

test('host lookalikes, credentials and cross-platform observations are rejected', () => {
  for (const url of ['https://youtube.com.example.org/watch?v=abcdefghijk',
    'https://fake-youtube.com/watch?v=abcdefghijk', 'http://youtube.com/',
    'https://secret:password@youtube.com/', 'https://youtube.com:444/',
    'https://x.com/example', 'not a URL']) {
    assert.equal(makeCreatorContext(youtube, url), null)
  }
})

test('X aliases share numeric identity while post attribution stays unverified', () => {
  const creator = { id: 'twitter#channel:123456789', name: 'oldhandle' }
  const first = makeCreatorContext(creator, 'https://twitter.com/oldhandle/status/555')
  const second = makeCreatorContext(creator, 'https://x.com/newhandle/status/556')
  assert.equal(first.namespace, second.namespace)
  assert.equal(first.content.providerId, '555')
  assert.equal(second.content.providerId, '556')
  assert.equal(second.content.associationStatus, 'unverified')
})

test('Twitch handles cannot become permanent funded namespaces', () => {
  const context = makeCreatorContext({ id: 'twitch#author:SomeCreator', name: 'Some Creator' },
    'https://www.twitch.tv/videos/123456')
  assert.equal(context.identityStatus, 'needs-provider-resolution')
  assert.equal(context.alias, 'somecreator')
  assert.equal(context.providerId, null)
  assert.equal(context.namespace, null)
  assert.equal(context.content.providerId, '123456')
})

test('Reddit and Vimeo preserve their detector provider IDs', () => {
  const reddit = makeCreatorContext({ id: 'reddit#channel:abc12', name: 'reader' },
    'https://old.reddit.com/user/reader/comments/qwerty/title/')
  const vimeo = makeCreatorContext({ id: 'vimeo#channel:321', name: 'film' }, 'https://vimeo.com/9876')
  assert.equal(reddit.providerId, 'abc12')
  assert.equal(reddit.content.providerId, 'qwerty')
  assert.equal(vimeo.providerId, '321')
  assert.equal(vimeo.content.providerId, '9876')
})

test('missing, malformed and handle-only IDs do not create false stable identities', () => {
  for (const creator of [null, {}, { id: 'youtube#channel:@someone' },
    { id: 'twitter#channel:somehandle' }, { id: 'twitch#channel:someone' },
    { id: 'unknown#channel:123' }, { id: 'constructor#channel:123' }]) {
    assert.equal(makeCreatorContext(creator, 'https://youtube.com/'), null)
  }
  assert.equal(makeCreatorContext(youtube, 'https://youtube.com/@someone').content, null)
})

test('bridge runs on explicit request and preserves Rewards URL deduplication', async () => {
  const previousSelf = globalThis.self
  const previousLocation = globalThis.location
  try {
    globalThis.self = {}
    globalThis.location = { href: 'https://youtube.com/watch?v=abcdefghijk' }
    let calls = 0
    initializeDetector(() => async () => { calls++; return youtube })
    assert.equal(calls, 0)
    assert.equal((await self.braveRewards.detectCreator()).id, youtube.id)
    assert.equal(await self.braveRewards.detectCreator(), null)
    assert.equal(calls, 1)
    assert.equal((await self.braveCreatorEconomy.detectContext()).providerId,
      'UCabcdefghijklmnopqrstuv')
    assert.equal(calls, 2)
    assert.equal(await self.braveRewards.detectCreator(), null)
  } finally {
    globalThis.self = previousSelf
    globalThis.location = previousLocation
  }
})

test('navigation during detection discards the old page identity', async () => {
  const previousSelf = globalThis.self
  const previousLocation = globalThis.location
  try {
    globalThis.self = {}
    globalThis.location = { href: 'https://youtube.com/watch?v=abcdefghijk' }
    initializeDetector(() => async () => {
      location.href = 'https://youtube.com/watch?v=lmnopqrstuv'
      return youtube
    })
    assert.equal(await self.braveCreatorEconomy.detectContext(), null)
  } finally {
    globalThis.self = previousSelf
    globalThis.location = previousLocation
  }
})
