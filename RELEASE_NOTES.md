# ETS2 FlexBar Dashboard 1.1.2

Dot Matrix LED readability fixes / 点阵可读性修正 — 2026-10-23

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

## Upgrade / 升级

Import `com.local.ets2rally.flexplugin` into FlexDesigner. Existing scrolling and low-fuel settings are preserved; no new game bindings are needed.

在 FlexDesigner 中导入新版插件即可，已有滚动与低油量阈值设置保留，无需重新绑定游戏按键。

The supplied `ets2-flexbar.dll` is unchanged from earlier releases. Existing users do not need to replace it. / DLL 沿用原正式文件，已有用户无需替换。

Experimental native blind-spot monitoring is not included in this public release. / 公开包不包含实验性原生盲区检测。

Project code remains PolyForm Noncommercial 1.0.0; third-party components retain their own licenses. Packaged notices and corresponding MPL source archives remain included.

Source release: 1.1.2
