// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.
import * as React from 'react'
import { WalletRoutes } from '../../../constants/types'
import { WalletPageStory } from '../../../stories/wrappers/wallet-page-story-wrapper'
import {
  EMPTY_LIBRARY,
  CreatorLibrary,
  creatorFromURL,
  followCreator,
  curateContent,
} from '../../../common/creator-economy/creator-library'
import { CreatorHubView } from './creator-hub'

function Story({ initial = EMPTY_LIBRARY }: { initial?: CreatorLibrary }) {
  const [library, setLibrary] = React.useState(initial)
  return (
    <CreatorHubView
      library={library}
      onChange={setLibrary}
    />
  )
}

const creator = creatorFromURL('https://www.youtube.com/@example_creator')!
const curated = curateContent(
  followCreator(EMPTY_LIBRARY, creator),
  creator.url,
  'https://www.youtube.com/watch?v=abcdefghijk',
)

export const Empty = { render: () => <Story /> }
export const FollowingAndCuration = {
  render: () => <Story initial={curated} />,
}

export default {
  title: 'Wallet/Creators',
  component: CreatorHubView,
  decorators: [
    (StoryComponent: React.ComponentType) => (
      <WalletPageStory initialRoute={WalletRoutes.Creators}>
        <StoryComponent />
      </WalletPageStory>
    ),
  ],
}
