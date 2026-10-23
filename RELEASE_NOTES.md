# ETS2 FlexBar Dashboard 1.1.3

The job-information remaining-distance readout now uses the same 3px dot pitch as the default route carousel. Long values scroll at the selected speed instead of changing dot size. The existing units, field alignment and non-LED rendering are preserved.

任务信息里的剩余距离与默认路线轮询统一为 3px 点距。超长读数沿用所选速度滚动，不再改变点阵大小；原单位、栏位对齐和非点阵字体排版保持不变。

Cargo-mass dots align with the cargo-name row without changing dot size. The Chinese unavailable label uses its original non-LED text baseline. / 货物质量点阵与货物名称顶部对齐，点阵大小不变；中文“暂无”使用原默认普通文字位置。

Dot Matrix LED mode preserves complete cargo names. Long names scroll at the selected speed, while short names remain stationary. / 点阵 LED 模式保留完整货物名称：长名称按所选速度滚动，短名称保持静止。

Dot rows keep their alignment when values need smaller dots. Job times and long trailer states retain complete text through scrolling. Missing-value text keeps the original font baseline, including battery voltage and brake temperature. The three fuel layouts and standard-font positions are preserved. / 修正读数缩小点距后的上下偏移；任务时间和长挂车状态滚动保留完整内容；电瓶电压、制动温度等缺失数据的普通文字恢复原基线。保留三种燃油布局及普通字体位置。

## Upgrade / 升级

Import `com.local.ets2rally.flexplugin` into FlexDesigner. Existing settings are preserved. The supplied `ets2-flexbar.dll` is unchanged; existing users do not need to replace it.

在 FlexDesigner 中导入新版插件即可，已有设置保留。桥接 DLL 未改动，已有用户无需替换。

Experimental native blind-spot monitoring is not included in this public release. / 公开包不包含实验性原生盲区检测。

Project code remains PolyForm Noncommercial 1.0.0; third-party components retain their own licenses. Packaged notices and corresponding MPL source archives remain included.

Source release: 1.1.3
