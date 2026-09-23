import { copyFileSync, mkdirSync, readdirSync, writeFileSync, readFileSync, createReadStream, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { releasePlan, assertReleaseArtifacts } from './release-plan.mjs'

const required = (name) => {
  if (!process.env[name]) throw new Error(`Release requires ${name}`)
  return process.env[name]
}
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? files(join(directory, entry.name)) : entry.isFile() ? [join(directory, entry.name)] : [])

export async function buildRelease({ target, run, pnpm, jobs }) {
  const plan = releasePlan(target)
  const destination = resolve('faircreators-release')
  const output = resolve('../out', plan.directory)
  mkdirSync(destination, { recursive: true })
  const buildArgs = [...plan.args, '--ninja', `j:${jobs}`]
  if (target === 'macos') {
    buildArgs.push('--mac_signing_identifier', required('MACOS_SIGNING_IDENTITY'),
      '--mac_signing_keychain', required('FAIRCREATORS_KEYCHAIN_NAME'), '--notarize',
      '--gn', `notary_api_key_path:${required('FAIRCREATORS_APPLE_KEY_PATH')}`,
      '--gn', `notary_api_key_id:${required('APP_STORE_CONNECT_KEY_ID')}`,
      '--gn', `notary_api_issuer:${required('APP_STORE_CONNECT_ISSUER_ID')}`)
    copyFileSync(required('FAIRCREATORS_MAC_PROFILE_PATH'), 'build/mac/release.provisionprofile')
  }
  await run(pnpm, ['run', plan.command, ...buildArgs])

  if (target === 'ios') {
    await run(pnpm, ['run', 'ios_bootstrap'])
    const auth = ['-allowProvisioningUpdates', '-authenticationKeyPath', required('FAIRCREATORS_APPLE_KEY_PATH'),
      '-authenticationKeyID', required('APP_STORE_CONNECT_KEY_ID'),
      '-authenticationKeyIssuerID', required('APP_STORE_CONNECT_ISSUER_ID')]
    const team = required('APPLE_TEAM_ID')
    if (!/^[A-Z0-9]{10}$/.test(team)) throw new Error('Invalid Apple team ID')
    const archive = resolve('../out/FairCreators.xcarchive')
    await run('xcodebuild', ['-project', 'ios/brave-ios/App/Client.xcodeproj',
      '-scheme', 'Release (AppStore)', '-configuration', 'Release (AppStore)',
      '-sdk', 'iphoneos', '-destination', 'generic/platform=iOS',
      '-derivedDataPath', resolve('../out/creator-ios-device'), '-archivePath', archive,
      ...auth, `DEVELOPMENT_TEAM=${team}`, 'CODE_SIGN_STYLE=Automatic',
      'CODE_SIGN_IDENTITY=Apple Development', 'PROVISIONING_PROFILE_SPECIFIER=',
      `brave_version_build=${required('GITHUB_RUN_NUMBER')}.${required('GITHUB_RUN_ATTEMPT')}`, 'archive'])
    const exportOptions = resolve('../out/FairCreators-ExportOptions.plist')
    writeFileSync(exportOptions, `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
      <key>method</key><string>app-store-connect</string><key>destination</key><string>export</string>
      <key>teamID</key><string>${team}</string><key>signingStyle</key><string>automatic</string>
      <key>manageAppVersionAndBuildNumber</key><false/><key>uploadSymbols</key><true/>
      </dict></plist>`)
    await run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', destination,
      '-exportOptionsPlist', exportOptions, ...auth])
    await run('codesign', ['--verify', '--deep', '--strict', join(archive, 'Products/Applications/Client.app')])
    const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-',
      join(archive, 'Products/Applications/Client.app/Info.plist')], { encoding: 'utf8' }))
    if (plist.CFBundleIdentifier !== 'com.faircreators.ios.browser' ||
        !plist.CFBundleSupportedPlatforms?.includes('iPhoneOS')) throw new Error('Incorrect iOS app identity or platform')
  } else if (target === 'android') {
    const aab = join(destination, 'FairCreators-android-arm64.aab')
    copyFileSync(join(output, 'apks/ChromePublic.aab'), aab)
    // Chromium's default signing material must not survive in the release bundle.
    await run('python3', ['-c', `import zipfile,sys,os,re
p=sys.argv[1]
with zipfile.ZipFile(p) as src,zipfile.ZipFile(p+'.unsigned','w',zipfile.ZIP_DEFLATED) as dst:
 for item in src.infolist():
  if not re.match(r'^META-INF/(?:[^/]+\\.(?:SF|RSA|DSA|EC)|MANIFEST\\.MF)$',item.filename,re.I): dst.writestr(item,src.read(item.filename))
os.replace(p+'.unsigned',p)`, aab])
    const java = resolve('../third_party/jdk/current/bin/java')
    const jarsigner = resolve('../third_party/jdk/current/bin/jarsigner')
    const store = required('FAIRCREATORS_ANDROID_KEYSTORE_PATH')
    const passwordFile = required('FAIRCREATORS_ANDROID_PASSWORD_PATH')
    const alias = required('ANDROID_SIGNING_ALIAS')
    await run(jarsigner, ['-keystore', store, '-storetype', 'PKCS12', '-storepass:file', passwordFile,
      '-keypass:file', passwordFile, aab, alias])
    await run(jarsigner, ['-verify', aab])
    const bundletool = resolve('../third_party/android_build_tools/bundletool/cipd/bundletool.jar')
    await run(java, ['-jar', bundletool, 'validate', `--bundle=${aab}`])
    const packageName = execFileSync(java, ['-jar', bundletool, 'dump', 'manifest',
      `--bundle=${aab}`, '--xpath=/manifest/@package'], { encoding: 'utf8' }).trim()
    if (packageName !== 'com.faircreators.browser') throw new Error(`Unexpected Android package ${packageName}`)
    const apks = join(output, 'FairCreators.apks')
    await run(java, ['-jar', bundletool, 'build-apks', `--bundle=${aab}`, `--output=${apks}`, '--mode=universal',
      `--ks=${store}`, `--ks-key-alias=${alias}`, `--ks-pass=file:${passwordFile}`, `--key-pass=file:${passwordFile}`])
    const apk = join(destination, 'FairCreators-android-arm64.apk')
    await run('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); open(sys.argv[2],"wb").write(z.read("universal.apk"))', apks, apk])
    const apksigner = files(resolve('../third_party/android_sdk/public/build-tools')).find((path) => basename(path) === 'apksigner')
    if (!apksigner) throw new Error('Android SDK apksigner is missing')
    const verification = execFileSync(apksigner, ['verify', '--verbose', '--print-certs', apk], { encoding: 'utf8' })
    if (!verification.toLowerCase().includes(required('ANDROID_SIGNING_SHA256').toLowerCase())) throw new Error('APK signer does not match FairCreators release key')
  } else if (target === 'macos') {
    for (const path of files(join(output, 'packaged')).filter((p) => /FairCreators.*\.(dmg|zip)$/.test(basename(p)))) {
      if (path.endsWith('.dmg')) await run('xcrun', ['stapler', 'validate', path])
      copyFileSync(path, join(destination, basename(path)))
    }
  } else if (target === 'windows') {
    copyFileSync(join(output, 'brave_installer.exe'), join(destination, 'FairCreators-windows-x64-setup.exe'))
  } else {
    for (const path of files(output).filter((p) => /\.(deb|rpm)$/.test(p))) {
      copyFileSync(path, join(destination, basename(path)))
    }
  }

  const artifacts = files(destination).filter((path) => plan.extensions.some((ext) => path.endsWith(ext)))
  assertReleaseArtifacts(target, artifacts)
  const manifest = { platform: target, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    version: JSON.parse(readFileSync('package.json', 'utf8')).version,
    signing: target === 'windows' ? 'unsigned-installer' : target === 'linux' ? 'unsigned-packages' : 'signed', artifacts: [] }
  for (const path of artifacts) {
    if (statSync(path).size === 0) throw new Error('Empty release artifact')
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    manifest.artifacts.push({ file: basename(path), bytes: statSync(path).size, sha256: hash.digest('hex') })
  }
  writeFileSync(join(destination, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(join(destination, 'SHA256SUMS'), manifest.artifacts.map((a) => `${a.sha256}  ${a.file}\n`).join(''))
  return manifest
}
