# Copyright (c) 2026 The Brave Authors. All rights reserved.
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. https://mozilla.org/MPL/2.0/.
"""Check new string references and Android XML without downloading Chromium."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[3]
strings = ET.parse(root / 'components/resources/wallet_strings.grdp')
messages = {entry.attrib['name']: entry for entry in strings.getroot()}
for source in (root / 'components/brave_wallet_ui/page/screens/creators').glob('*.tsx'):
    for key in re.findall(r'S\.(BRAVE_WALLET_CREATORS\w*)', source.read_text()):
        assert 'IDS_' + key in messages, f'Missing WebUI string: {key}'
        assert messages['IDS_' + key].get('formatter_data') == 'webui=Wallet'

for resource in ['layout/fragment_setup_wallet.xml', 'menu/menu_dapps_panel.xml']:
    document = ET.parse(root / 'android/java/brave-res' / resource)
    titles = [element.get('{http://schemas.android.com/apk/res/android}text')
              or element.get('{http://schemas.android.com/apk/res/android}title')
              for element in document.iter()]
    assert '@string/brave_wallet_creators_menu' in titles
assert messages['IDS_BRAVE_WALLET_CREATORS_MENU'].get('formatter_data') == 'android_java'
print('Creator WebUI strings and Android resources are consistent.')
