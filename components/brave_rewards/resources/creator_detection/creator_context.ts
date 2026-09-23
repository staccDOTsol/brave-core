// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

interface DetectedCreator {
  id: string
  name: string
}

export interface CreatorContext {
  version: 1
  platform: string
  namespace: string | null
  providerId: string | null
  alias: string | null
  identityStatus: 'provider-id' | 'needs-provider-resolution'
  claimStatus: 'unverified'
  content: { providerId: string; associationStatus: 'unverified' } | null
}

const providers: Record<string, { hosts: string[]; pattern: RegExp }> = {
  youtube: { hosts: ['youtube.com'], pattern: /^UC[A-Za-z0-9_-]{22}$/ },
  twitter: { hosts: ['twitter.com', 'x.com'], pattern: /^[1-9][0-9]{0,19}$/ },
  reddit: { hosts: ['reddit.com'], pattern: /^[a-z0-9]{1,20}$/ },
  vimeo: { hosts: ['vimeo.com'], pattern: /^[1-9][0-9]{0,19}$/ },
  twitch: { hosts: ['twitch.tv'], pattern: /^[A-Za-z0-9_]{1,25}$/ },
}

function contentId(platform: string, url: URL): string | null {
  const path = url.pathname
  if (platform === 'youtube') {
    const id = path === '/watch' ? url.searchParams.get('v')
      : path.match(/^\/(?:shorts|live)\/([^/]+)\/?$/)?.[1]
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  }
  if (platform === 'twitter') {
    return path.match(/^\/[^/]+\/status\/([1-9][0-9]{0,19})(?:\/|$)/)?.[1] ?? null
  }
  if (platform === 'reddit') {
    return path.match(/^\/(?:r|user)\/[^/]+\/comments\/([a-z0-9]+)(?:\/|$)/)?.[1] ?? null
  }
  if (platform === 'vimeo') {
    return path.match(/^\/([1-9][0-9]{0,19})\/?$/)?.[1] ?? null
  }
  if (platform === 'twitch') {
    return path.match(/^\/videos\/([1-9][0-9]{0,19})\/?$/)?.[1] ?? null
  }
  return null
}

// Page metadata is an observation, never a claim proof or authorization to pay.
// No URL, tracking parameters, avatar URL or browsing history leaves this bridge.
export function makeCreatorContext(
  creator: DetectedCreator | null,
  pageURL: string,
): CreatorContext | null {
  if (!creator || typeof creator.id !== 'string' || creator.id.length > 128) {
    return null
  }
  const match = creator.id.match(/^([a-z]+)#(channel|author):(.+)$/)
  if (!match) return null
  const [, platform, kind, value] = match
  if (!Object.hasOwn(providers, platform)) return null
  const provider = providers[platform]
  if (!provider || !provider.pattern.test(value)) return null
  if (kind !== (platform === 'twitch' ? 'author' : 'channel')) return null
  let url: URL
  try { url = new URL(pageURL) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  if (!provider.hosts.some((host) => url.hostname === host
    || url.hostname.endsWith(`.${host}`))) return null

  // Brave's current Twitch detector supplies the login name, not its numeric ID.
  // Resolve it through the provider before reserving a fundable namespace.
  const unresolved = platform === 'twitch'
  const providerId = unresolved ? null : value
  const detectedContent = contentId(platform, url)
  return {
    version: 1,
    platform,
    namespace: providerId ? JSON.stringify([platform, providerId]) : null,
    providerId,
    alias: unresolved ? value.toLowerCase() : null,
    identityStatus: unresolved ? 'needs-provider-resolution' : 'provider-id',
    claimStatus: 'unverified',
    content: detectedContent
      ? { providerId: detectedContent, associationStatus: 'unverified' } : null,
  }
}
