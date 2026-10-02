# Practical compliance — v1.0 Release Candidate

Policy adopted at the maintainer's explicit request on 2026-10-02. [Ecosystem comparison](../../ECOSYSTEM_RELEASE_COMPARISON.md) is supporting context, not a waiver of license conditions.

A legal release blocker requires a concrete finding in one of four categories:

1. A license explicitly prohibits the planned distribution.
2. Text that the applicable license requires accompanying distribution is missing.
3. Copyleft/source-offer requirements lack the required source access.
4. A redistributed proprietary component has unknown origin or is known to lack authorization.

Missing historical Cargo.lock/link maps, inability to prove absence of unpublished patches, inability to enumerate optimized-away dependencies, or an explicitly MIT-declared upstream package without a standalone LICENSE do not independently block this release. This policy does not waive known modifications, missing source access or any actual license condition.

## Current assessment

**No explicit legal/license blocker identified under these criteria after the retained materials checks pass.** This is a bounded release-engineering assessment, not a guarantee about facts never supplied by upstream. Candidate and physical-testing status remain unchanged; no publication is authorized by this document.

- B001: retained as `accepted-evidence-limit` advisory. Canvas official release asset SHA-256 matches the bundled addon; received permissive/copyright/patent texts and two MPL source copies are preserved. Do not reconstruct the historical toolchain or demand a full native link map.
- H001: retained as `upstream-metadata-ambiguity` advisory. SDK 1.0.9 npm metadata declares MIT. Standard MIT permission text, original metadata/author and official Example usage are retained. Its README reference is recorded without inventing a copyright holder/year. FlexCLI is not a redistributed runtime component.
- libavif and mimalloc: official upstream full license texts were added to fill previously marked text placeholders. Text-source tags identify the retained license documents only, not a newly asserted exact historical addon revision. No additional native reverse engineering was performed.
- Microsoft runtime: known Microsoft toolchain origin and static linkage are recorded. Applicable Visual Studio distributable-code terms govern redistribution; the end-user runtime EULA is not presented as the redistribution grant. No evidence of an unauthorized proprietary payload was found. General unknowns about hypothetical upstream entitlements are not findings of unauthorized distribution.
- SCS SDK: actual permissive sdk_license.txt is retained; no SCS implementation library is distributed by the bridge.

## Enforced safeguards

`scripts/legal-materials.cjs` verifies every listed source/notice file, copied plugin-resource hashes, both MPL exact download URLs/source hashes, unchanged project license, and official-asset Canvas hash evidence. Missing/tampered required material fails release validation. Explicit recorded blockers also fail. Advisories print without failing. Source-only mode checks source materials; package mode additionally checks actual plugin resources and the native addon.

The source privacy scanner permits only the two exact reviewed MPL archive paths AND fixed hashes. Any altered archive or arbitrary binary still fails. Existing no-logs and actual Git-index checks remain active.

Historical reports in `docs/licenses/` and the prior `release-review` output preserve the earlier stricter assessment; their old B001/H001 gate language is superseded by this policy. No older report is evidence of present gate status. Detailed CSV entries with unknown exact revisions remain honest evidence limits, not automatic legal blockers.
