// Copyright (c) 2022 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at https://mozilla.org/MPL/2.0/.

import * as React from 'react'
import Button from '@brave/leo/react/button'
import { WelcomeBrowserProxyImpl } from '../../api/welcome_browser_proxy'
import { loadTimeData } from '$web-common/loadTimeData'
import { getLocale } from '$web-common/locale'
import * as S from './style'

export default function HelpImprove() {
  const finish = async () => {
    const proxy = WelcomeBrowserProxyImpl.getInstance()
    if (!loadTimeData.getBoolean('isP3AEnabledManaged')) proxy.setP3AEnabled(false)
    if (!loadTimeData.getBoolean('isMetricsReportingEnabledManaged')) {
      proxy.setMetricsReportingEnabled(false)
    }
    await proxy.getWelcomeCompleteURL()
    window.location.assign('brave://wallet/creators')
  }
  return (
    <S.MainBox>
      <div className='view-header-box'>
        <div className='view-details'>
          <h1 className='view-title'>
            {getLocale('braveWelcomeSetupCompleteLabel')}
          </h1>
        </div>
      </div>
      <S.ActionBox>
        <div className='box-center'>
          <Button onClick={finish} size='large'>
            {getLocale('braveWelcomeFinishButtonLabel')}
          </Button>
        </div>
      </S.ActionBox>
    </S.MainBox>
  )
}
