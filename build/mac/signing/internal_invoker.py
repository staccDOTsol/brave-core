# Copyright (c) 2025 The Brave Authors. All rights reserved.
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at https://mozilla.org/MPL/2.0/.

# Upstream's signing and PKG/DMG/ZIP generation logic lets embedders hook into
# the process by providing a module named `signing.internal_invoker` with a
# class named `Invoker`. This file provides such code to apply customizations
# that are necessary for Brave. It collaborates with the similar hook
# `internal_config.py` in this directory.

from os.path import join
import os
import plistlib
import shutil
import tempfile
from signing import standard_invoker, commands, modification, pipeline


class Invoker(standard_invoker.Invoker):

    @staticmethod
    def register_arguments(parser):
        standard_invoker.Invoker.register_arguments(parser)
        parser.add_argument("--skip_signing", action="store_true")
        parser.add_argument("--universal", action="store_true")
        parser.add_argument("--disable-sparkle", action="store_true")
        parser.add_argument("--provisioning_profile_basename")

    def __init__(self, args, config):
        super().__init__(args, config)
        package_apfs_dmg()
        match_browser_entitlements_to_profile()
        if args.skip_signing:
            stub_out_signing_in_upstream()
        # The config can use this to access the args:
        self.args = args


def match_browser_entitlements_to_profile():
    original = modification._process_entitlements

    def process_entitlements(paths, dist, config):
        original(paths, dist, config)
        profile_name = config.provisioning_profile_basename
        if not profile_name:
            return
        profile_path = join(paths.packaging_dir(config),
                            profile_name + '.provisionprofile')
        profile = plistlib.loads(commands.run_command_output(
            ['security', 'cms', '-D', '-i', profile_path]))
        grants = profile['Entitlements']
        # Chromium's browser-only capabilities need separate Apple approval.
        # Requesting an ungranted capability prevents macOS from launching.
        with commands.PlistContext(
                join(paths.work, 'app-entitlements.plist'),
                rewrite=True) as entitlements:
            for capability in (
                    'com.apple.developer.associated-domains.applinks.read-write',
                    'com.apple.developer.web-browser.public-key-credential'):
                if not grants.get(capability):
                    entitlements.pop(capability, None)

    modification._process_entitlements = process_entitlements


def package_apfs_dmg():
    def _package_dmg(paths, dist, config):
        # The HFS hybrid packager adds empty FinderInfo attributes that fail
        # strict signature validation after installation on current macOS.
        # APFS preserves the signed app and its stapled notarization ticket.
        image = join(paths.output, config.packaging_basename + '.dmg')
        with tempfile.TemporaryDirectory(prefix='root-dmg-',
                                         dir=paths.work) as stage:
            app = join(stage, config.app_dir)
            shutil.copytree(join(paths.work, config.app_dir), app,
                            symlinks=True)
            commands.run_command(['codesign', '--verify', '--deep',
                                  '--strict', app])
            os.symlink('/Applications', join(stage, 'Applications'))
            commands.run_command([
                'hdiutil', 'create', '-fs', 'APFS', '-srcfolder', stage,
                '-volname', config.app_product, '-format', 'UDZO', '-ov', image
            ])
        return image

    pipeline._package_dmg = _package_dmg


def stub_out_signing_in_upstream():
    run_command_orig = commands.run_command
    run_command_all_output_async_orig = commands.run_command_all_output_async

    def scrub_signing_args(args):
        if args[0] == 'codesign':
            # Even non-signing commands such as `codesign --verify` or
            # `codesign --display` fail when signing is skipped. So don't invoke
            # codesign at all:
            return None  # Indicates the command should not be run
        if args[0] == 'productbuild':
            try:
                sign_index = args.index('--sign')
                # Remove '--sign' and the following argument
                del args[sign_index:sign_index + 2]
            except ValueError:
                pass
        return args

    def run_command(args, **kwargs):
        scrubbed = scrub_signing_args(args.copy())
        if scrubbed is not None:
            return run_command_orig(scrubbed, **kwargs)
        return None

    async def run_command_all_output_async(args, **kwargs):
        scrubbed = scrub_signing_args(args.copy())
        if scrubbed is not None:
            return await run_command_all_output_async_orig(scrubbed, **kwargs)
        return ('%s' % args, 0, '', '')

    commands.run_command = run_command
    commands.run_command_all_output_async = run_command_all_output_async
