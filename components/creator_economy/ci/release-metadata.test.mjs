// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

test('LASTCHANGE selects the actual fork commit in a depth-one checkout', t => {
  const deps = readFileSync(new URL('../../../DEPS', import.meta.url), 'utf8')
  const filter = deps.match(/'name': 'brave_lastchange',[\s\S]*?'--filter', '([^']+)'/)[1]
  const dir = mkdtempSync(join(tmpdir(), 'faircreators-lastchange-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const source = join(dir, 'source'), checkout = join(dir, 'checkout')
  mkdirSync(source)
  const env = { ...process.env, GIT_AUTHOR_DATE: '2026-09-23T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-09-23T00:00:00Z' }
  const git = (cwd, ...args) => execFileSync('git', args,
    { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git(source, 'init')
  git(source, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
    'commit', '--allow-empty', '-m', '1.98.0')
  git(source, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
    'commit', '--allow-empty', '-m', 'Apply FairCreators branding')
  git(dir, 'clone', '--depth=1', pathToFileURL(source).href, checkout)
  assert.equal(git(checkout, 'rev-list', '--count', 'HEAD'), '1')
  // These are the same git arguments used by Chromium's lastchange.py.
  const result = git(checkout, 'log', '-1', '--format=%H %ct', `--grep=${filter}`, 'HEAD')
  const [revision, timestamp] = result.split(' ')
  assert.equal(revision, git(checkout, 'rev-parse', 'HEAD'))
  assert.equal(Number(timestamp), Date.parse(env.GIT_COMMITTER_DATE) / 1000)
})
