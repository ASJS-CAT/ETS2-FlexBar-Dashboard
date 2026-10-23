# ETS2 FlexBar Dashboard 1.1.2

Company scrolling and journey readability / 公司名称滚动与行程读数优化 — 2026-10-23

- Long pickup and delivery company names now scroll inside their Airport LED fields instead of being shortened to a few letters and an ellipsis.
- Both fields follow the existing right-to-left scrolling mode and 50%–200% speed setting. Chinese and other unsupported dot-matrix glyphs retain their font and scroll too.
- Enlarge remaining-distance and driving-time LED readouts. Compact units stay in the same row; dot size adapts to the field so the complete value remains visible.
- Short company names and non-LED styles retain their existing appearance. Carousel timing stays unchanged.
- 发货公司和收货公司的长名称现在会在原栏位内完整滚动，不再只显示前三四个字母加省略号。
- 沿用现有从右向左滚动方式和 50%–200% 速度设置，中文等普通字形回退也可滚动。
- 放大点阵剩余距离和行驶时间，数字与单位同排紧凑显示，按栏位宽度自动选择能完整显示的点阵大小。
- 短名称、非点阵样式与轮询时间保持原样。

- Keep system air pressure and percentage in one compact, complete LED row at 3px pitch even at 100%. / 气压与百分比以紧凑单行完整显示，100% 时仍保留 3px 点距，不再整体缩成小字。

## Upgrade / 升级

Import `com.local.ets2rally.flexplugin` into FlexDesigner. Existing Airport LED scrolling preferences are preserved; no new game bindings are needed.

在 FlexDesigner 中导入新版插件即可，已有点阵滚动设置保留，无需重新绑定游戏按键。

The supplied `ets2-flexbar.dll` is unchanged from earlier releases. Existing users do not need to replace it. / DLL 沿用原正式文件，已有用户无需替换。

Experimental native blind-spot monitoring is not included in this public release. / 公开包不包含实验性原生盲区检测。

Project code remains PolyForm Noncommercial 1.0.0; third-party components retain their own licenses. Packaged notices and corresponding MPL source archives remain included.

Source release: 1.1.2
