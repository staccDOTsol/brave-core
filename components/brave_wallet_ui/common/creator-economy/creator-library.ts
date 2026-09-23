// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

/** A local bookmark is not a verified creator identity, claim, or entitlement. */
export interface CreatorBookmark {
  url: string
  label: string
  platform: string
  namespace: string | null
}

/** Private, device-local curation; payouts require a verified server receipt. */
export interface ContentBookmark {
  creatorURL: string
  url: string
}

export interface CreatorLibrary {
  version: 1
  creators: CreatorBookmark[]
  content: ContentBookmark[]
}

export const EMPTY_LIBRARY: CreatorLibrary = {
  version: 1,
  creators: [],
  content: [],
}
export const LIBRARY_LIMIT = 500

function publicURL(value: string): URL | null {
  if (value.length > 2048) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || !url.hostname.includes('.')
      || url.hostname.endsWith('.local')
      || url.hostname.endsWith('.localhost')
      || /^[\d.]+$/.test(url.hostname)
      || url.hostname.includes(':')
    )
      return null
    return url
  } catch {
    return null
  }
}

/** Canonical public profile links; aliases remain unresolved until verified. */
export function creatorFromURL(value: string): CreatorBookmark | null {
  const url = publicURL(value.trim())
  if (!url) return null
  const host = url.hostname.replace(/^(www|m)\./, '')
  const parts = url.pathname.split('/').filter(Boolean)
  let platform = 'website'
  let label = host
  let profileURL = `https://${url.hostname}/`
  let namespace: string | null = null
  if (host === 'youtube.com') {
    platform = 'youtube'
    if (
      parts.length === 2
      && parts[0] === 'channel'
      && /^UC[A-Za-z0-9_-]{22}$/.test(parts[1])
    ) {
      label = parts[1]
      namespace = JSON.stringify([platform, label])
      profileURL = `https://www.youtube.com/channel/${label}`
    } else if (
      parts.length === 1
      && /^@[\p{L}\p{N}_.-]{3,30}$/u.test(parts[0])
    ) {
      label = parts[0]
      profileURL = `https://www.youtube.com/${label}`
    } else return null
  } else if (host === 'x.com' || host === 'twitter.com') {
    platform = 'twitter'
    if (
      parts.length !== 1
      || !/^[A-Za-z0-9_]{1,15}$/.test(parts[0])
      || ['home', 'explore', 'search', 'settings', 'i', 'intent'].includes(
        parts[0].toLowerCase(),
      )
    )
      return null
    label = `@${parts[0].toLowerCase()}`
    profileURL = `https://x.com/${label.slice(1)}`
  } else if (host === 'twitch.tv') {
    platform = 'twitch'
    if (
      parts.length !== 1
      || !/^[A-Za-z0-9_]{1,25}$/.test(parts[0])
      || ['directory', 'downloads', 'videos', 'settings'].includes(
        parts[0].toLowerCase(),
      )
    )
      return null
    label = parts[0].toLowerCase()
    profileURL = `https://www.twitch.tv/${label}`
  } else if (host === 'reddit.com') {
    platform = 'reddit'
    if (
      parts.length !== 2
      || !['user', 'u'].includes(parts[0])
      || !/^[A-Za-z0-9_-]{3,20}$/.test(parts[1])
    )
      return null
    label = parts[1].toLowerCase()
    profileURL = `https://www.reddit.com/user/${label}`
  } else if (host === 'vimeo.com') {
    platform = 'vimeo'
    if (parts.length !== 1 || !/^user[1-9][0-9]{0,19}$/.test(parts[0]))
      return null
    label = parts[0]
    namespace = JSON.stringify([platform, label.slice(4)])
    profileURL = `https://vimeo.com/${label}`
  } else if (parts.length > 0) {
    return null
  }
  return { url: profileURL, platform, label, namespace }
}

/** Drop fragments and tracking query parameters before saving content locally. */
export function contentFromURL(value: string): string | null {
  const url = publicURL(value.trim())
  if (!url) return null
  const video =
    /^(www\.|m\.)?youtube\.com$/.test(url.hostname) && url.pathname === '/watch'
      ? url.searchParams.get('v')
      : null
  url.hash = ''
  if (video && /^[A-Za-z0-9_-]{11}$/.test(video)) {
    url.search = ''
    url.searchParams.set('v', video)
  } else {
    const tracking: string[] = []
    url.searchParams.forEach((_value, key) => {
      if (
        /^utm_/i.test(key)
        || ['fbclid', 'gclid', 'igshid'].includes(key.toLowerCase())
      ) {
        tracking.push(key)
      }
    })
    for (const key of tracking) url.searchParams.delete(key)
  }
  return url.href
}

/** Validate persisted data; never accept serialized verification or balances. */
export function readLibrary(serialized: string): CreatorLibrary {
  try {
    const data = JSON.parse(serialized)
    if (
      data?.version !== 1
      || !Array.isArray(data.creators)
      || !Array.isArray(data.content)
    )
      return EMPTY_LIBRARY
    const creators = new Map<string, CreatorBookmark>()
    for (const entry of data.creators.slice(0, LIBRARY_LIMIT)) {
      const creator =
        typeof entry?.url === 'string' ? creatorFromURL(entry.url) : null
      if (creator) creators.set(creator.url, creator)
    }
    const content = new Map<string, ContentBookmark>()
    for (const entry of data.content.slice(0, LIBRARY_LIMIT)) {
      const url =
        typeof entry?.url === 'string' ? contentFromURL(entry.url) : null
      if (url && creators.has(entry.creatorURL)) {
        content.set(JSON.stringify([entry.creatorURL, url]), {
          creatorURL: entry.creatorURL,
          url,
        })
      }
    }
    return {
      version: 1,
      creators: [...creators.values()],
      content: [...content.values()],
    }
  } catch {
    return EMPTY_LIBRARY
  }
}

export function followCreator(
  library: CreatorLibrary,
  creator: CreatorBookmark,
): CreatorLibrary {
  if (library.creators.some((item) => item.url === creator.url)) return library
  if (library.creators.length >= LIBRARY_LIMIT)
    throw new RangeError('Library is full')
  return { ...library, creators: [...library.creators, creator] }
}

export function removeCreator(
  library: CreatorLibrary,
  url: string,
): CreatorLibrary {
  return {
    ...library,
    creators: library.creators.filter((item) => item.url !== url),
    content: library.content.filter((item) => item.creatorURL !== url),
  }
}

export function curateContent(
  library: CreatorLibrary,
  creatorURL: string,
  url: string,
): CreatorLibrary {
  const canonical = contentFromURL(url)
  if (!canonical || !library.creators.some((item) => item.url === creatorURL)) {
    throw new Error('Select a followed creator and a public content URL')
  }
  if (
    library.content.some(
      (item) => item.creatorURL === creatorURL && item.url === canonical,
    )
  )
    return library
  if (library.content.length >= LIBRARY_LIMIT)
    throw new RangeError('Library is full')
  return {
    ...library,
    content: [...library.content, { creatorURL, url: canonical }],
  }
}
