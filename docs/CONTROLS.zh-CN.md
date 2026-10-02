简体中文 | [English](CONTROLS.md)

# 界面与 Quick Controls

以下结构从 `npm run docs` 输出的生产 `ui-structure.json` 生成；不是设计草图。

```text
DirectDraw 2170 x 60
  +-- Theme/page: x=0..109
  +-- Speed: x=110..339
  +-- Gear: x=340..424
  +-- RPM: x=425..874
  +-- Carousel: x=875..1449
  +-- Quick Controls: x=1450..2169
  +-- Default carousel: fuel, route, systems
  +-- job: job_overview -> job_timing -> job_distance
  +-- trailer: trailer_status -> trailer_damage
```
## 按钮树与场景
```text
Static: auto / brake_info / lights / wipers / cruise / hazard / retarder / horn
Binding set 1: lights / wipers / cruise / hazard / retarder / horn / bind_next
Binding set 2: engine / parking / axle / diff / trailer_brake / trailer / bind_next
Binding set 3: camera / mirror / bind_next
DRIVING: map_job / hazard / parking / lights
STOPPED: engine / parking / lights / hazard / axle / diff / map_job
PARKED: engine / parking / axle / diff / lights / map_job / hazard
REVERSING: camera / mirror / hazard / parking / lights
TRAILER_ATTACHED: trailer_info / axle / trailer_brake / map_job / hazard / parking / lights
```
场景示例使用有效任务、默认设置；TRAILER_ATTACHED 样例有挂车，其他样例无挂车。多个场景按优先级合并；倒车、02 控制、03 信息有专用布局。Hybrid 最多固定 3 项，再填充动态按钮，隐藏/排序配置仍生效。Static 保留固定八键，告警时 ACK 可占一个槽位。
停车进入阈值 <1km/h、离开阈值 ≥3km/h，并有 600ms 去抖；倒车 150ms，其他状态 250ms。按钮渐变 200ms。
## 页面与交互
01 自动轮询；02 车辆控制；03 信息快捷键；04 姿态、XYZ、实时/峰值 G。左侧点击 section_next，长按约 900ms 重置行程。JOB/T-INFO/默认轮询可轻点下一项并重新计时。高优先级覆盖层不切换默认页。
## 完整控制表
| FlexBar label | English name | 中文名称 | ETS2 binding | Input SDK mapping | Telemetry feedback | Capability | Context | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACK | Acknowledge warning | 确认警告 | Local / 本地 | — | None / 无 | conditional_action | Warning | Visible warning only; no repair / 确认当前可见告警，不修复车辆 |
| AUTO | Automatic carousel | 自动轮询 | Local / 本地 | — | None / 无 | conditional_action | Static, 03 INFO | Local action / 本地操作 |
| AXLE | Lift axle | 提升桥 | Truck or trailer lift axle / 车头或挂车提升桥 | flexbar_rally / bit 8 / button 9 | truck.lift_axle.indicator OR truck.trailer.lift_axle.indicator | stateful | PARKED, STOPPED, TRAILER_ATTACHED, Binding | Combined indicator, not per-axle state / 综合指示非逐桥状态 |
| NEXT SET | Next binding set | 下一组绑定 | Local / 本地 | — | None / 无 | conditional_action | Binding | Local action / 本地操作 |
| BRAKE | Brake information | 制动信息 | Local / 本地 | — | None / 无 | conditional_action | Static, 03 INFO | Local action / 本地操作 |
| CAMERA | Camera | 摄像机 | Next camera or selected view / 摄像机或自选视角 | flexbar_rally / bit 12 / button 13 | None / 无 | momentary | REVERSING, Binding | Click feedback only / 仅点击反馈 |
| CRUISE | Cruise control | 巡航 | Cruise control / 定速巡航 | flexbar_rally / bit 2 / button 3 | truck.cruise_control | stateful | Static, Binding | Requires game binding / 需游戏绑定 |
| DIFF | Differential lock | 差速锁 | Differential lock / 差速锁 | flexbar_rally / bit 9 / button 10 | truck.differential_lock | stateful | PARKED, STOPPED, Binding | Requires game binding / 需游戏绑定 |
| ENGINE | Engine start/stop | 发动机启停 | Start/stop engine / 发动机启停 | flexbar_rally / bit 6 / button 7 | truck.engine.enabled | stateful | PARKED, STOPPED, Binding | Stop: hold 800 ms / 关闭需长按 |
| HAZARD | Hazard lights | 危险警告灯 | Hazard warning / 双闪 | flexbar_rally / bit 3 / button 4 | truck.hazard.warning | stateful | REVERSING, STOPPED, DRIVING, Static, Binding | Requires game binding / 需游戏绑定 |
| HORN | Horn | 喇叭 | Horn / 喇叭 | flexbar_rally / bit 5 / button 6 | None / 无 | momentary | Static, Binding | 220 ms pulse / 脉冲 |
| LOW BEAM | Lights | 灯光 | Lights / 灯光 | flexbar_rally / bit 0 / button 1 | truck.light.beam.low/high + truck.light.parking | stateful | PARKED, REVERSING, STOPPED, DRIVING, Static, Binding | Label follows beam state / 标签反映光束状态 |
| JOB INFO | Job information | 任务信息 | Local / 本地 | — | None / 无 | conditional_action | PARKED, JOB_ACTIVE, 03 INFO | Shows job data, does not open game map / 不打开游戏地图 |
| MIRROR | Mirror/view | 后视镜/视角 | Mirror toggle or selected view / 后视镜或自选视角 | flexbar_rally / bit 11 / button 12 | None / 无 | momentary | REVERSING, Binding | Click feedback only / 仅点击反馈 |
| PARK | Parking brake | 驻车制动 | Parking brake / 驻车制动 | flexbar_rally / bit 7 / button 8 | truck.brake.parking | stateful | PARKED, REVERSING, STOPPED, DRIVING, Binding | Requires game binding / 需游戏绑定 |
| RET | Retarder | 缓速器 | Retarder increase or assigned action / 缓速器增加或自选功能 | flexbar_rally / bit 4 / button 5 | truck.brake.retarder | stateful | Static, Binding | Requires game binding / 需游戏绑定 |
| DETACH | Trailer coupling | 挂接/分离挂车 | Attach/detach trailer / 挂接分离 | flexbar_rally / bit 10 / button 11 | trailer.connected (result only / 仅确认结果) | conditional_action | PARKED, STOPPED, TRAILER_ATTACHED, Binding | Stopped + attached, hold 800 ms; binding bypass / 停车且挂接，绑定模式例外 |
| T-BRAKE | Trailer brake | 挂车制动 | Trailer brake, if bindable / 游戏可绑定时使用挂车制动 | flexbar_rally / bit 13 / button 14 | None / 无 | momentary | TRAILER_ATTACHED, Binding | 220 ms pulse; no force feedback / 无制动力反馈 |
| T-INFO | Trailer information | 挂车信息 | Local / 本地 | — | None / 无 | conditional_action | REVERSING, STOPPED, TRAILER_ATTACHED, 03 INFO | Local action / 本地操作 |
| WIPER | Wipers | 雨刷 | Wipers / 雨刷 | flexbar_rally / bit 1 / button 2 | truck.wipers | stateful | Static, Binding | Requires game binding / 需游戏绑定 |
Input bit 是协议位号；按钮编号是便于阅读的 1 起始序号，ETS2 显示方式可能不同。stateful 也必须有真实遥测才持续点亮；缺失状态保持未知。momentary 不缓存开关，conditional_action 的本地 ACK 状态不代表车辆故障已消失。所有输入都由 generic input 发送。
## SDK 边界
本版本没有可靠 ABS 介入、涡轮压力或盲区遥测。摄像机/后视镜没有反馈；不可用字段显示 N/A。驻车状态来自 truck.brake.parking。Trip Average 是会话油耗，不是瞬时读数；减速条包含坡度等物理效果。
