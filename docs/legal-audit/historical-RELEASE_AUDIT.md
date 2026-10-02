# Release audit — 1.0.0 RC / 发布审计

Initial audit: 2026-10-01; RC1 follow-up completed 2026-10-02 (Asia/Tokyo). **Packaging gate: BLOCKED (B001 + H001)**. No distributable RC1 .flexplugin, public upload, GitHub Release or FlexGate submission was produced. / B001 与 H001 未闭环，因此停止打包，未发布。

## RC1 blocker follow-up / 本轮结果

**2026-10-02 privacy correction:** the earlier source-privacy PASS is withdrawn because the scanner skipped the plugin logs directory. Three log files, including the hidden audit JSON, were removed; the user subsequently deleted the empty directory. The new audit rejects that entry and checks actual Git-index blobs. Rechecking the temporary Git init/add/status/ls-files index and physical directory absence now gives **source privacy PASS**. This new result does not reinstate the old exclusion-based claim. See [SOURCE_PRIVACY](docs/SOURCE_PRIVACY.md). No UI was regenerated for this correction.

- Exact Canvas addon identity established: local SHA-256 equals the upstream v0.1.80 Windows release asset, npm provenance identifies the exact source commit/workflow, and registry signatures/attestations verify. Three missing Rust licenses are now pinned through crate VCS records; the IJG notice and thirteen source archive hashes are retained. **B001 stays open** because the complete historical static dependency inventory is unavailable. [Evidence and two alternatives](docs/licenses/NATIVE_REVIEW.md).
- ENIAC's official MIT identifiers, author `eniac`, exact source revisions and package integrity values are preserved. Standalone copyright/license text is absent; the SDK README's unspecified agreement reference remains ambiguous. **H001 stays open** and is now also enforced by the existing packaging gate. [Official sources and prepared clarification request](docs/licenses/ENIAC_REVIEW.md).
- keyLibrary title/tip now use the host's documented `$...` localization keys. English and Simplified Chinese are supplied; other documented locales have English fallback text. [Host documentation](https://flexdocumentation.readthedocs.io/en/latest/sdk/plugin_structure.html).
- Built-in manifest cover now says `点击进入仪表盘 / TAP TO OPEN DASHBOARD`. The runtime cover still follows saved language. Its 2170×60 preview was inspected for overflow; Dashboard source and geometry are unchanged.
- Current-tree build, 124 tests (0 failed / 0 skipped), and official `plugin:validate` pass. These are incremental regression checks, **not the requested final fresh-source RC1 build**. The final clean build/package/DLL/SHA256SUMS sequence remains conditional on both gates closing.
- Regenerated all 11 production Dashboard PNGs byte-identically in the earlier RC1 follow-up. npm audit reported zero vulnerabilities. The earlier source-privacy conclusion is superseded by the correction above; B001 and H001 remain open.
- No RC1 directory or installer was created. README and CHANGELOG retain Release Candidate wording. No dependency replacement, renderer rewrite or external publishing/contact occurred.

## Two-file material boundary follow-up / 两文件材料边界

The current review is limited to the intended `ETS2-FlexBar-1.0.0.flexplugin` payload and the existing `ets2-flexbar.dll`; the installer has not been generated. In-memory Rollup output exactly matches the candidate backend. ENIAC SDK 1.0.9 is actually bundled; FlexCLI executable code is not. SCS 1.14 headers are compile-time ABI declarations, without a linked SDK implementation. The bridge does contain static Microsoft runtime code. Exact-version MPL source archives and scoped material notices were prepared separately for review. Remaining historical native provenance and SDK notice gaps keep B001/H001 open; no gates, runtime, UI or package were changed.

## Scope and preservation / 范围与保留

