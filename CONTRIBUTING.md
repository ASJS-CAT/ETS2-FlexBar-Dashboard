# Contributing / 参与开发

Use Windows x64, Node.js ≥22.20 and Visual Studio C++ Build Tools. / 使用 Windows x64、Node.js ≥22.20 与 Visual Studio C++ 编译工具。

```powershell
npm ci
npm run build
npm run native:test
npm test
npm run docs
npm run audit:release
```

Tests bind isolated UDP ports 39762/39763; they must not send fixture telemetry or inputs to a live game. Run native:test before npm test so the real DLL → UDP → backend → Input SDK chain is included. / 测试使用隔离端口 39762/39763；先运行 native:test，再运行 npm test，避免跳过真实 DLL 链路。

Report bugs with the issue form and exact environment versions, reproduction steps, redacted logs and screenshots. Discuss changes before opening a large PR. Keep each PR focused; explain behavior and validation. / 使用 Issue 表单提供版本、复现步骤及脱敏日志；大型改动先讨论，PR 说明行为及验证。

Preserve DirectDraw, calibrated 2170×60 geometry, session ownership and telemetry as the source of truth. CommonJS, small modules, explicit capabilities, central i18n and meaningful regression tests are the project conventions. Regenerate docs when controls/settings change. / 保持 DirectDraw、校准坐标、会话所有权与遥测事实源；使用小型 CommonJS 模块、能力标记、统一 i18n 和回归测试。

Do not submit proprietary fonts/assets, personal logs, captures, binaries, credentials, reverse-engineered game binaries, cracked or modified game code. Respect third-party licenses and retain notices. Contributions are submitted under the project license; third-party code retains its own license. / 不提交专有字体素材、个人日志照片、凭据、破解或修改游戏代码；保留第三方许可。

Publishing is separate from CI: tag exactly 1.0.0 for this candidate, only after hardware acceptance and maintainer authorization. Never publish automatically from a test run. / 发布与 CI 分离，实机验收与作者授权后才使用精确 tag 1.0.0 发布。
