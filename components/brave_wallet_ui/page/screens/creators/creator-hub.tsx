// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import * as React from 'react'
import { Link } from 'react-router-dom'
import Button from '@brave/leo/react/button'
import Input from '@brave/leo/react/input'
import Dropdown from '@brave/leo/react/dropdown'
import { getLocale } from '$web-common/locale'
import { WalletRoutes } from '../../../constants/types'
import { WalletPageWrapper } from '../../components/wallet_page_wrapper/wallet_page_wrapper'
import { DefaultPanelHeader } from '../../../components/desktop/card-headers/default-panel-header'
import {
  CreatorLibrary,
  EMPTY_LIBRARY,
  readLibrary,
  creatorFromURL,
  followCreator,
  removeCreator,
  curateContent,
} from '../../../common/creator-economy/creator-library'
import {
  allocateMintFee,
  parsePoolTokens,
  formatPoolTokens,
} from '../../../../creator_economy/common/mint-fees'
import {
  Actions,
  Breakdown,
  Card,
  Grid,
  Hub,
  Items,
  Note,
} from './creator-hub.style'

const LIBRARY_KEY = 'BRAVE_WALLET_CREATOR_LIBRARY_V1'

interface Props {
  library: CreatorLibrary
  onChange: (next: CreatorLibrary) => void
}

