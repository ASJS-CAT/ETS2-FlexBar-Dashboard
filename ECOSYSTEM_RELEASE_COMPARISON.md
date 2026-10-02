# FlexBar 公开发布惯例对比

核查日期：2026-10-02。检查了下列 6 个仓库的固定提交、package.json、许可/notice/source-availability 文件名，以及 4 个实际下载的发布包（仅读取 ZIP 内容，没有运行第三方插件）。完整提交、资产 SHA-256、路径清单保存在 [legal-audit](docs/legal-audit/ecosystem-assets.json)。未发现独立文件不代表 bundle 中没有许可文字，也不是对其他项目合规性的判断。

| 样本（固定源码） | LICENSE / package.json | 独立 notices / source availability | release assets / 实际包装 |
| --- | --- | --- | --- |
| [官方 Plugin-Example](https://github.com/ENIAC-Tech/Plugin-Example/tree/ae35a4b060dd2e91c6d6ea2bb1c94e33107c0342) | 未见 LICENSE；package 无项目 license，依赖 SDK、Canvas | 未见独立第三方声明/源码获取文件 | [v1.1.3](https://github.com/ENIAC-Tech/Plugin-Example/releases/tag/v1.1.3)：11 个包内条目，无独立许可证文件；bundle 有 Copyright；未内置 native addon，backend 声明 Canvas 依赖 |
| [官方 Plugin-ScreenMirror](https://github.com/ENIAC-Tech/Plugin-ScreenMirror/tree/c9488bd79112f5ca65ca2741b90e25ef9ec81830) | 未见 LICENSE；依赖 SDK、Jimp、screenshot-desktop | 未见独立文件 | [v1.0.5](https://github.com/ENIAC-Tech/Plugin-ScreenMirror/releases/tag/v1.0.5)：12 个条目，无独立许可证文件；bundle 内可见 MIT permission/版权文字 |
| [官方 flex-plugin-template](https://github.com/ENIAC-Tech/flex-plugin-template/tree/3c665bae2c01529f19c42f59a29f87301b8bc2bf) | 未见 LICENSE；使用 @flexsdk/runtime/types | 未见独立文件 | 未见 GitHub Releases；脚本采用 plugin-v2 build/pack，不能将 V2 模板行为直接当成当前 DirectDraw 插件行为 |
| [官方 SpotifyPlugin](https://github.com/ENIAC-Tech/SpotifyPlugin/tree/1c54f0aac209d634c51c148a3ca032dd06088c52) | 未见 LICENSE；依赖 SDK、Canvas | 未见独立文件 | [v1.0.0](https://github.com/ENIAC-Tech/SpotifyPlugin/releases/tag/v1.0.0)：10 个条目，无独立许可证文件/native addon；bundle 有版权文字 |
| [第三方 FlexBar-MQTT-Plugin](https://github.com/TotallyInformation/FlexBar-MQTT-Plugin/tree/8c2d1f34df9ec7ccc53a157c8a3a24dd3758da03) | 根 LICENSE 为 Apache-2.0；package 无 license 字段，依赖 SDK、mqtt | 未见独立第三方声明/源码获取文件 | 未见 GitHub Releases；package 提供 FlexCLI pack/install 脚本。不能声称检查了其实际发布包 |
| [第三方 ENERGYMT Spotify](https://github.com/ENERGYMT/FlexBar-Plugin-Spotify/tree/2bceb03ff85cefae2dd044c318b26a4a2709133d) | 未见 LICENSE；依赖 SDK、Canvas 等 | 未见独立文件 | [v1.0.8](https://github.com/ENERGYMT/FlexBar-Plugin-Spotify/releases/tag/v1.0.8)：提供三平台包；检查 Windows x64 包，19 个条目，含两处 Canvas .node，无独立许可证文件 |

## official ENIAC practice

官方示例使用 Rollup 合并 SDK，再由 FlexCLI 打包。[官方发布指南](https://flexdocumentation.readthedocs.io/en/latest/sdk/release_plugin.html)说明按 manifest 版本创建 tag/release，由 CI 上传 `.flexplugin`，可按 OS/架构分别发布。文档没有要求提交历史 native link map、完整 SBOM 或私有补丁不存在的证明。SDK 1.0.9 的 [官方 npm 元数据](https://registry.npmjs.org/@eniac/flexdesigner/1.0.9)明确声明 MIT；示例使用及发布流程作为支持证据，不当作额外授权书。

## third-party common practice

本次两个第三方样本沿用 FlexCLI 脚本，许可证展示程度不同；其中一个有实际按平台发布的 native 包。小样本不能代表整个生态，也不能用“别人没放 notices”免除我们的义务。

## our stricter safeguards

我们保留 PolyForm 自有许可与第三方许可的明确边界；随包保留许可证全文、简短声明、两项 MPL 精确源码链接/哈希/离线副本；保留 Canvas 官方资产一致性证据、真实 Git 暂存隐私检查和可执行的材料缺失检查。历史取证不确定性记录为 advisory。仅已确认的许可禁止、必需文本/源码缺失、未知来源或未授权专有组件进入法律 blocker；不会因为未恢复历史构建环境而无限阻断。
