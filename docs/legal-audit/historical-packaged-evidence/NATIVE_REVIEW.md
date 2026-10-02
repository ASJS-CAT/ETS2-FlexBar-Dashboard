# Native dependency review / 原生依赖审计

Status: **BLOCKER B001 OPEN — packaging stopped**. This is an incomplete redistribution audit, not a claim that upstream software is unlawfully licensed. / 这是再分发审计尚未闭环，不是认定上游软件违法。

The Windows x64 @napi-rs/canvas 0.1.80 runtime contains a compiled Skia/Rust addon and ICU data. Its npm package declares MIT. That declaration alone does not replace the licenses/notices of embedded libraries. The exact addon hash is in package-declarations.json.

## Evidence collected

- canvas v0.1.80 source points to Skia commit 1fdbea293a53b270e3f5e74c92cc6670d68412ff. See canvas-skia-source.json and upstream [build flags](https://github.com/Brooooooklyn/canvas/blob/v0.1.80/scripts/build-skia.js), [Cargo dependencies](https://github.com/Brooooooklyn/canvas/blob/v0.1.80/Cargo.toml).
- Exact Skia source DEPS revisions were used to retrieve Skia, Brotli, Expat, FreeType, Harfbuzz, Highway, ICU, JPEG, JPEG XL, PNG, WebP, Wuffs and zlib texts. Each retrieval URL is retained in native-source-notices.json. This is source evidence, not an exhaustive prebuilt-binary manifest.
- Binary diagnostic strings identify thirteen Rust crates and versions, including **cssparser 0.35.0 (MPL-2.0)**. Their exact crates.io source archives were inspected and available license files retained. See native-binary-crates.json. Scanning diagnostic strings cannot discover stripped/optimized components and is explicitly not a complete inventory.
- The distributed crate archives for napi 3.3.0, napi-sys 3.0.0 and base64-simd 0.8.0 do not contain standalone license files. A repository-level base64-simd text was retrieved, but its revision has not been tied to this binary. The attempted napi version-tag license URL returned 404; the error is recorded.
- The Windows addon contains an upstream CI account path in diagnostic strings. It is not this project's development path. The binary is unmodified; there is no claim that every third-party build path has been removed.

## What still blocks packaging

1. Reconcile the complete exact native artifact's component/version inventory, including components that do not appear in diagnostic strings (for example AVIF/AOM and other optional codecs indicated by upstream build sources).
2. Preserve required copyright/license/NOTICE text for those exact components; do not replace missing author notices with guessed copyright holders. The current retrieval set is incomplete.
3. Confirm source availability and notice obligations for non-MIT embedded components; retain exact corresponding source references. The known cssparser archive is referenced in THIRD_PARTY_NOTICES.md, but this does not attest to all embedded code.

Resolve using upstream build provenance/SBOM and complete notices, or a reproducible native build from audited pinned inputs. Do not close B001 merely because npm audit reports zero vulnerabilities or functional tests pass. Neither action was authorized as a reason to bypass this gate.

中文：已取得多份精确来源许可，并发现实际二进制包含 MPL-2.0 的 cssparser；但二进制字符串不是完整组件表，部分 Rust/图像编解码组件的声明与版本仍需核实。需要上游完整构建依据和声明，或从已审核的固定依赖构建等效原生包。不得把“MIT 元数据”或“功能测试通过”替代完整许可检查。