A separate public source tree was created. Production DirectDraw architecture and calibrated renderer remain intact. Against the development baseline, `bootstrap.cjs` and `runtime.cjs` contain public version 1.0.0; `fonts.cjs` resolves the Windows font directory from WINDIR instead of a hard-coded drive. This follow-up additionally changes `launcher.cjs` only to support the bilingual built-in cover; runtime launcher callers remain unchanged. **render.cjs, layout.cjs, quick-controls.cjs, model.cjs, RallySession and native bridge logic are unchanged.**

The overview documentation labels were corrected to center on each region's leader line after visual review. Raw dashboard framebuffers are unchanged. / 导览图标注居中修正，不改变实际仪表坐标。

## BLOCKER

| ID | Finding / 发现 | Evidence and action / 依据与后续 |
| --- | --- | --- |
| B001 | Complete redistribution provenance/notices for the prebuilt Windows Canvas native addon are not established. / Canvas 原生包的完整组件与许可声明尚未闭环。 | See [native review](docs/licenses/NATIVE_REVIEW.md), binary hash, exact crate/source notice inventories. The binary contains MPL-2.0 cssparser as well as permissive components; npm MIT metadata alone is insufficient. Complete exact inventory/notices or use an equivalent reproducible audited native build, then review/close release-gates.json. Do not bypass by simply deleting the gate. |

## HIGH

| ID | Finding | Scope / action |
| --- | --- | --- |
| H001 | Official MIT/author declarations verified; exact source trees lack standalone copyright/license files, and SDK README refers to an unspecified agreement. | [ENIAC review](docs/licenses/ENIAC_REVIEW.md) and exact sources retained. Obtain version-applicable attribution and agreement clarification. Enforced as packaging prerequisite alongside B001. / 官方来源已补齐，许可歧义待上游确认。 |

## MEDIUM

| ID | Finding | Scope / action |
| --- | --- | --- |
| M001 | Final FlexDesigner package re-import and physical ETS2/FlexBar acceptance are NOT RUN. | Packaging stopped before an installer existed. CLI structure validation and a mocked host cannot certify actual host import. Use RELEASE_CHECKLIST after B001 is resolved. |
| M002 | System-font fallback depends on the user's Windows installation. | No font binaries are distributed. Test Chinese glyphs on the target machine; docs' deterministic PNG hashes are reproducible on the same font environment, not across arbitrary OS fonts. |
| M003 | The first DirectDraw entry requires one launcher tap. | Documented host limitation. The launcher is not a fake offline image; no Dynamic Key migration attempted. |
| M004 | CI builds are intentionally stopped by the open release gate. | Once the blocker is reviewed and closed, the workflow validates, packs and uploads a CI artifact. It does not publish a GitHub Release. Actual hosted workflow execution is not claimed. |

## LOW

| ID | Finding | Scope / action |
| --- | --- | --- |
| L001 | Duplicate identical light-state/static/control-order branches exist in the legacy QuickControlResolver. | Reviewed; left unchanged to honor the feature/geometry freeze. Existing controls regression tests pass. Cleanup deferred. |
| L002 | Rollup reports upstream ESM top-level-this and circular-dependency warnings in SDK/logging dependencies. | No build failure; bundled SDK/full-chain tests pass. No unsupported SDK rewrite introduced. |
| L003 | Upstream native addon carries an upstream CI account path in diagnostics. | Not this user's private path. Native binary kept unmodified for provenance; recorded in native review. Public project sources contain no personal absolute paths. |

## PASS / 验证通过

