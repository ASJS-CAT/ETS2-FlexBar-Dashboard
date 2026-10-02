# Final validation — 1.0.0 candidate / 最终验证

**BLOCKED: B001 + H001. No RC1 .flexplugin or installer SHA-256 has been generated. / 许可审计阻断，未生成 RC1 安装包与包校验值。**

**Privacy correction, 2026-10-02:** earlier privacy PASS is withdrawn. The old scan excluded plugin logs. All three log files were removed and actual Git-index scanning added, with five regression tests passing. The user subsequently removed the empty directory. Its physical absence and the actual Git-index contents were rechecked: current source privacy **PASS** under the corrected checks. See [SOURCE_PRIVACY.md](SOURCE_PRIVACY.md). No Dashboard/UI generation was performed for this correction.

## RC1 follow-up regression checks (existing source tree)

Completed 2026-10-02 (Asia/Tokyo).

- JS build: PASS.
- All automated tests: **124 PASS, 0 FAIL, 0 SKIP**. Two additional tests cover host keyLibrary localization and bilingual first-frame vs saved-language runtime launcher.
- Official FlexCLI validation: PASS.
- Built-in 2170×60 bilingual Launcher visually checked; no text overflow.
- Regenerated all 11 production Dashboard PNGs: byte-identical to their pre-change versions on this host.
- Source-only privacy check: earlier PASS WITHDRAWN; see the correction above. Prior version/framebuffer checks are unaffected.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Full release gate: exits 1 as required, reporting both B001 and H001.
- npm signature verification: 203 registry signatures and 19 attestations verified.
- B001: addon identity verified, component/source/notice coverage still incomplete.
- H001: official MIT/author metadata collected, SDK agreement/attribution clarification outstanding.
- Final clean-source RC1 build, packing, separate release DLL and SHA256SUMS: **NOT RUN**; gated on B001/H001 resolution.
- Real FlexDesigner/FlexBar/ETS2 RC1 acceptance: **NOT RUN**; no RC1 files exist yet.

## Prior engineering-stage clean build (before RC1 follow-up)

The following results are historical; they do not certify a new clean RC1 build after the latest changes.

| Check | Result |
| --- | --- |
| Fresh directory, fresh npm cache, no inherited config/node_modules | PASS |
| Environment | Windows x64; Node 24.14.0; npm 11.9.0 |
| npm ci | 203 packages installed; 0 vulnerabilities |
| JS build | PASS |
| Native build / SDK ABI harness | PASS |
| Full tests, including native → backend → input chain | 122 PASS, 0 FAIL, 0 SKIP |
| Renderer outputs | 11 × 2170×60 native PNGs, 5 explanatory PNGs |
| Image reproducibility | All 16 PNGs identical in fresh build on same system fonts |
| Official FlexCLI validate | PASS |
| Source privacy | Earlier PASS WITHDRAWN: logs excluded by old scanner; see current correction above |
| Version/font/framebuffer checks | Prior checks PASS; no UI regeneration in privacy correction |
| Full release gate | FAIL as designed: unresolved B001 |
| Package | NOT RUN |
| Final FlexDesigner import | NOT RUN |
| Actual FlexBar + ETS2 manual acceptance | PENDING |
| GitHub/FlexGate upload | NOT PERFORMED |

See RELEASE_AUDIT.md for exact evidence, severity and required resolution. No claim of a completed distributable RC is made. Corrected documentation annotations align RPM, information carousel and controls labels to their respective regions; production UI geometry is unchanged.

详见审计报告；导览标注已修正，正式 UI 坐标未改动。下一步先闭环原生组件声明，再打包/校验/导入与实机验收。
