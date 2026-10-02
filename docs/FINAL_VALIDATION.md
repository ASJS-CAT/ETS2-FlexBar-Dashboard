# Final validation — 1.0.0 Release Candidate

Updated 2026-10-02. **No explicit legal/license blocker identified under practical-compliance-v1.** This does not certify an installer or physical-device acceptance. README and CHANGELOG remain Release Candidate documents.

## Checks executed for this policy/materials update

| Check | Result |
| --- | --- |
| Ecosystem source review | 6 pinned repositories: 4 official ENIAC, 2 third-party |
| Actual released `.flexplugin` inspection | 4 assets read as ZIP contents; no third-party code executed |
| Practical-compliance materials gate | PASS: 122 required license/source records and corresponding plugin-resource copies |
| Canvas provenance | PASS: addon SHA-256 equals the retained official v0.1.80 Windows asset digest |
| MPL sources | PASS: exact cssparser 0.35.0 and cssparser-color 0.3.0 URLs, SHA-256 and offline source archives retained |
| Git byte preservation | PASS: 123 staged blobs (122 materials plus project LICENSE) match their recorded hashes; attributes prevent line-ending conversion |
| Targeted regression tests | 9 PASS, 0 FAIL: required-material failures, explicit blocker, source-access requirements and actual-index privacy checks |
| Static source checks | PASS: 306 source/documentation files |
| Actual Git-index privacy | PASS: 307 tracked files, zero blocking findings; plugin logs directory absent |
| Runtime/UI preservation | PASS: 56 protected files unchanged by SHA-256, including runtime/native source, plugin backend/UI, Dashboard assets, manifest, bridge DLL and project LICENSE |
| Legal advisories | B001 accepted-evidence-limit; H001 upstream-metadata-ambiguity; both retained and nonblocking |
| New runtime/UI build or image regeneration | NOT RUN; no runtime/UI changes |
| New final clean-source RC build / installer / SHA256SUMS | NOT RUN / NOT GENERATED in this update |
| Physical FlexDesigner + FlexBar + ETS2 RC acceptance | PENDING |
| Push / GitHub Release / FlexGate upload | NOT PERFORMED |

Commands: `node --test test/legal-materials.test.cjs test/source-privacy.test.cjs`; `node scripts/legal-materials.cjs --sync`; `git add .`, `git status --short`, `git ls-files` against the separate temporary Git repository; `node scripts/audit-release.cjs --git-dir <temporary-git-dir>`. A final staged-blob hash comparison verifies preservation through Git itself. Existing no-logs and sensitive-path checks remain enforced.

Only the two exact reviewed MPL source-archive paths and hashes are permitted by the privacy scanner. Other binary archives and changed source archives fail; this is not a blanket binary exemption.

Earlier build/test reports are retained in [historical validation](legal-audit/historical-FINAL_VALIDATION.md). They are not new executions, and their B001/H001 blocking language is superseded by [current policy](legal-audit/PRACTICAL_COMPLIANCE.md).

No historical toolchain/link-map reconstruction, feature addition, Dashboard adjustment, package generation or publication was performed. The next release stage still needs the requested clean build and physical testing of the exact candidate artifacts.
