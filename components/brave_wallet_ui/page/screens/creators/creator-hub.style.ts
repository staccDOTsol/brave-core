// Copyright (c) 2026 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. https://mozilla.org/MPL/2.0/.

import styled from 'styled-components'

export const Hub = styled.main`
  color: var(--leo-color-text-primary);
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24px;
  h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  h1 {
    font: var(--leo-font-heading-h1);
  }
  h2 {
    font: var(--leo-font-heading-h3);
  }
  h3 {
    font: var(--leo-font-heading-h4);
  }
  p {
    font: var(--leo-font-default-regular);
    line-height: 1.6;
  }
  a {
    color: var(--leo-color-text-interactive);
    overflow-wrap: anywhere;
  }
  @media (max-width: 480px) {
    padding: 16px;
  }
`

export const Actions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`

export const Card = styled.section`
  border: 1px solid var(--leo-color-divider-subtle);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  background: var(--leo-color-container-background);
`

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 16px;
`

export const Items = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  li {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
`

export const Breakdown = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  font: var(--leo-font-default-regular);
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`

export const Note = styled.p`
  color: var(--leo-color-text-secondary);
`
