> Historical assessment: B001/H001 blocking requirements here were superseded on 2026-10-02 by [Practical Compliance](../legal-audit/PRACTICAL_COMPLIANCE.md). Evidence is retained; this is not the current release gate status.

# ENIAC SDK / CLI attribution review

**H001 remains OPEN for RC packaging.** Official declarations and source references are now recorded in [eniac-official-sources.json](eniac-official-sources.json). This is an unresolved evidence question, not a conclusion that these packages prohibit redistribution.

| Package | Official declaration | Exact source | Distribution scope |
| --- | --- | --- | --- |
| @eniac/flexdesigner 1.0.9 | `license: MIT`; `author.name: eniac` | [062888c0e768f67d501e4362b86222064edd91c5](https://github.com/ENIAC-Tech/flexdesigner-sdk/tree/062888c0e768f67d501e4362b86222064edd91c5) | Runtime SDK bundled into backend |
| @eniac/flexcli 1.0.7 | `license: MIT`; `author.name: eniac` | [a795273a2a75ce9fbdc498a3153c241379fde56c](https://github.com/ENIAC-Tech/flexcli/tree/a795273a2a75ce9fbdc498a3153c241379fde56c) | Development/build tool, not backend runtime |

The exact official npm tarball URLs, integrity values and Git heads are retained. These package declarations are authoritative evidence of the published MIT identifier and the attribution string `eniac`. They are not replaced with guessed years or a fabricated `Copyright (c) ENIAC-Tech` notice.

The installed packages and exact referenced source trees have no standalone LICENSE/NOTICE/COPYING files. The SDK's [exact-version README](https://github.com/ENIAC-Tech/flexdesigner-sdk/blob/062888c0e768f67d501e4362b86222064edd91c5/readme.md) says: “This SDK is provided under the terms specified by EniacTech.” It then directs readers to their license agreement without identifying its text. This leaves an ambiguity alongside the npm MIT declaration. The CLI README supplies no additional license text.

## Current two-file scope (2026-10-02)

The material inventory confirms SDK 1.0.9 is rendered into the shipping backend. FlexCLI executable code is not included. H001 is therefore retained for the **distributed SDK only**; missing CLI notice text is historical research, not an additional release prerequisite for these two files. Existing broad ancillary evidence in plugin resources does not mean CLI code is redistributed. No upstream clarification request has been sent.

## What is needed to close H001

Obtain an official, version-applicable license/copyright notice for the distributed SDK, and clarification that the SDK README's agreement reference does not impose different terms on bundling SDK 1.0.9 into a third-party plugin. An upstream LICENSE commit or written maintainer confirmation linked to these versions would provide the missing evidence. Preserve that response/source and the confirmed notice verbatim.

No issue, email or other external message was sent. The following is a prepared request only:

> Please confirm the redistribution license and required attribution for @eniac/flexdesigner 1.0.9 and @eniac/flexcli 1.0.7. Both npm packages declare MIT with author “eniac”, but no standalone license/copyright file is included. The SDK README refers to an unspecified EniacTech license agreement. May SDK 1.0.9 be bundled into a third-party FlexDesigner plugin under MIT, and which exact copyright/license notice should accompany it? Please provide a version-applicable official source or license text for both packages.

中文：已补齐能确认的官方 MIT 声明、作者 `eniac`、精确源码提交、npm 来源与完整性信息；尚缺官方版权/许可原文，且 SDK README 的另行协议引用未解释。因此不能将“资料已收集”写成“许可问题已闭环”。
