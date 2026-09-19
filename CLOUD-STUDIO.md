# Cloud Studio 部署

本项目已包含独立静态网站构建；无需 Cloudflare 或 OpenAI 账户即可在 Cloud Studio 运行。

## 已构建发布包

`ielts-cloudstudio.zip` 内包含 `dist-cloudstudio/` 与 `scripts/serve-cloudstudio.mjs`。
在 Cloud Studio 工作空间上传并解压，切换到解压目录，运行：

```sh
PORT=3000 node scripts/serve-cloudstudio.mjs
```

在 Cloud Studio 的端口预览中选择 3000，再使用该平台提供的发布/分享入口。
工作空间预览链接的可用时间与访问范围由 Cloud Studio 配置决定，预览不等于长期托管。

## 从源码构建

Node.js >=22.13.0：

```sh
npm ci
npm run build:cloudstudio
npm run start:cloudstudio
```

## 验证

- `npm test`：JSON 备份回读、格式与版本、日期、时长、分数、重复记录等校验。
- `npm run lint:app`：应用源码检查。
- `npx tsc --noEmit`：类型检查。
- `npm run build:cloudstudio`：独立静态发布包。
- `npm run build`：原有 Sites 构建。

生成器带入的未使用 UI 组件存在已有的全仓库 lint 告警；应用源码检查通过。

## 进度

进度保存在浏览器 localStorage（键 `ielts-workbench-v1`）。不跨设备自动同步。
导出 JSON 后，可以在另一设备使用导入功能。合并按记录 ID 去重，保留当前目标；替换则使用备份的全部数据。
目标分数初始值为 7.0，可修改。无预置学习成绩。
