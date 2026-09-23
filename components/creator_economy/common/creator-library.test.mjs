// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_LIBRARY, creatorFromURL, contentFromURL, followCreator,
  curateContent, removeCreator, readLibrary,
} from '../../brave_wallet_ui/common/creator-economy/creator-library.ts'

test('profile aliases are canonicalized without inventing stable identities', () => {
  const creator = creatorFromURL('https://twitter.com/Example?ref=tracking')
  assert.equal(creator.url, 'https://x.com/example')
  assert.equal(creator.namespace, null)
  assert.deepEqual(creator, creatorFromURL('https://x.com/example/'))
  const channel = 'UCabcdefghijklmnopqrstuv'
  assert.equal(creatorFromURL(`https://youtube.com/channel/${channel}`).namespace,
    JSON.stringify(['youtube', channel]))
  assert.equal(creatorFromURL('https://twitch.tv/Example').namespace, null)
})

test('unsafe URLs and platform content pages cannot masquerade as profiles', () => {
  for (const value of ['javascript:alert(1)', 'http://example.com',
    'https://name:password@example.com', 'https://example.com:8443/',
    'https://127.0.0.1/', 'https://[::1]/', 'https://youtube.com/watch?v=abcdefghijk',
    'https://x.com/home', 'https://twitch.tv/videos', 'https://x.com/name/status/123']) {
    assert.equal(creatorFromURL(value), null, value)
  }
})

test('following is idempotent and unfollow removes dependent curations', () => {
  const creator = creatorFromURL('https://vimeo.com/user123')
  const followed = followCreator(EMPTY_LIBRARY, creator)
  assert.equal(followCreator(followed, creator), followed)
  const saved = curateContent(followed, creator.url, 'https://vimeo.com/987#comment')
  assert.equal(saved.content[0].url, 'https://vimeo.com/987')
  assert.equal(curateContent(saved, creator.url, 'https://vimeo.com/987'), saved)
  assert.deepEqual(removeCreator(saved, creator.url), EMPTY_LIBRARY)
  assert.throws(() => curateContent(EMPTY_LIBRARY, creator.url, 'https://vimeo.com/987'))
})

test('content attribution is per creator and preserves YouTube video identity', () => {
  const one = creatorFromURL('https://youtube.com/@creator_one')
  const two = creatorFromURL('https://youtube.com/@creator_two')
  let library = followCreator(followCreator(EMPTY_LIBRARY, one), two)
  const url = 'https://youtube.com/watch?v=abcdefghijk&utm_source=test#comments'
  library = curateContent(curateContent(library, one.url, url), two.url, url)
  assert.equal(library.content.length, 2)
  assert.equal(contentFromURL(url), 'https://youtube.com/watch?v=abcdefghijk')
})

test('persisted claims and entitlements are discarded; malformed data cannot crash the wallet', () => {
  const untrusted = JSON.stringify({ version: 1,
    creators: [{ url: 'https://x.com/example', namespace: 'admin', claimed: true, balance: '100' }],
    content: [{ url: 'javascript:alert(1)', creatorURL: 'https://x.com/example' }],
    privateKey: 'never-a-supported-field',
  })
  const restored = readLibrary(untrusted)
  assert.deepEqual(restored, followCreator(EMPTY_LIBRARY, creatorFromURL('https://x.com/example')))
  for (const value of ['bad', 'null', '{"version":2}', '{"version":1,"creators":[],"content":[null]}']) {
    assert.deepEqual(readLibrary(value), EMPTY_LIBRARY)
  }
})
