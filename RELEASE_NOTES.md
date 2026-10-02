# ETS2 FlexBar Dashboard 1.0.1

Touch and language hotfix / 触摸与语言热修复 — 2026-10-02

- Restore Quick Controls, information-carousel taps and the left theme/page selector by avoiding ordinary key redraws over the DirectDraw touch surface.
- Apply the dashboard language immediately when FlexDesigner sends saved settings.
- Stop duplicate instances that cannot bind the telemetry port, preventing competing offline/connected frames.
- Preserve the calibrated 2170×60 UI, button layout, renderer, game input bindings and telemetry bridge DLL.

## Upgrade / 升级

Import `com.local.ets2rally.flexplugin` into FlexDesigner. If upgrading from 1.0.0 and touch is still unresponsive, unplug/reconnect FlexBar once, then tap the ETS2 launcher to enter the dashboard. The launcher remains bilingual; dashboard language follows its separate setting.

在 FlexDesigner 中导入新插件。如旧版遗留的触摸状态仍无响应，拔插 FlexBar 一次，再点击 ETS2 入口进入仪表盘。入口保持双语，仪表盘使用设置中所选语言。

The supplied `ets2-flexbar.dll` is byte-for-byte identical to 1.0.0; existing users do not need to replace it or redo game bindings. / DLL 与 1.0.0 完全相同，无需替换或重新绑定。

Project code remains PolyForm Noncommercial 1.0.0; third-party components retain their own licenses. Packaged notices and corresponding MPL source archives remain included.

Source release: 1.0.1
