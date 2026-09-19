# 后续账号与 API 准备清单

## 现在可以直接使用

- 本机工作台不需要云服务器、Cloudflare 账号或付费 API。
- 内置词汇预习、学习统计、本地资料保存和复习功能都可离线使用。
- Simple English Wikipedia、Free Dictionary API 和 Wikimedia 的公开读取接口不需要 API 密钥；程序仍会使用缓存和失败回退。

## 语法 AI 解释（以后启用时）

- OpenAI Platform 账号。
- 已启用 API 计费的项目。
- 项目 API 密钥。密钥只放在本机服务端环境变量中，不写进网页、源码、进度导出文件或 Git。
- 可选：设置每月用量上限，避免意外费用。

## 电子书转语音（导入中心第三阶段）

- 第一、二阶段无需新账号：EPUB 导入和浏览器即时朗读均在本机完成。
- 如果需要把生成的朗读保存为音频文件，可在 OpenAI Speech API 或 Cloudflare Workers AI 中选择一家，不需要同时申请。
- OpenAI 方案需要 Platform 项目、已启用的 API 计费和项目 API 密钥。
- Cloudflare 方案需要 Cloudflare 账号、Workers AI 使用权限和仅限该项目的 API Token；如果以后部署工作台，可与同一 Cloudflare 项目整合。
- 音频在本机按正文哈希缓存，避免重复生成和重复付费。

## Cloudflare 云端版本（以后部署时）

- Cloudflare 账号。
- 一个 Workers 项目，用于网页和 API。
- R2 存储桶，用于文章、音频和个人录音。
- D1 数据库，用于进度、统计事件、词汇和复习记录。
- Cloudflare Access 应用，用于限制只有自己能访问。
- Wrangler 登录授权；如果使用自动部署，再创建仅限该项目的 API Token。
- 可选：自有域名。没有域名也可以先使用 Cloudflare 提供的项目地址。

## 可选的多语言增强

- 如果公开词典无法提供完整日语或中文释义，可选择 DeepL、Google Cloud Translation 或 OpenAI API 中的一项。
- 这些服务都应通过可替换 provider 接口接入，密钥只保存在服务端。

申请账号后，不要把密钥直接粘贴到聊天、网页表单或源码。届时只需要在本机环境变量或 Cloudflare Secret 中配置。
