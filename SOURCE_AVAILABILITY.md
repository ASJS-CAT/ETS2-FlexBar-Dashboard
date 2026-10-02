# Source availability / 源码获取

This notice covers the components with source-availability obligations identified in the distributed Canvas addon. Both components below are licensed under MPL-2.0. The project's PolyForm Noncommercial license does not restrict these source files or the rights granted by MPL.

| Component | Download | SHA-256 | Offline file |
| --- | --- | --- | --- |
| cssparser-0.35.0 | [exact source](https://static.crates.io/crates/cssparser/cssparser-0.35.0.crate) | `4e901edd733a1472f944a45116df3f846f54d37e67e68640ac8bb69689aca2aa` | `cssparser-0.35.0.crate` |
| cssparser-color-0.3.0 | [exact source](https://static.crates.io/crates/cssparser-color/cssparser-color-0.3.0.crate) | `6eeef9ae8c0e112edd89eb6406b3156ffa99c7e037b3baef1dbdf4158d35c324` | `cssparser-color-0.3.0.crate` |

Inside the plugin, offline archives are under `resources/third-party-sources/`. In the public source repository they are under `docs/legal-audit/sources/`. They are original complete registry `.crate` archives (gzip-compressed tar), not a URL to a moving branch. Download or copy either archive, verify it with `Get-FileHash -Algorithm SHA256`, and extract with `tar -xzf <archive>.crate`. No login is required. Each includes `.cargo_vcs_info.json` with its exact upstream commit and preserves source-file notices. Full MPL-2.0 text is retained in `resources/third-party-licenses/rust/` (cssparser-color's upstream LICENSE is supplied alongside its crate).

This project has not modified these components or the upstream Canvas addon. These copies provide the published Source Code Form used for the identified versions. If covered source is modified in a future release, the source copy and this notice must be updated to include those modifications. See [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/) for recipients' rights.

中文：以上两项 MPL 组件均提供精确版本的在线源码和随插件附带的离线源码，包含原始文件声明。可独立获取、修改和使用，不受本项目 PolyForm 非商业限制替代。其他无源码提供义务的许可证材料不在本文重复列出。
