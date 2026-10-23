# ETS2 FlexBar Dashboard 1.1.1

Airport LED scrolling fix / Airport LED 滚动修复 — 2026-10-23

- Continuous dot-matrix text now moves from right to left. Existing continuous-scroll settings migrate automatically; scroll-and-restart remains available.
- Configure scrolling speed from 50% to 200% in the existing plugin settings (100% default). Applies to both scroll modes, including the regular-font fallback for Chinese and other unsupported glyphs.
- The dark dot grid remains fixed. Short text, layout, page carousel timing and non-LED rendering are unchanged.
- 连续点阵滚动改为从右向左，旧配置自动迁移；保留滚完复位模式。
- 在现有设置中调整「点阵滚动速度」：50%–200%，默认 100%。两种滚动模式及中文等普通字形回退均适用。
- 暗底板固定不动，短文本、布局、页面轮询时间及非点阵显示不变。

## Upgrade / 升级

Import `com.local.ets2rally.flexplugin` into FlexDesigner and save the desired scrolling speed in plugin settings. No new game bindings are needed.

在 FlexDesigner 中导入新版插件，在现有设置中选择滚动速度并保存。无需重新绑定游戏按键。

The supplied `ets2-flexbar.dll` is unchanged from 1.1.0 / 1.0.1 / 1.0.0. Existing users do not need to replace it. / DLL 沿用原正式文件，已有用户无需替换。

Experimental native blind-spot monitoring is not included in this public release. / 公开包不包含实验性原生盲区检测。

Project code remains PolyForm Noncommercial 1.0.0; third-party components retain their own licenses. Packaged notices and corresponding MPL source archives remain included.

Source release: 1.1.1
