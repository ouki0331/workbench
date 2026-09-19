# 本机数据库设计

更新时间：2026-09-16

## 1. 技术选择

第一阶段使用单个本机 SQLite 数据库，默认路径：

```text
/Users/ouki/Documents/Codex/ielts-study-library/workbench.sqlite3
```

文章正文和结构化元数据进入数据库；MP3、WAV、WebM、PDF、EPUB、图片等大文件继续保存在资料目录，数据库保存相对路径、大小、MIME 类型、时长和 SHA-256。这样查找和关联使用数据库，大文件仍可直接备份和迁移。

数据库启用外键、WAL、`synchronous=NORMAL` 和 5 秒 busy timeout。项目不引入独立数据库服务器、ORM 或后台任务队列。数据库从现在起保留用户、学习模块和科目归属；本机阶段只有一个默认用户，不实现登录页面。

## 2. 整体关系图

```mermaid
erDiagram
  USERS ||--o{ RESOURCES : owns
  USERS ||--o{ RESOURCE_NOTES : writes
  USERS ||--o{ RESOURCE_VIEW_SESSIONS : views
  RESOURCES ||--o{ RESOURCE_FILES : contains
  RESOURCES ||--o{ RESOURCE_NOTES : has
  RESOURCES ||--o{ RESOURCE_VIEW_SESSIONS : viewed_in
  RESOURCES ||--o{ RESOURCE_TAGS : classified_as
  TAG_GROUPS ||--o{ TAGS : contains
  TAGS ||--o{ RESOURCE_TAGS : assigned
  TAGS ||--o{ TAGS : parent_of
  RESOURCES ||--o{ RESOURCE_PLACES : covers
  PLACES ||--o{ RESOURCE_PLACES : assigned
  PLACES ||--o{ PLACES : parent_of
  RESOURCES ||--o{ RESOURCE_RELATIONS : from
  RESOURCES ||--o{ RESOURCE_RELATIONS : to
  LEARNING_MODULES ||--o{ SUBJECTS : contains
  SUBJECTS ||--o{ RESOURCE_SUBJECTS : classifies
  RESOURCES ||--o{ RESOURCE_SUBJECTS : belongs_to
  RESOURCES ||--o{ VOCABULARY_ENTRIES : describes
  VOCABULARY_ENTRIES ||--o{ VOCABULARY_SENSES : explains
  VOCABULARY_ENTRIES ||--o{ VOCABULARY_EXAM_LEVELS : estimates
  RESOURCES ||--o{ PRACTICE_ATTEMPTS : practiced_with
  PRACTICE_ATTEMPTS ||--o{ REVIEW_CARDS : creates
  REVIEW_CARDS ||--o{ REVIEW_EVENTS : reviewed_by
  PRACTICE_ATTEMPTS ||--o{ SELF_ASSESSMENTS : assessed_by
  SELF_ASSESSMENTS ||--o{ SELF_ASSESSMENT_ITEMS : contains
  STUDY_PLANS ||--o{ PLAN_TASKS : contains
  PLAN_TASKS ||--o{ PLAN_TASK_RESOURCES : uses
  RESOURCES ||--o{ PLAN_TASK_RESOURCES : referenced_by
  LEARNING_SESSIONS ||--o{ ACTIVITY_EVENTS : contains
  RESOURCES ||--o{ ACTIVITY_EVENTS : concerns
```

图中资料目录、用户、模块、科目、备注、笔记和浏览会话基础表已经建立；词汇、练习、复习、自评、计划和统计表在对应业务切换到数据库时逐个迁移，避免提前固定尚未验证的字段。

## 3. 已建立的表

### `schema_migrations`

记录已经执行的迁移版本。初始化脚本可以重复运行，不会重复建表。

### `resources`

所有可被搜索、练习、复习或计划引用的内容共用一个资源身份。

关键字段：

- `kind`：article、audio、recording、question_set、vocabulary 等稳定机器值。
- `owner_user_id`：当前为本机默认用户，以后接入账号时作为所有权边界。
- `title`、`summary`、`body_text`：资料主体的可搜索文字。
- `title_source`、`metadata_extracted_at`、`metadata_extract_status`：说明标题等信息来自人工还是自动提取，以及提取是否完整。
- `remark_markdown`、`remark_updated_at`：单一资料备注和独立修改时间。
- `language_tag`：BCP 47 语言标签。
- `source_kind`、`source_url`、`source_external_id`：来源与重复判断。
- `lifecycle_state`：active、archived、trashed。
- `duplicate_of_resource_id`：用户确认重复后指向保留项。
- `is_favorite`：收藏状态。

删除策略：普通删除只把状态改为 `trashed` 并写入 `trashed_at`；彻底删除才触发级联。第一版不自动清空回收站。

### `resource_files`

一份资源可有多个文件，例如文章 Markdown、原始 PDF、配套音频和封面图。路径必须相对于资料目录保存；应用层禁止 `..`、绝对路径和符号链接逃逸。

