# ETS2 FlexBar Dashboard 1.1.3

The job-information remaining-distance readout now uses the same 3px dot pitch as the default route carousel. Long values scroll at the selected speed instead of changing dot size. The existing units, field alignment and non-LED rendering are preserved.

任务信息里的剩余距离与默认路线轮询统一为 3px 点距。超长读数沿用所选速度滚动，不再改变点阵大小；原单位、栏位对齐和非点阵字体排版保持不变。

The Chinese unavailable cargo-mass label uses its original text baseline; actual numeric LED values keep their existing placement. / 货物质量显示中文“暂无”时恢复原默认文字位置；实际质量数字的点阵位置保持不变。

## Upgrade / 升级

Import `com.local.ets2rally.flexplugin` into FlexDesigner. Existing settings are preserved. The supplied `ets2-flexbar.dll` is unchanged; existing users do not need to replace it.

在 FlexDesigner 中导入新版插件即可，已有设置保留。桥接 DLL 未改动，已有用户无需替换。

Experimental native blind-spot monitoring is not included in this public release. / 公开包不包含实验性原生盲区检测。

Project code remains PolyForm Noncommercial 1.0.0; third-party components retain their own licenses. Packaged notices and corresponding MPL source archives remain included.

Source release: 1.1.3
