// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']],
  ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/economics.mjs', ['economics.mjs', 'text/javascript']],
  ['/bootstrap.mjs', ['bootstrap.mjs', 'text/javascript']]
])

createServer(async (req, res) => {
  const file = files.get(req.url)
  if (req.method !== 'GET' || !file) {
    res.writeHead(404).end('Not found')
    return
  }
  try {
    const data = await readFile(new URL(file[0], import.meta.url))
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" })
    res.end(data)
  } catch {
    res.writeHead(500).end('Prototype asset unavailable')
  }
}).listen(4179, '127.0.0.1', () => {
  process.stdout.write('Creator prototype: http://127.0.0.1:4179\n')
})
