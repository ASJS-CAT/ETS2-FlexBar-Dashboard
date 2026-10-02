# Bridge protocol 1

`native/bridge.cpp` is the authoritative producer; `src/model.cjs` validates packets. Windows x64 SCS SDK callbacks stage values, publish coherent snapshots at frame end and send local UDP at 20 Hz. The bridge binds 127.0.0.1:29763; the dashboard binds 127.0.0.1:29762. Only the expected loopback address/port is accepted. No remote server or authentication key is used.

Telemetry is UTF-8 JSON with `protocol:1`, `source:"ets2-flexbar"`, boolean `connected`, `paused`, `input`, sequence/session/process metadata, `values` and optional `payments`. Numbers must be finite; supported text fields are limited to 96 characters; datagrams over 16384 bytes are rejected. Unknown/missing telemetry is not converted to zero. Native no-value callbacks remove the corresponding field.

Commands contain four ASCII bytes `EFB1` and a 32-bit little-endian input mask. Bits 0–13 are generated in docs/CONTROLS.md from INPUT_BITS. Only the fourteen supported bits are used. Inputs are boolean, not game commands: users assign their game meaning. A 350 ms native watchdog releases inputs; dashboard pulses normally last 220 ms. Paused/background/disconnected input gating prevents held inputs from surviving lost transport.

Speed and local velocity use m/s; local acceleration uses m/s²; odometer and fuel range use km; navigation distance uses m and time uses seconds; fuel/AdBlue use litres; temperature uses °C; oil/air pressure use psi. Placement angles use turns. SDK game-time minutes are distinct from real elapsed time.

RallySession owns the driving session separately from mounted device views. Transient host disconnect/focus changes retain trip state. Staleness begins after 1500 ms without telemetry, freezes the last view and releases controls. New bridge sessions or confirmed game exit reset session state. Only explicit SDK pause marks PAUSED.

The display remains DirectDraw, 2170×60. Production layout comes from src/layout.cjs: theme/page 0–109, speed 110–339, gear 340–424, RPM 425–874, carousel 875–1449, controls 1450–2169. Warning/context overlays may span RPM plus carousel. No Dynamic Key protocol is used in this release.

中文：桥接与 Dashboard 仅通过本机 UDP 29762/29763 通信，14 个布尔输入由游戏绑定，遥测缺失不伪造零值。DirectDraw 画面与会话状态独立；短暂失联冻结并释放输入，明确游戏退出或新会话才重置。详细中文交互见 docs/CONTROLS.zh-CN.md。
