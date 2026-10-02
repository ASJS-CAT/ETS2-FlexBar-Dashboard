> Historical assessment: B001/H001 blocking requirements here were superseded on 2026-10-02 by [Practical Compliance](../legal-audit/PRACTICAL_COMPLIANCE.md). Evidence is retained; this is not the current release gate status.

# Native dependency review / 原生依赖审计

Status: **BLOCKER B001 OPEN — packaging stopped**. This is an incomplete redistribution audit, not a claim that upstream software is unlawfully licensed. / 这是再分发审计尚未闭环，不是认定上游软件违法。

The Windows x64 @napi-rs/canvas 0.1.80 runtime contains a compiled Skia/Rust addon and ICU data. Its npm package declares MIT. That declaration alone does not replace the licenses/notices of embedded libraries. The exact addon hash is in package-declarations.json.

## Evidence collected

- canvas v0.1.80 source points to Skia commit 1fdbea293a53b270e3f5e74c92cc6670d68412ff. See canvas-skia-source.json and upstream [build flags](https://github.com/Brooooooklyn/canvas/blob/v0.1.80/scripts/build-skia.js), [Cargo dependencies](https://github.com/Brooooooklyn/canvas/blob/v0.1.80/Cargo.toml).
- Exact Skia source DEPS revisions were used to retrieve Skia, Brotli, Expat, FreeType, Harfbuzz, Highway, ICU, JPEG, JPEG XL, PNG, WebP, Wuffs and zlib texts. Each retrieval URL is retained in native-source-notices.json. This is source evidence, not an exhaustive prebuilt-binary manifest.
- Binary diagnostic strings identify thirteen Rust crates and versions, including **cssparser 0.35.0 (MPL-2.0)**. Their exact crates.io source archives were inspected and available license files retained. See native-binary-crates.json. Scanning diagnostic strings cannot discover stripped/optimized components and is explicitly not a complete inventory.
- The distributed crate archives for napi 3.3.0, napi-sys 3.0.0 and base64-simd 0.8.0 omit standalone license files. This missing-text issue is now resolved: each archive's `.cargo_vcs_info.json` identifies its exact upstream commit, whose root LICENSE has been retrieved unchanged. See [pinned notice evidence](native-crate-vcs-notices.json). This establishes those three notices, not the completeness of the entire binary inventory.
- The Windows addon contains an upstream CI account path in diagnostic strings. It is not this project's development path. The binary is unmodified; there is no claim that every third-party build path has been removed.

## What still blocks packaging

1. Reconcile the complete exact native artifact's component/version inventory, including components that do not appear in diagnostic strings (for example AVIF/AOM and other optional codecs indicated by upstream build sources).
2. Preserve required copyright/license/NOTICE text for those exact components; do not replace missing author notices with guessed copyright holders. The current retrieval set is incomplete.
3. Confirm source availability and notice obligations for non-MIT embedded components; retain exact corresponding source references. The known cssparser archive is referenced in THIRD_PARTY_NOTICES.md, but this does not attest to all embedded code.

Resolve using upstream build provenance/SBOM and complete notices, or a reproducible native build from audited pinned inputs. Do not close B001 merely because npm audit reports zero vulnerabilities or functional tests pass. Neither action was authorized as a reason to bypass this gate.

## RC1 follow-up: verified binary identity

See [machine-readable evidence](canvas-binary-provenance.json).

- Installed addon SHA-256: `30646342fc284109aa9542155287d37147c97132d5168cf621f851a9c69e0c99`, 26,272,256 bytes. This exactly matches the digest and size published for [the upstream v0.1.80 Windows x64 release asset](https://github.com/Brooooooklyn/canvas/releases/tag/v0.1.80).
- npm package provenance identifies source commit `dda1b258dac667b4c66b94bbd4d70aa79ea4503a` and [workflow run attempt 2](https://github.com/Brooooooklyn/canvas/actions/runs/17693234724/attempts/2). `npm audit signatures` verified 203 registry signatures and 19 attestations in the installed dependency set.
- This source tree has no Cargo.lock. Cargo.toml uses version ranges, including libavif 0.14, libavif-sys 0.17 with codec-aom, and Windows mimalloc-safe 0.1. The provenance statement resolves the main Git commit, not every Cargo/native dependency.
- The [Skia download helper](https://github.com/Brooooooklyn/canvas/blob/dda1b258dac667b4c66b94bbd4d70aa79ea4503a/scripts/utils.mjs) derives release tag `skia-1fdbea29` from the submodule commit. The workflow downloads prebuilt static libraries from release URLs. That source tag alone does not establish the full static link inventory or hashes of all inputs consumed by that historical build.
- The workflow artifacts API currently returns no artifacts. Unauthenticated access to the Windows job logs returned HTTP 403. Those logs were **not inspected**; their absence from this audit is not evidence that they never existed.
- All thirteen observed crate source archives were retrieved and SHA-256 recorded in [native-binary-crates.json](native-binary-crates.json). JPEG's pinned `README.ijg` has also been preserved. No upstream source archive was replaced with a current branch snapshot.

## Source availability and remaining uncertainty

For cssparser 0.35.0, the exact published crate source and MPL-2.0 text are available and linked in THIRD_PARTY_NOTICES.md. The project makes no changes to that crate or to the downloaded addon. However, registry source availability and diagnostic version strings alone do not prove that the historical native builder used every source unmodified, or establish all other embedded component versions.

MPL-2.0 itself is **not** a prohibition on this release. Its source/notice obligations must be met for covered components; see [Mozilla's distribution guidance, Q7–Q8](https://www.mozilla.org/en-US/MPL/2.0/FAQ/). Project licensing must not restrict those third-party rights. The unresolved blocker is incomplete binary-to-source/notice coverage, not the mere presence of MPL code.

## Feasible resolutions without rewriting the renderer

1. **Keep the exact addon:** obtain the historical Cargo.lock or equivalent complete component/version manifest, native/static-library build inputs and applicable patches, plus license/NOTICE/source-availability materials for this exact hash. Reconcile those against the collected evidence. This preserves current binary rendering behavior.
2. **Build an equivalent addon from pinned source:** keep Canvas 0.1.80's JS API and existing Dashboard renderer; pin Rust/Cargo, Skia/DEPS, C/C++ toolchains, Cargo.lock and all codec/allocator inputs. Build the native dependency from those audited sources, retain complete notices/source references and build manifest. Compare all calibrated framebuffer fixtures before acceptance. A replacement binary is not assumed to be pixel-identical and would require renewed hardware testing. This build/toolchain change has **not** been performed.

Updating Canvas merely to obtain a newer version, omitting the addon from the installer, or collecting generic MIT/Apache texts does not by itself resolve this exact-artifact audit. No renderer rewrite, native-binary substitution or packaging-gate bypass was made.

中文：已取得多份精确来源许可，并发现实际二进制包含 MPL-2.0 的 cssparser；但二进制字符串不是完整组件表，部分 Rust/图像编解码组件的声明与版本仍需核实。需要上游完整构建依据和声明，或从已审核的固定依赖构建等效原生包。不得把“MIT 元数据”或“功能测试通过”替代完整许可检查。