`checksum_sha256` 用于二进制去重，`duration_seconds` 用于听力和录音统计。文件本身不写入 SQLite BLOB。

`duration_source` 区分自动识别和人工修正，`extracted_metadata_json` 保留文件中读取到的标题、艺术家、专辑、编码等原始候选信息。人工修正时更新 `duration_updated_at`，重新扫描不得覆盖人工值。

### `users`

当前只创建 `user-local-default`。它不是登录系统，而是数据所有权占位。将来增加第二个用户时，资料、笔记、浏览记录、练习、复习、计划和统计都能按 `user_id` 隔离。

### `learning_modules`、`subjects`、`resource_subjects`

学习模块表示 IELTS、会计学或经济学；科目表示模块内部的学习方向。当前只启用 IELTS 及听说读写、词汇和语法。以后新增会计学时增加模块与科目记录，不给通用表增加 `accounting_` 前缀。

一份资料可以关联多个科目。例如央行文章既是 IELTS 阅读资料，也能成为宏观经济学参考资料。专属于会计分录或财务报表的数据以后用扩展表表达。

### `resource_notes`

每份资料可拥有多篇 Markdown 笔记。每篇保存标题、正文、排序、创建时间和修改时间，并通过 `user_id` 表示作者。备注描述资料，笔记保存个人理解，两者不合并。

### `resource_view_sessions`

每次打开资料形成一条浏览会话，保存打开、最后活动、关闭、总停留秒数和活跃秒数。最后查看时间通过最近会话的 `last_activity_at` 得到。异常关闭只计算到最后心跳。

### `resource_relations`

保存资源之间的明确关系。第一版关系值：

- `has_audio`：文章拥有配套音频。
- `transcript_of`：文本是某音频或录音的转写。
- `derived_from`：练习材料来自原始文章或书籍章节。
- `practice_of`：练习档案针对某材料。
- `response_to`：写作或录音回应某题目。
- `contains`：书籍、题库或导入包包含子资源。
- `duplicate_of`：需要保留可见关系的重复内容。

### `tag_groups`、`tags`、`resource_tags`

分类组定义选择模式和颜色；标签保存四种界面语言、父标签和外部标准映射；中间表保存人工、导入或系统分配来源及可信度。

单选规则由服务层执行。例如一份资源只能有一个“内容类型”和一个“建议难度”，技能和主题允许多选。

### `places`、`resource_places`

保存世界、洲、次区域、国家和地区的树状关系。资源关系区分 `coverage` 和 `origin`。国家目录可以以后从 UN M49/ISO 数据更新，业务数据只引用稳定 ID。

### `resource_search` 与 `resource_note_search`

SQLite FTS5 全文索引覆盖标题、摘要、正文、单一备注以及多篇笔记。触发器在资源或笔记写入、更新和删除时同步索引。标签与地区筛选通过关系表组合，不把多语言标签名称复制进全文字段。

## 4. 后续迁移表

### 词汇阶段

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `vocabulary_entries` | 单词或表达的规范形式 | resource_id、lemma、normalized_form、ipa、language_tag、cefr_level、level_source、confidence |
| `vocabulary_senses` | 多语言释义 | vocabulary_id、locale、part_of_speech、definition、example、source |
| `vocabulary_exam_levels` | 考试相关估计 | vocabulary_id、exam_code、target_min、target_max、source、confidence |
| `vocabulary_events` | 查看、收藏、认识状态变化 | vocabulary_id、event_type、occurred_at、source_resource_id |

### 练习与题库阶段

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `question_sets` | 题组设置 | resource_id、version、instructions、scoring_mode |
| `questions` | 题目 | question_set_id、type、prompt、explanation、points、sort_order |
| `question_options` | 选择项 | question_id、text、is_correct、sort_order |
| `practice_attempts` | 一次实际练习 | resource_id、skill、started_at、completed_at、duration_seconds、response_text、score_kind、score |
| `attempt_answers` | 每题作答 | attempt_id、question_id、answer_json、is_correct、score |

题型第一批支持单选、多选、判断；填空答案需要在执行题库阶段确认大小写、拼写容差和多答案规则。

### 复习与自评阶段

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `review_cards` | 单词、错题、重点句、写作问题、口语表达 | source_resource_id、source_attempt_id、card_type、front、back、context、due_at、interval_days、ease、status |
| `review_events` | 每次间隔复习结果 | card_id、rating、reviewed_at、previous_due_at、next_due_at |
| `self_assessments` | 一次写作或口语自评 | attempt_id、rubric_type、overall_note、created_at |
| `self_assessment_items` | 量表逐项结果 | assessment_id、criterion_key、answer、note、needs_follow_up |

