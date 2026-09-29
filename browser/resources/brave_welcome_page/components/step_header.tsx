/* Copyright (c) 2026 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as React from 'react'

export function StepHeader() {
  return (
    <div className='step-header'>
      <svg width='48' height='48' viewBox='0 0 256 256' role='img' aria-label='Root'><rect x='8' y='8' width='240' height='240' rx='56' fill='#17382d' /><path fill='#f2eee4' fillRule='evenodd' d='M68 48H130C167 48 188 68 188 101C188 124 177 139 158 147L193 194H146L109 141V194H68Z M109 82V108H130C142 108 148 103 148 95S142 82 130 82Z' /></svg>
    </div>
  )
}
