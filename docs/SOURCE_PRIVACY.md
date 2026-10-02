# Public source privacy validation / 公开源码隐私核查

Date: 2026-10-02. **Source privacy: PASS for the current actual Git-index scan and physical no-logs check.** B001/H001 also remain open independently.

The previous source-privacy PASS is withdrawn. The old recursive scanner skipped the plugin logs directory, including its hidden logger audit JSON. That exclusion could not establish the cleanliness of the public source tree.

## Corrections

- Added `com.local.ets2rally.plugin/logs/` and `work/` to .gitignore.
- Removed all three files from the plugin logs directory, including the hidden audit JSON containing a personal absolute path. The user subsequently removed the empty directory; its absence and the actual staged contents were rechecked successfully. Any later reappearance still fails the audit, even when empty or ignored.
- `audit-release.cjs` now rejects the plugin logs entry before walking the tree, and no longer skips it.
- Added `audit-git-privacy.cjs`. It invokes `git ls-files --stage -z` and reads the actual staged blobs with `git cat-file blob`. It does not substitute an independently curated allowlist or sanitized working copies for the Git index.
- A missing repository/index or empty index cannot yield privacy PASS. Special tracked entries such as symlinks, submodules and unresolved merges also fail.

## Actual Git exercise

A temporary local Git repository was initialized outside the public tree. Its working tree was explicitly set to the real public source directory. The following operations were executed: `git init`, `git add .`, `git status --short`, `git ls-files`. No commit, tag, remote, push or upload was created. Git metadata and raw command output stay outside the public tree.

The staged-file scan covers personal Windows/macOS/Linux home paths, credential signatures, literal secret assignments, credential/environment filenames, tracked logs, generated dependency/build/work directories, archives and executable/native binary files. Documentation PNGs with valid PNG signatures are intentional permitted assets, not executable artifacts.

The report records filenames, line numbers and rule names without copying suspected secret values. It also records broad keyword references for review. Ordinary occurrences of `token`, `credentials`, `.env`, `logs` and `binaries` are not automatically credentials. Reviewed references in the current index belong to documentation/warnings, ignore rules, npm package names, license terms, logging APIs, environment-variable access, localization token variables and scanner/test code. No blocking tracked-content finding was detected; the physical plugin logs directory is now absent. The former exclusion-based PASS remains withdrawn; this is a new result from the corrected checks.

This is a scoped automated scan plus keyword review, not proof that all possible secret formats can be detected. Any later staging change requires rerunning it.

## Reproduction

In a normal Git checkout, stage the proposed source files, then run:

```powershell
git add .
git status --short
git ls-files
node scripts/audit-release.cjs --source-only
```

For a temporary index located separately from the public working tree, pass `--git-dir` with its `.git` directory. Both modes scan index contents; only the latter keeps Git metadata outside the public directory. The JSON evidence is written to ignored `build/git-privacy-report.json`. Source-only mode does not waive privacy failures and does not approve packaging. A full release audit additionally checks practical-compliance materials. B001/H001 advisories do not fail it; missing required materials or explicit legal blockers do.

Six regression tests pass (including exact-hash allowlisting of the two reviewed MPL source archives; altered or unreviewed archives fail): staged secret vs sanitized working copy; empty/ignored logs directory; tracked home paths/secrets/environment/binaries; harmless keyword references; empty index rejection.

## Source archive policy

The existing workspace `release-source.zip` is **not a GitHub source archive** and must not be distributed as one. It was not used as the input or proof for this scan. Future official source archives must come from the reviewed Git repository and the approved tag, for example `git archive <approved-tag>`, or GitHub's archive of that same tag. Do not recursively zip a working directory containing dependencies, build output, logs or private files. No replacement source archive or release package was generated in this correction.

中文：此前跳过日志目录得到的隐私 PASS 已撤回。现已删除三个日志文件，用户随后删除空目录；重新检查物理目录与真实 Git 暂存内容均通过，当前 source privacy PASS 来自修正后的检查。现有工作区压缩包不能作为 GitHub 源码包，后续源码只能由审核后的 Git 仓库与标签产生。
