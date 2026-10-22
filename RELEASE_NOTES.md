# ETS2 FlexBar Dashboard 1.1.0

Airport LED and carousel improvements / Airport LED 与轮询操作改进 — 2026-10-23

- Add optional Airport LED rendering: shared 5×7 glyphs, visible unlit dots, crisp edges and RALLY / MINT / AMBER colors. Speed/gear and other text can be selected independently.
- Improve LED readability, retain units inside the matrix, remove speed zero-padding, and keep fixed dark cells for speed and gear. LED-only sizing and positioning leave other font layouts intact.
- Add three LED fuel layouts (double row / large, single row / fit, single row / scroll), with restart or continuous rightward scrolling.
- Hold the JOB INFO or T-INFO information area to return to the truck-information carousel.
- 新增可选 Airport LED：三主题统一 5×7 字形与暗点阵；车速／档位和其他文本可分别设置。
- 优化点阵读数、单位、字号及对齐，速度不补前导零；保留速度三字格、档位两字格暗底板。点阵专用排版不影响其他字体布局。
- 燃油页支持双行大字、单行全显、单行大字滚动，滚动可选复位或持续向右循环。
- 长按工作信息或挂车信息区域，可返回卡车信息轮询。

## Upgrade / 升级

Import `com.local.ets2rally.flexplugin` into FlexDesigner. Existing styles remain the default. Enable Airport LED in the existing plugin settings; no new game bindings are needed.

在 FlexDesigner 中导入新版插件，然后在现有设置中选择 Airport LED。原有样式仍为默认选项，无需重新进行游戏按键绑定。

The supplied `ets2-flexbar.dll` is byte-for-byte identical to 1.0.1 / 1.0.0. Existing users do not need to replace it. / DLL 与 1.0.1、1.0.0 完全相同，已有用户无需替换。

Experimental native blind-spot monitoring is not included in this release. / 本版不包含实验性原生盲区检测。

Project code remains PolyForm Noncommercial 1.0.0; third-party components retain their own licenses. Packaged notices and corresponding MPL source archives remain included.

Source release: 1.1.0
