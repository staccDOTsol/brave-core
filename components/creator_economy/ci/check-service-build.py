#!/usr/bin/env python3
"""Evaluate real service-key GN declarations without downloading Chromium.

Only declarations and assertions before the first target are evaluated. Unrelated
Chromium imports are empty fixtures; this is not a full native graph check.
"""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[3]
CHECKS = {
    "brave_services_key": "components/constants/BUILD.gn",
    "service_key_search": "components/brave_search/common/buildflags/BUILD.gn",
    "service_key_aichat": "components/ai_chat/core/common/buildflags/BUILD.gn",
    "service_key_stt": "components/speech_to_text/BUILD.gn",
}


def prepare_fixture(root):
    def write(path, contents):
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents)

    write(".gn", 'buildconfig = "//build/BUILDCONFIG.gn"\n')
    write("build/BUILDCONFIG.gn", '''declare_args() {
  is_official_build = true
}
is_android = target_os == "android"
is_ios = target_os == "ios"
set_default_toolchain("//toolchain:default")
''')
    write("toolchain/BUILD.gn", '''toolchain("default") {
  tool("stamp") { command = "unused" }
}
''')
    for path in ["brave/build/config.gni", "build/buildflag_header.gni",
                 "build/util/branding.gni", "mojo/public/tools/bindings/mojom.gni"]:
        write(path, "# Unrelated dependency excluded from this config test.\n")
    for path in ["build/services.gni",
                 "components/ai_chat/core/common/buildflags/buildflags.gni",
                 "components/brave_origin/buildflags/buildflags.gni"]:
        write("brave/" + path, (ROOT / path).read_text())
    deps = []
    for path in CHECKS.values():
        contents = (ROOT / path).read_text()
        assert 'buildflag_header(' in contents, path
        declarations = contents.split('buildflag_header(', 1)[0]
        write("brave/" + path, declarations + 'group("service_check") {}\n')
        deps.append("//brave/" + str(Path(path).parent) + ":service_check")
    write("BUILD.gn", 'group("default") { deps = ' + json.dumps(deps) + ' }\n')


def check(gn, root, label, args, expected_error=None):
    result = subprocess.run([str(gn), "gen", "out", "--fail-on-unused-args",
                             "--args=" + " ".join(args)], cwd=root,
                            text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT)
    passed = (result.returncode == 0 if expected_error is None else
              result.returncode != 0 and "Assertion failed" in result.stdout and
              f'assert({expected_error} != "")' in result.stdout)
    if not passed:
        raise RuntimeError(f"{label}\n{result.stdout}")
    print("PASS:", label)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gn", type=Path, required=True)
    args = parser.parse_args()
    gn = args.gn.resolve()
    with tempfile.TemporaryDirectory(prefix="creator-service-gn-") as directory:
        root = Path(directory)
        prepare_fixture(root)
        plans = json.loads(subprocess.check_output([
            "node", "--input-type=module", "-e",
            "import {releasePlan} from './components/creator_economy/ci/release-plan.mjs';"
            "console.log(JSON.stringify(Object.fromEntries(['linux','android','macos','ios','windows']"
            ".map(target => [target,releasePlan(target).args]))))"], cwd=ROOT, text=True))
        platforms = {"macos": "mac", "windows": "win"}
        for target, plan in plans.items():
            selected = [value.replace(":", "=", 1) for index, value in enumerate(plan)
                        if index and plan[index - 1] == "--gn" and value.split(":", 1)[0]
                        in ("brave_require_services_key", "enable_ai_chat",
                            "enable_brave_ai_chat_service", "enable_brave_speech_to_text")]
            check(gn, root, f"{target}: Release without service credentials",
                  [f'target_os="{platforms.get(target, target)}"'] + selected)
        check(gn, root, "non-official builds allow empty keys", ["is_official_build=false"])
        for key in CHECKS:
            other_keys = [f'{other}="config-test-only"' for other in CHECKS if other != key]
            check(gn, root, f"upstream enabled Release still requires {key}", other_keys, key)


if __name__ == "__main__":
    main()
