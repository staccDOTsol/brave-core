// Copyright (c) 2022 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at https://mozilla.org/MPL/2.0/.

import styled from 'styled-components'

export const Box = styled.div`
  min-height: 100vh;
  background: radial-gradient(ellipse at 50% 0, #254d3c 0, #171717 45%, #101115 80%);
  color: #f7f3e8;
  --leo-color-button-background: #8fe1bd;
  --leo-color-schemes-on-primary: #101115;
  .content-box {
    min-height: 100vh;
    box-sizing: border-box;
    padding: 130px 24px 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`