/** Native wallet content. Financial state will come from authenticated services. */
export function CreatorHubView({ library, onChange }: Props) {
  const [profileURL, setProfileURL] = React.useState('')
  const [contentURL, setContentURL] = React.useState('')
  const [selectedCreator, setSelectedCreator] = React.useState('')
  const [grossShares, setGrossShares] = React.useState('100')
  const [error, setError] = React.useState(false)
  const creator = creatorFromURL(profileURL)
  const selection = library.creators.some(
    (item) => item.url === selectedCreator,
  )
    ? selectedCreator
    : (library.creators[0]?.url ?? '')

  const allocation = (() => {
    try {
      return allocateMintFee(parsePoolTokens(grossShares))
    } catch {
      return null
    }
  })()

  const change = (update: () => CreatorLibrary) => {
    try {
      onChange(update())
      setError(false)
    } catch {
      setError(true)
    }
  }

  return (
    <Hub>
      <Actions>
        <h1>{getLocale(S.BRAVE_WALLET_CREATORS)}</h1>
        <Link to={WalletRoutes.PortfolioAssets}>
          {getLocale(S.BRAVE_WALLET_TOP_NAV_PORTFOLIO)}
        </Link>
      </Actions>
      <p>{getLocale(S.BRAVE_WALLET_CREATORS_INTRO)}</p>
      {error && (
        <p role='alert'>{getLocale(S.BRAVE_WALLET_CREATORS_SAVE_ERROR)}</p>
      )}
      <Grid>
        <Card aria-labelledby='creator-follow-title'>
          <h2 id='creator-follow-title'>
            {getLocale(S.BRAVE_WALLET_CREATORS_FOLLOW_TITLE)}
          </h2>
          <Input
            value={profileURL}
            onInput={(event) => setProfileURL(event.value)}
          >
            {getLocale(S.BRAVE_WALLET_CREATORS_PROFILE_URL)}
          </Input>
          <Button
            disabled={!creator}
            onClick={() => {
              if (creator) change(() => followCreator(library, creator))
            }}
          >
            {getLocale(S.BRAVE_WALLET_CREATORS_FOLLOW)}
          </Button>
          <Note>{getLocale(S.BRAVE_WALLET_CREATORS_LOCAL_NOTE)}</Note>
          {library.creators.length === 0 && (
            <p>{getLocale(S.BRAVE_WALLET_CREATORS_EMPTY)}</p>
          )}
          <Items>
            {library.creators.map((item) => (
              <li key={item.url}>
                <a
                  href={item.url}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {item.label}
                </a>
                <Note>{getLocale(S.BRAVE_WALLET_CREATORS_UNVERIFIED)}</Note>
                <Button
                  kind='plain'
                  size='small'
                  onClick={() => change(() => removeCreator(library, item.url))}
                >
                  {getLocale(S.BRAVE_WALLET_CREATORS_UNFOLLOW)}
                </Button>
              </li>
            ))}
          </Items>
        </Card>
        <Card aria-labelledby='creator-curation-title'>
          <h2 id='creator-curation-title'>
            {getLocale(S.BRAVE_WALLET_CREATORS_CURATION_TITLE)}
          </h2>
          <Dropdown
            value={selection}
            onChange={(event) => setSelectedCreator(event.value ?? '')}
            disabled={!selection}
          >
            <span slot='label'>
              {getLocale(S.BRAVE_WALLET_CREATORS_SELECT)}
            </span>
            {library.creators.map((item) => (
              <leo-option
                key={item.url}
                value={item.url}
              >
                {item.label}
              </leo-option>
            ))}
          </Dropdown>
          <Input
            value={contentURL}
            onInput={(event) => setContentURL(event.value)}
          >
            {getLocale(S.BRAVE_WALLET_CREATORS_CONTENT_URL)}
          </Input>
          <Button
            disabled={!selection || !contentURL.trim()}
            onClick={() => {
              change(() => curateContent(library, selection, contentURL))
            }}
          >
            {getLocale(S.BRAVE_WALLET_CREATORS_SAVE_CONTENT)}
          </Button>
          <Note>{getLocale(S.BRAVE_WALLET_CREATORS_CURATION_NOTE)}</Note>
          <Items>
            {library.content.map((item) => (
              <li key={JSON.stringify([item.creatorURL, item.url])}>
                <a
                  href={item.url}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {item.url}
                </a>
                <span>
                  {
                    library.creators.find(
                      (profile) => profile.url === item.creatorURL,
                    )?.label
                  }
                </span>
                <Button
                  kind='plain'
                  size='small'
                  onClick={() =>
                    change(() => ({
                      ...library,
                      content: library.content.filter(
                        (saved) => saved !== item,
                      ),
                    }))
                  }
                >
                  {getLocale(S.BRAVE_WALLET_CREATORS_REMOVE_CONTENT)}
                </Button>
              </li>
            ))}
          </Items>
        </Card>
      </Grid>
      <Card aria-labelledby='creator-fees-title'>
        <h2 id='creator-fees-title'>
          {getLocale(S.BRAVE_WALLET_CREATORS_FEES_TITLE)}
        </h2>
        <p>{getLocale(S.BRAVE_WALLET_CREATORS_FEES_DESCRIPTION)}</p>
        <Input
          value={grossShares}
          onInput={(event) => setGrossShares(event.value)}
          showErrors={!allocation}
        >
          {getLocale(S.BRAVE_WALLET_CREATORS_GROSS_SHARES)}
          <span slot='errors'>
            {getLocale(S.BRAVE_WALLET_CREATORS_AMOUNT_ERROR)}
          </span>
        </Input>
        {allocation && (
          <Breakdown aria-live='polite'>
            <dt>{getLocale(S.BRAVE_WALLET_CREATORS_USER_SHARES)}</dt>
            <dd>{formatPoolTokens(allocation.user)}</dd>
            <dt>{getLocale(S.BRAVE_WALLET_CREATORS_TOTAL_FEE)}</dt>
            <dd>{formatPoolTokens(allocation.totalFee)}</dd>
            <dt>{getLocale(S.BRAVE_WALLET_CREATORS_DEPLOYER_SHARE)}</dt>
            <dd>{formatPoolTokens(allocation.deployer)}</dd>
            <dt>{getLocale(S.BRAVE_WALLET_CREATORS_CREATOR_SHARE)}</dt>
            <dd>{formatPoolTokens(allocation.creator)}</dd>
            <dt>{getLocale(S.BRAVE_WALLET_CREATORS_MANAGER_SHARE)}</dt>
            <dd>{formatPoolTokens(allocation.manager)}</dd>
          </Breakdown>
        )}
        <Note>{getLocale(S.BRAVE_WALLET_CREATORS_ESCROW_NOTE)}</Note>
        <Note>{getLocale(S.BRAVE_WALLET_CREATORS_FUNDING_STATUS)}</Note>
      </Card>
    </Hub>
  )
}

export function CreatorHub() {
  const [library, setLibrary] = React.useState<CreatorLibrary>(EMPTY_LIBRARY)
  React.useEffect(() => {
    const refresh = () => {
      try {
        setLibrary(readLibrary(localStorage.getItem(LIBRARY_KEY) ?? ''))
      } catch {
        setLibrary(EMPTY_LIBRARY)
      }
    }
    refresh()
    const onStorage = (event: StorageEvent) => {
      if (event.key === LIBRARY_KEY || event.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const save = (next: CreatorLibrary) => {
    // Persist first so a quota/storage failure cannot be displayed as success.
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(next))
    setLibrary(next)
  }

  return (
    <WalletPageWrapper
      wrapContentInBox
      useCardInPanel
      cardHeader={
        <DefaultPanelHeader
          title={getLocale(S.BRAVE_WALLET_CREATORS)}
          expandRoute={WalletRoutes.Creators}
        />
      }
    >
      <CreatorHubView
        library={library}
        onChange={save}
      />
    </WalletPageWrapper>
  )
}
