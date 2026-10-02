# ETS2 FlexBar Dashboard 1.0.0

First public release — 2026-10-02

RC1 passed real FlexDesigner + FlexBar + ETS2 hardware acceptance. The runtime is frozen. Finalization changes only the plugin/settings title to **ETS2 FlexBar Dashboard**, corrects the third-party audit link, and updates release documentation. Dashboard layout and behavior remain unchanged.

## Installation

1. Import `com.local.ets2rally.flexplugin` into FlexDesigner.
2. With ETS2 closed, place `ets2-flexbar.dll` in the game's `bin/win_x64/plugins/` directory, replacing the previous copy if installed.
3. Start ETS2 and accept its telemetry plugin prompt if shown. Tap the FlexBar launcher once to enter the DirectDraw dashboard.

The initial launcher tap is a known DirectDraw host requirement. Dynamic Key migration is not part of this release.

## Validation

- Fresh build from Git-tracked source; dependency installation, build and native tests passed.
- Automated tests: **136 passed, 0 failed, 0 skipped**.
- npm security audit: **0 vulnerabilities**.
- Release gates, source privacy scan and package-content scan passed. B001/H001 remain non-blocking upstream metadata/provenance advisories.
- Packaged using official FlexCLI; package validation and final FlexDesigner import passed. All 340 installed package files match the final archive.
- Final settings title verified in FlexDesigner.
- Runtime comparison against accepted RC1 passed: only settings-title text differs in the JavaScript bundle; native DLL differences are limited to build timestamps.

The package contains the required third-party notices, license texts and MPL corresponding-source archives. The unmodified official Canvas binary retains reviewed upstream CI diagnostic paths; no project author's personal paths were found.

## Licensing and source

Project code is licensed under PolyForm Noncommercial 1.0.0. Third-party components retain their own licenses; the project's noncommercial terms do not apply to them. See the packaged `resources/THIRD_PARTY_NOTICES.md`, `resources/third-party-licenses/` and `resources/SOURCE_AVAILABILITY.md`.

Public source repository: <https://github.com/ASJS-CAT/ETS2-FlexBar-Dashboard>

Source release: 1.0.0

`SHA256SUMS.txt` is preserved unchanged from the accepted 1.0.0 archive. Its `RELEASE_NOTES.md` entry refers to the original notes in that archive; the public notes replace the internal build-commit reference with the source release version. The three uploaded assets are the plugin, DLL and checksum file.
