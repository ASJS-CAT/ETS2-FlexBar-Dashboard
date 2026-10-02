# Optional legal audit records

Current decision: [PRACTICAL_COMPLIANCE.md](PRACTICAL_COMPLIANCE.md). Recipient-facing documents are [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) and [SOURCE_AVAILABILITY.md](../../SOURCE_AVAILABILITY.md).

- `THIRD_PARTY_COMPONENTS.csv`: detailed material inventory, not a requirement for end users to read; unresolved historical revisions are qualified.
- `materials.json`: required distribution text/source files and expected SHA-256 hashes.
- `licenses/`: preserved full license/copyright/patent text. Microsoft original document text extractions preserve the terms; official document URLs identify the originals.
- `sources/`: original cssparser and cssparser-color MPL registry source archives.
- `canvas-provenance.json`: official release asset identity and npm source provenance, without requiring historical environment reconstruction.
- `ecosystem-*.json`: fixed source revisions, observed release assets, hashes and ZIP file listings.
- `evidence/`: previously collected exact-source evidence. Inclusion in this directory does not turn a metadata ambiguity into a blocker.

Project PolyForm terms do not replace third-party licenses. Previously prepared notices are retained even when more conservative than this small ecosystem sample.
