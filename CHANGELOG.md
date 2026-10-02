# 1.0.1 — 2026-10-02

- Stop ordinary key redraws from replacing the active DirectDraw touch surface; retain the built-in bilingual launcher. / 停止普通按键重绘破坏 DirectDraw 触摸状态，保留内置双语入口。
- Apply FlexDesigner settings events using the actual flat payload, including dashboard language. / 按宿主实际报文应用设置，修复仪表盘中文无法即时生效。
- Stop a duplicate instance when its telemetry port is occupied, preventing competing OFFLINE frames. / 遥测端口占用时退出重复实例，防止离线画面交替。
- Keep calibrated UI geometry, telemetry bridge DLL and game input bindings unchanged. / 保持已校准布局、桥接 DLL 与游戏绑定不变。
- Devices left in the 1.0.0 unresponsive touch state may need one unplug/reconnect after upgrading. / 旧版遗留的触摸失效状态可能需要升级后拔插设备一次。

# 1.0.0 — 2026-10-02

Version 1.0.0 — First public release / 首个公开版本。

- DirectDraw launcher and live 2170×60 driving instruments / 入口图与实时仪表。
- SCS Telemetry bridge and fourteen generic Input SDK controls / 遥测桥接与 14 路设备输入。
- Context-aware Static, Dynamic and Hybrid controls / 三种操作区模式。
- Fuel, AdBlue, trip average, route, systems, job, trailer and motion/G pages / 燃油、尿素、行程平均、路线、系统、任务、挂车及姿态/G 页面。
- Telemetry-backed warnings/ACK, braking, refueling and payment displays / 告警确认、制动、加注与支出显示。
- English/Chinese UI, three themes and persistent settings / 双语、三主题与设置保存。

RC1 passed real FlexBar + ETS2 hardware acceptance. The final release preserves that runtime; only plugin/settings branding, a notices link and release documentation changed. / RC1 已通过实机验收；正式版保持已验收功能，仅调整插件与设置页名称、声明链接及发布文案。