### 计划与统计阶段

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `study_plans` | 计划元数据 | title、start_date、end_date、source_kind、status |
| `plan_tasks` | 每个可执行任务 | plan_id、title、due_date、estimated_minutes、status、query_json、sort_order |
| `plan_task_resources` | 任务与固定资料的关系 | task_id、resource_id |
| `learning_sessions` | 一次学习会话 | started_at、ended_at、active_seconds、skill |
| `activity_events` | 原子统计事件 | session_id、resource_id、event_type、quantity、unit、occurred_at |
| `recommendations` | 规则提示及处理状态 | rule_key、evidence_json、suggested_action_json、dismissed_until、resolved_at |
| `resource_link_checks` | 无本地完整副本时的外链健康记录 | resource_id、checked_at、status_code、final_url、result、consecutive_failures |
| `user_settings` | 每用户可配置规则 | user_id、setting_key、value_json、updated_at |

这些用户产生的表均需直接带 `user_id`，即使可以从资源间接追溯，也要避免未来共享资料时把不同用户的练习、复习和计划混在一起。

回收站容量提醒以后保存为 `user_settings`，例如阈值字节数或资料目录占磁盘百分比。达到阈值后先生成站内提醒，不自动清空；邮件通知等账号和通知渠道完成后再增加。

计划任务可以固定关联具体资料，也可以保存一个标签查询条件。例如 `{"skills":["reading"],"topics":["technology"],"level":"b2"}`，执行时选择尚未使用的资料。

## 5. 数据写入边界

每个业务动作使用一次事务：

1. 新建资料：写 `resources`，移动或复制文件，写 `resource_files`，再写标签和地区关系。
2. 编辑资料：更新元数据、替换标签关系、更新全文索引。
3. 移入回收站：更新状态，不删除文件和关系。
4. 彻底删除：确认影响后删除资源，外键级联清理标签关系；共享文件先检查是否仍被其他资源引用。
5. 保存练习：保存 attempt、answers、活动事件和用户明确创建的复习卡。

文件操作无法与 SQLite 完全原子提交。实现时先写临时文件并校验，再提交数据库；失败时清理临时文件。定期维护任务扫描孤立文件和失效路径，生成修复报告，不静默删除。

## 6. 备份和恢复

- 备份必须包含数据库和资料文件。
- 数据库运行时使用 SQLite backup API 或先执行 WAL checkpoint，再复制主文件；不能只复制 `.sqlite3` 而忽略未合并的 WAL。
- 每个备份写入清单：schema 版本、文件数、总大小、创建时间和校验值。
- 恢复先解压到临时目录，运行 `foreign_key_check`、数据库完整性检查和文件校验，再替换当前资料目录。
- 保留进度 JSON 导入作为过渡，直到浏览器数据全部迁移并经过一次真实恢复演练。

## 7. 实施顺序

1. **现在**：建立空数据库、用户占位、模块/科目、核心分类、备注、笔记、浏览会话和全文索引。
2. **直接切换新资料**：新的资料管理页面直接写 SQLite 和资料文件，不做旧格式双写。
3. **元数据提取**：文件先写临时区，读取标题、时长等候选信息，用户确认后一次提交。
4. **切换读取**：资料列表、搜索和编辑从 SQLite 读取；二进制仍走文件接口。
5. **迁移学习数据**：按复习、活动、自评、计划逐个切换，保留 JSON 导入导出作为便携格式。
6. **恢复演练**：从完整 ZIP 恢复到新目录，启动并抽查资料、录音、标签、笔记和浏览时间。

现有本地数据没有保留价值，因此不安排回填、双写和旧数据对账。未来如果从 SQLite 迁移到 PostgreSQL，将以当时真实数据库为来源，另行制定导出、导入、校验和回滚方案。

## 8. 当前数据库状态

迁移文件：`database/migrations/001_resource_catalog.sql` 至当前最新版本；后续只追加新编号迁移，不回写已经发布的业务数据。

初始分类：`database/seeds/001_core_taxonomy.sql`

初始化命令：

```sh
npm run db:init
```

该命令可以重复执行。当前版本建立资料目录、用户、模块、笔记和浏览记录地基，不会把已有文件导入数据库，也不会改变正在运行的网站。

表名保持学科中立。未来会计学和经济学使用新的 `learning_modules`、`subjects` 和必要的领域扩展表，不使用 `ielts_` 前缀复制整套数据库。

## 9. 用例

**用例 A：一篇文章与多个学习产物**

一篇金融新闻保存为一个 `resources` 记录，原文 Markdown 保存为 `resource_files`。配套音频是另一个资源，两者以 `has_audio` 关联。一次阅读练习和一次口语录音分别关联原文；从原文收藏的单词和重点句保留来源，因此搜索文章时可以显示全部后续学习记录。

**用例 B：安全恢复误删资料**

用户在资料库删除一章小说。系统只把它改为 `trashed`，搜索默认不显示，但回收站仍显示文件、标签和关联练习。用户点击恢复后重新变为 `active`，原有复习卡和计划关系不需要重建。
