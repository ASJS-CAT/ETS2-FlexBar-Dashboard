# 1.1.3 — 2026-10-23

- Match the job-information remaining-distance dot size to the default route carousel: fixed 3px pitch with overflow scrolling, preserving alignment and non-LED rendering. / 任务信息剩余距离统一使用默认路线轮询的 3px 点距，超长内容沿用滚动显示，保留现有对齐与非点阵排版。
- Restore the original text baseline for the Chinese unavailable cargo-mass label while preserving numeric LED placement. / 货物质量显示中文“暂无”时恢复默认文字位置，保留实际质量数字的点阵位置。

# 1.1.2 — 2026-10-23

- Long pickup and delivery company names scroll without ellipses, using the existing direction and speed settings.
- Enlarge remaining distance to fit its field; align all four job-distance dot boards at the top. Driving time keeps a consistent 3px dot pitch and aligns with the other route readouts.
- Keep air pressure and percentage on one complete 3px-pitch row, including at 100%.
- Fuel/AdBlue percentages stay white. Liters are white normally, amber below twice the configured low-fuel threshold, and red below the threshold. Each fluid uses its own remaining percentage.
- Show oil-pressure PSI and oil/coolant-temperature °C inside their dot rows. Align trip-average consumption and its bar with the fuel-volume row in the two-line layout.
- Rename the display style in settings to Dot Matrix LED; existing saved selections are preserved.
- Existing non-LED typography, carousel timing and the bridge DLL remain unchanged.

- 发货公司和收货公司的长名称不再截成省略号，沿用现有滚动方向与速度设置。
- 剩余距离在栏位内放大并完整显示，任务距离页四个点阵顶部对齐。驾驶时间统一为 3px 点距，与路线页其他读数对齐，不再随常见文本长度变字号。
- 气压与百分比单行完整显示，100% 时仍使用 3px 点距。
- 燃油/尿素百分比保持白色；升数正常白色，各自剩余比例低于油量阈值两倍时黄色、低于阈值时红色。
- 油压 PSI、油温/水温 °C 补入同一行点阵；双行燃油布局中，平均油耗点阵与进度条对齐旁边燃油升数。
- 设置中的样式名称统一为“点阵 LED”，已有选择与配置保持兼容。
- 非点阵字体、轮询时间和原正式桥接 DLL 保持不变。

# 1.1.1 — 2026-10-23

- Correct continuous Airport LED scrolling to move from right to left; migrate existing continuous-scroll settings. / 修正连续点阵滚动方向为从右向左，自动兼容旧设置。
- Add 50%–200% scrolling speed in plugin settings. Both scroll modes and unsupported-character font fallback follow this speed; fixed dot backplates and carousel timing remain unchanged. / 新增 50%–200% 滚动速度，两种滚动模式及非点阵字形回退均适用；暗底板与轮询时间不变。
- Reuse the existing bridge DLL. / 沿用原桥接 DLL。

# 1.1.0 — 2026-10-23

- Optional Airport LED: independent speed/gear and other-text selection; shared 5×7 glyphs across all three themes. / 新增可选点阵风格，数字与文本独立设置，三主题统一 5×7。
- Larger LED readouts, bounded dark grids, in-matrix units, fuel layout choices and restart/continuous scrolling. LED-only positioning preserves other font layouts. / 优化点阵可读性、暗底板长度、单位、燃油布局及滚动；点阵专用排版不影响其他字体。
- Remove speed leading-zero padding; LED speed/gear retain fixed dark cells. / 速度不补前导零，点阵速度和档位保留固定暗字格。
- Hold job/trailer information to return to the truck-information carousel. / 长按工作或挂车信息返回卡车轮询。
- Reuse the unchanged 1.0.1 bridge DLL; experimental BSM remains outside the public package. / 沿用原 DLL；实验性盲区检测不包含在公开包中。

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
