"""Build macOS Assets.car from the checked-in FairCreators ICNS renditions."""
import json
import pathlib
import struct
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[3]
for icon in (root / 'app/theme').glob('*/mac/**/app.icns'):
    chunks = {}
    data = icon.read_bytes()
    offset = 8
    while offset < len(data):
        kind, length = struct.unpack('>4sI', data[offset:offset + 8])
        chunks[kind.decode()] = data[offset + 8:offset + length]
        offset += length
    with tempfile.TemporaryDirectory() as directory:
        catalog = pathlib.Path(directory) / 'Icons.xcassets'
        appicon = catalog / 'AppIcon.appiconset'
        appicon.mkdir(parents=True)
        (catalog / 'Contents.json').write_text(json.dumps({'info': {'version': 1, 'author': 'xcode'}}))
        images = []
        types = {16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10'}
        for size in [16, 32, 128, 256, 512]:
            for scale in [1, 2]:
                filename = f'icon-{size}-{scale}.png'
                (appicon / filename).write_bytes(chunks[types[size * scale]])
                images.append({'idiom': 'mac', 'size': f'{size}x{size}', 'scale': f'{scale}x', 'filename': filename})
        (appicon / 'Contents.json').write_text(json.dumps({'images': images, 'info': {'version': 1, 'author': 'xcode'}}))
        subprocess.run(['xcrun', 'actool', '--compile', str(icon.parent), '--platform', 'macosx',
                        '--minimum-deployment-target', '11.0', '--app-icon', 'AppIcon',
                        '--output-partial-info-plist', str(pathlib.Path(directory) / 'Info.plist'),
                        str(catalog)], check=True)
