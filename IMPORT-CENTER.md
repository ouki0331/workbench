# 导入中心与题库设计

状态：独立页面和链接导入迁移已完成；统一 Study Package、题库与 EPUB 尚未实现。

## 产品边界

练习页只负责选择材料、打开电脑中已保存的教材和完成练习。当前“输入链接并读取保存”的入口后续移到独立的“导入中心”，避免准备资料和实际学习混在同一页面。

导入中心统一处理四类来源：

1. 链接：网页文章、RSS 条目、直接音频地址。
2. 普通文件：TXT、Markdown、HTML、音频文件；PDF 和 DOCX 放在后续阶段。
3. 题库：工作台 JSON、CSV 模板，后续增加 QTI 3 的常用子集。
4. 电子书：优先 EPUB，按目录和章节拆成可选择的学习材料。

导入采用“预览 → 选择章节或题目 → 检查提示 → 保存”的流程。用户可以在保存前修改标题、科目、阶段、主题和语言。

## 统一内部格式

所有来源先由适配器转换为统一的 `StudyPackage`，练习、复习、统计和资料库只读取这个格式。以后替换解析器或云服务时，不需要重写练习页面。

```text
study-package.zip
├── manifest.json        # 格式版本、标题、语言、科目、来源与授权说明
├── chapters/*.json      # 章节、段落、学习目标与词汇
├── questions/*.json     # 题目、答案、解析、标签与评分规则
└── assets/*             # 图片、原始音频、生成音频和附件
```

每个资源使用稳定 ID 和内容哈希。重复导入时可以识别同一材料；章节文字没有变化时不重复生成音频。导出至少保留完整 Study Package ZIP，同时提供便于编辑的 JSON 和 CSV。

建议新增以下可替换接口：

- `ImportProvider`：识别来源、预览内容、转换并报告警告。
- `ExportProvider`：导出 Study Package、JSON、CSV，后续增加 QTI。
- `QuestionBankProvider`：读取题目并转换成统一题型。
- `EbookProvider`：解析目录、章节、图片和已有朗读轨道。
- `SpeechProvider`：按段落生成、缓存和复用音频。

## 题库

第一阶段支持可以稳定自动判分的题型：单选、多选、判断和填空。填空题可以通过忽略大小写、首尾空格、连续空格及配置多个可接受答案来判定，因此不必全部限制为选择题。

简答和作文也可以导入并保存，但默认使用参考答案、评分量表或人工评分；接入 AI 之前不产生看似精确的自动分数。配对和排序可以在第二阶段加入。

首版导入模板建议包含：题目 ID、题型、题干、选项、正确答案、可接受答案、解析、难度、标签、章节和分值。JSON 作为完整格式，CSV 作为批量编辑格式。

跨平台交换后续采用 QTI 3 的常用子集。QTI 是 1EdTech 用于交换题目、测验和题库的标准，但完整规范覆盖范围很大；第一版只保证工作台支持的题型能导入导出，不承诺其他系统的复杂交互和样式可以无损往返。

## EPUB 与听力

EPUB 比 PDF 更适合首批支持，因为它本身包含文档顺序、目录和结构化 XHTML。导入时读取目录与 spine，按章节预览，清理不安全的脚本和样式，再把所选章节保存为练习材料。PDF 和 DOCX 的章节边界通常要靠版式或标题推断，准确性较低，放到后续阶段。

听力资源按以下优先级处理：

1. EPUB 已包含 Media Overlay 或配套音频时，优先保留原有文字与音频同步关系。
2. 没有音频时，先用浏览器内置语音做即时试听；不产生文件，也不需要账号。
3. 用户选择“生成并保存音频”时，通过 `SpeechProvider` 调用云端 TTS，按段落生成并缓存到本机。以后迁移到 R2 时沿用相同元数据。

OpenAI Speech API 可以输出 MP3、Opus、AAC、FLAC、WAV 或 PCM，并支持流式返回；单次输入有长度限制，因此长章节必须分段。Cloudflare Workers AI 也提供 TTS 模型，适合未来 Cloudflare 版本。供应商、声音、语速、语言、生成日期和文本哈希都要写入音频元数据。

导入压缩包和 EPUB 时必须限制解压大小、文件数量与嵌套路径，阻止路径穿越和压缩炸弹；HTML/XHTML 在显示前统一清理。

## 实现顺序与难度

| 阶段 | 内容 | 难度 | 账号需求 |
|---|---|---:|---|
| 1 | 导入中心页面；迁移现有链接入口；Study Package；JSON/CSV 题库；四类客观题；导出 | 中 | 无 |
| 2 | EPUB 目录与章节导入；章节选择；浏览器即时朗读 | 中 | 无 |
| 3 | 可保存的云端 TTS；音频缓存；QTI 3 常用子集 | 中至高 | OpenAI 或 Cloudflare 二选一 |
| 4 | PDF/DOCX 章节推断；复杂 QTI；AI 生成题目与主观题辅助评分 | 高 | 视所选 AI 服务而定 |

第一阶段先建立统一格式很关键。否则链接、题库和电子书会各自形成一套保存结构，后续复习、统计和云端迁移都要重复改造。

## 官方参考

- [W3C EPUB 3.3](https://www.w3.org/TR/epub-33/)
- [1EdTech QTI 3 Overview](https://www.1edtech.org/sites/default/files/media/docs/2025/WBR_040125_QTI.pdf)
- [OpenAI Audio Speech API](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)
- [Cloudflare Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
