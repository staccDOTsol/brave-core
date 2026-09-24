export function releasePlan(target) {
  const shared = ['Release', '--channel=release', '--gn', 'symbol_level:0',
    '--gn', 'blink_symbol_level:0', '--gn', 'v8_symbol_level:0',
    '--gn', 'enable_updater:false', '--gn', 'enable_update_notifications:false',
    '--gn', 'brave_require_services_key:false',
    // Mobile requires Swift/JNI bridge symbols, but the service stays disabled.
    '--gn', `enable_ai_chat:${target === 'ios' || target === 'android'}`,
    '--gn', 'enable_brave_ai_chat_service:false', '--gn', 'enable_brave_speech_to_text:false',
    '--gn', 'should_generate_symbols:false']
  const plans = {
    macos: { args: [...shared, '--target_arch=arm64', '--gn', 'enable_sparkle:false',
      '--gn', 'enable_dsyms:false'], command: 'create_dist', directory: 'Release_arm64', extensions: ['.dmg', '.zip'] },
    ios: { args: [...shared, '--target_os=ios', '--target_arch=arm64', '--target_environment=device'],
      command: 'build', directory: 'ios_Release_arm64', extensions: ['.ipa'] },
    android: { args: [...shared, '--target_os=android', '--target_arch=arm64'],
      command: 'build', directory: 'android_Release_arm64', extensions: ['.aab', '.apk'] },
    windows: { args: [...shared, '--skip_signing'], command: 'create_dist', directory: 'Release', extensions: ['.exe'] },
    linux: { args: [...shared, '--skip_signing', '--gn', 'use_debug_fission:false'], command: 'create_dist', directory: 'Release', extensions: ['.deb', '.rpm'] },
  }
  if (!plans[target]) throw new Error('Unknown release platform')
  return plans[target]
}

export function assertReleaseArtifacts(target, filenames) {
  for (const extension of releasePlan(target).extensions) {
    if (!filenames.some((name) => name.endsWith(extension))) {
      throw new Error(`Missing ${target} release artifact: ${extension}`)
    }
  }
}
