// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

const source = new URL('../../../build/commands/lib/repositories.ts', import.meta.url)
// Parsing must be testable before downloading Chromium or installing build dependencies.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === source.href && specifier === './config.ts') {
      return { url: 'data:text/javascript,export default {}', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
const { parsePatchedRepositories } = await import(source.href)
hooks.deregister()

for (const eol of ['\n', '\r\n']) {
  test(`native repository list accepts comments with ${JSON.stringify(eol)} endings`, () => {
    const contents = ['# Copyright header', '', '// # Chromium', '//v8',
      '  # disabled repository', '//third_party/ffmpeg # dependency', ''].join(eol)
    assert.deepEqual(parsePatchedRepositories(contents, 'repos.cfg'),
      ['', 'v8', 'third_party/ffmpeg'])
    assert.throws(() => parsePatchedRepositories(
      ['# header', '//', 'v8'].join(eol), 'repos.cfg'), /repos.cfg:3:.*source-absolute/)
  })
}
