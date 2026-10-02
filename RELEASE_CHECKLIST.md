# Release checklist / 发布验收

Automation and hardware checks are separate. Mark a hardware item only after observing the actual FlexBar and game. / 自动验证不能替代实机验收。

- [ ] Fresh source checkout; no development node_modules/cache/config / 全新目录与缓存
- [ ] Public source has no plugin logs directory, even empty/ignored / 公开源码中不得存在插件 logs 目录
- [ ] Stage the exact proposed files; inspect git status and git ls-files; run actual Git-index privacy scan / 对真实 Git 暂存内容做隐私核查
- [ ] Source archive derives only from the approved Git repository/tag; never use workspace release-source.zip / 源码包只从审核后的仓库与标签生成
- [ ] npm ci
- [ ] npm run build
- [ ] npm run native:test
- [ ] npm test (no skipped native chain / 不跳过原生链路)
- [ ] npm run docs; inspect all native framebuffers / 检查所有截图
- [ ] npm audit --audit-level=moderate
- [ ] npm run audit:release; no BLOCKER / 无阻断项
- [ ] official CLI validate and pack / 官方验证打包
- [ ] check archive paths, licenses and SHA-256 / 检查包与校验值
- [ ] FlexDesigner imports the final exact package / 导入最终包
- [ ] record Windows, ETS2, FlexDesigner and firmware versions / 记录实机版本
- [ ] launcher and first tap / 入口与首次点击
- [ ] OFFLINE → CONNECTED → PAUSED → resume / 状态切换
- [ ] driving speed, gear, RPM and pedal overlays / 驾驶信息
- [ ] controls: driving/stopped/parked/reverse, trailer/no trailer / 操作区各场景
- [ ] Binding Mode: all fourteen inputs and NEXT SET / 全部输入绑定
- [ ] long-hold engine stop/detach and early release cancellation / 长按取消
- [ ] three themes, page retained, Chinese and English / 主题页码与语言
- [ ] default/JOB/T-INFO tap cycling and timer reset / 点击轮询
- [ ] Alt+Tab and short disconnect preserve trip / 切后台和短暂断连
- [ ] trip average and manual reset / 行程平均与重置
- [ ] two or more warnings: ACK remains clickable / 多警告 ACK
- [ ] overspeed three-second banner and red speed accents / 超速
- [ ] job and trailer page data / 任务挂车
- [ ] braking and release hold / 制动
- [ ] fuel and AdBlue increase, low-resource warning suppression / 加注及低余量告警
- [ ] payment events and expiry / 支出
- [ ] clean shutdown, game exit, restart and device reconnect / 关闭重启重连
- [ ] maintainer explicitly approves publishing / 作者明确允许发布

No GitHub/FlexGate upload is authorized by completing automated checks. / 自动检查完成不代表取得上传授权。
