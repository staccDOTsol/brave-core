# Copyright (c) 2025 The Brave Authors. All rights reserved.
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at https://mozilla.org/MPL/2.0/.

import os.path
import shutil
import override_utils


@override_utils.override_function(globals())
async def _customize_and_sign_chrome(original_function, paths, dist_config,
                                     *args):
    base_config = dist_config.base_config
    # Upstream selects the profile by the active certificate's fingerprint.
    profile = base_config.provisioning_profile_basename
    if profile:
        packaging_dir = paths.packaging_dir(dist_config)
        shutil.copyfile(
            os.path.join(packaging_dir, profile + '.provisionprofile'),
            os.path.join(packaging_dir,
                         dist_config.provisioning_profile_basename +
                         '.provisionprofile'))
    # This also serves as a safeguard that .is_in_sign_chrome exists:
    value_before = base_config.is_in_sign_chrome
    base_config.is_in_sign_chrome = True
    try:
        return await original_function(paths, dist_config, *args)
    finally:
        base_config.is_in_sign_chrome = value_before


@override_utils.override_function(globals())
def _staple_chrome(original_function, paths, dist_config):
    original_function(paths, dist_config)
    # Gatekeeper requires the notarization ticket, which signing precedes.
    if dist_config.run_spctl_assess:
        commands.run_command([
            '/usr/sbin/spctl', '--assess', '-vv',
            os.path.join(paths.work, dist_config.app_dir)
        ])


@override_utils.override_function(globals())
def _create_pkgbuild_scripts(original_function, paths, dist_config):
    orig_packaging_dir = paths.packaging_dir

    def new_packaging_dir(*args, **kwargs):
        orig = orig_packaging_dir(*args, **kwargs)
        return os.path.join(orig, 'brave')

    paths.packaging_dir = new_packaging_dir
    try:
        return original_function(paths, dist_config)
    finally:
        paths.packaging_dir = orig_packaging_dir