| Area / 范围 | Evidence / 验证 |
| --- | --- |
| Manifest/package/version | manifest, package, lock root, startup and status all 1.0.0. Public author ASJS-CAT; repository/homepage/issues set. Required future tag exactly 1.0.0. |
| SDK/CLI structure | .plugin root retained; official CLI 1.0.7 validates the built plugin. SDK 1.0.9 pinned. Local CLI JSON assertion compatibility shim supports Node 22+. |
| Clean dependency installation | A new source directory and new npm cache installed 203 packages via npm ci. Corrupt historical lock entries corrected using official registry version/integrity metadata. No reuse of development node_modules or saved config. |
| Dependency vulnerabilities | npm audit: 0 info / low / moderate / high / critical after compatible lockfile fixes. No force upgrade or runtime feature change. |
| DirectDraw lifecycle | alive/data activation, touch gating, periodic full refresh, at-most-one in-flight draw per device, send failure recovery and multiple devices covered by tests. |
| Native SDK and input | x64 /W4 /WX compilation; SDK ABI, telemetry, pause heartbeat, null channels, lifecycle order, 14 boolean inputs, watchdog and isolated UDP integration pass. |
| Full chain | Real test DLL → UDP → built official SDK backend → DirectDraw touch → real SCS Input SDK callback passes on isolated ports 39762/39763. |
| Connection states / launcher | Tests cover pre-activation cover, offline vs connected vs explicit paused vs stale, entry semantics and missing/late host events. |
| RallySession / trip | View/session separation, focus/transport retention, new-session reset, trip consumption, pause and refueling baseline behavior covered. |
| Quick Controls | Stateful/momentary/conditional capabilities, telemetry-only highlights, static/dynamic/hybrid, no-trailer filtering, stopped hysteresis, reverse and long-hold behavior covered. |
| Warnings / ACK | Visible-frame warning identity captured through rotation; multiple warnings, ACK/recurrence, critical priority, three-second overspeed behavior covered. |
| JOB / T-INFO / carousel | Shared page source, exactly-one manual advance, timer reset and overlay gating covered. |
| Brake / refuel / payment | Brake hold, effective pedal/deceleration layers, low-resource warning suppression during filling, litres/percent, payment event de-duplication and expiry covered. |
| Language / theme / settings | Central dictionaries, English fallback, language persistence path, theme/page independence and launcher locale covered. |
| Shutdown / reconnect / Alt+Tab | Input release, device and host reconnect, focus gating and preserved trip/session state covered in automated tests. Physical behavior remains M001. |
| Native frames / documentation | Eleven actual production 2170×60 PNGs and five explanatory images; all sixteen regenerated byte-identically in the clean directory on this host. Corrected Chinese and English overview annotations visually inspected. |
| Fonts / graphics | No TTF/OTF/TTC, proprietary logo assets or photos in source. System font registration and original vector/canvas icon code only. |
| Source privacy / exclusions — previous PASS withdrawn | Actual Git-index scan replaces the exclusion-based privacy claim. Three logs and the empty directory are now absent; corrected physical check and actual Git-index scan PASS. See docs/SOURCE_PRIVACY.md. |
| Root license | Official PolyForm Noncommercial 1.0.0 text preserved byte-for-byte; source URL/hash recorded. Third-party exceptions explicitly documented. |

## Prior engineering-stage clean build / 上一轮全新构建记录

- Clean `npm ci`: PASS.
- Clean JS build: PASS (upstream warnings noted above).
- Clean native SDK harness: PASS.
- Clean `npm test`: **122 passed, 0 failed, 0 skipped**.
- Production docs generation and same-host reproducibility: PASS, 16 PNGs.
- Official CLI validation: PASS.
- Previous source-only privacy result: WITHDRAWN; the old check skipped plugin logs and was insufficient. Current status is in docs/SOURCE_PRIVACY.md.
- Full release gate: expected FAIL because B001 is open.
- Package / SHA-256 of installer / final host re-import: **NOT RUN / NOT GENERATED**.

Build transcripts remain outside the public source tree. Runtime plugin logs had nevertheless been left inside it; those three files have now been removed. The user removed the remaining empty directory and the corrected validation now passes. A portable validation summary is in docs/FINAL_VALIDATION.md.

## Remaining acceptance / 后续验收

Resolve B001 and H001, rerun the complete clean build and package gate, generate the official package/SHA256SUMS, import that exact package into FlexDesigner, then complete physical RELEASE_CHECKLIST items. Obtain explicit maintainer approval before any upload. This candidate audit does not authorize publishing. / 先闭环许可，再生成包及校验值、导入并实机验收，最后等待作者发布授权。
