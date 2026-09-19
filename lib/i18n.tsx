'use client';
import { useLayoutEffect, useRef } from 'react';

export type Locale = 'ja' | 'en' | 'zh-CN' | 'zh-TW';
export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

const en: Record<string, string> = {
  学习工作台: 'Study Workbench',
  我的备考: 'My preparation',
  今日学习: 'Today',
  练习中心: 'Practice',
  复习: 'Review',
  能力摸底: 'Level check',
  学习记录: 'Study history',
  本周学习报表: 'Weekly study report',
  学习时间: 'Study time',
  阅读文章: 'Articles read',
  新增单词: 'New words',
  实际听音: 'Listening time',
  口语录音: 'Speaking recorded',
  认识单词: 'Known words',
  单词轨迹: 'Word timeline',
  标记认识: 'Marked known',
  重新标记陌生: 'Marked unfamiliar again',
  查看: 'Viewed',
  收藏: 'Saved',
  篇: 'articles',
  个: 'words',
  词: 'words',
  我的资料库: 'My library',
  目标与备份: 'Goals & backup',
  个人学习空间: 'Personal study space',
  导出学习进度: 'Export progress',
  我的工作台: 'My workbench',
  记录学习: 'Log study',
  '把目标，变成每天的进步。': 'Turn your goal into daily progress.',
  '从一个小任务开始，今天的积累会被记住。':
    'Start small. Today’s work will be remembered.',
  '在这里练习，把进步留下。': 'Practise here and keep your progress.',
  '原文、作答、音频和录音，都在同一张工作台。':
    'Texts, answers, audio and recordings stay in one workbench.',
  '在快要忘记之前，再想起一次。': 'Recall it once more before it fades.',
  '按照你的记忆表现安排下一次复习，让积累真正留下来。':
    'Schedule the next review from your recall and make learning stick.',
  '用几道题，找到现在的起点。':
    'Find your starting point with a few questions.',
  '短时间完成基础摸底，结果只用于安排学习。':
    'Take a short foundation check to guide your study plan.',
  '每一次练习，都有迹可循。': 'Every practice session leaves a trace.',
  '回看练习、分数和复盘，找到下一步的重点。':
    'Review practice, scores and notes to choose your next focus.',
  '学过的内容，留在自己手里。': 'Keep what you have learned in your own hands.',
  '收藏文章和单词，保存音频，回听每一次口语练习。':
    'Save articles, words, audio and every speaking recording.',
  '给下一阶段，定一个目标。': 'Set a goal for the next stage.',
  '按自己的节奏备考，随时备份与迁移学习进度。':
    'Prepare at your pace and back up your progress anytime.',
  目标分数: 'Target band',
  调整目标: 'Change target',
  累计学习: 'Total study',
  距离考试: 'Until exam',
  设置考试日期: 'Set exam date',
  查看备考目标: 'View goal',
  今日四项练习: 'Today’s four skills',
  听力: 'Listening',
  阅读: 'Reading',
  写作: 'Writing',
  口语: 'Speaking',
  精听一段录音: 'Focused listening',
  限时阅读与错题复盘: 'Timed reading and review',
  练习一个论证段落: 'Write an argument paragraph',
  练习一个口语话题: 'Practise a speaking topic',
  专注此刻: 'Focus now',
  开始专注: 'Start focus',
  暂停专注: 'Pause focus',
  '学习时长（分钟）': 'Study time (minutes)',
  '练习分数（选填）': 'Practice score (optional)',
  '这次学到了什么？': 'What did you learn?',
  保存学习记录: 'Save study log',
  今日复习: 'Review today',
  '最近 7 天': 'Last 7 days',
  '学习时长 · 分钟': 'Study time · minutes',
  最近的积累: 'Recent progress',
  全部记录: 'All records',
  开始今日学习: 'Start today',
  导出记录: 'Export records',
  今天待复习: 'Due today',
  今日已完成: 'Done for today',
  开始复习: 'Start review',
  全部卡片: 'All cards',
  已掌握: 'Mastered',
  连续复习: 'Review streak',
  '近 14 天记住率': '14-day recall',
  '14 天复习曲线': '14-day review curve',
  复习材料自动整理: 'Automatic review deck',
  同步资料库: 'Sync library',
  '正在同步…': 'Syncing…',
  先收集第一张复习卡: 'Collect your first review card',
  退出复习: 'Exit review',
  显示答案: 'Show answer',
  单词卡: 'Vocabulary card',
  错题卡: 'Question card',
  忘记: 'Again',
  困难: 'Hard',
  记得: 'Good',
  熟练: 'Easy',
  今天再看: 'Again today',
  今天的复习完成了: 'Today’s review is complete',
  查看复习统计: 'View review stats',
  听力练习: 'Listening practice',
  阅读练习: 'Reading practice',
  写作练习: 'Writing practice',
  口语练习: 'Speaking practice',
  导入中心: 'Import center',
  开始练习: 'Start practice',
  '把散落的材料，整理成下一次练习。':
    'Turn scattered material into your next practice.',
  '链接、文件、题库和电子书，将从这里进入你的学习系统。':
    'Bring links, files, question banks and ebooks into your study system here.',
  选择来源: 'Choose a source',
  网页与音频链接: 'Web and audio URL',
  现在可用: 'Available now',
  文档与音频文件: 'Documents and audio files',
  资料库已支持: 'Available in Library',
  下一阶段: 'Next phase',
  规划中: 'Planned',
  '已有本地文件？': 'Already have a local file?',
  前往资料库上传: 'Upload it in Library',
  从一个链接开始整理: 'Start with a link',
  '粘贴公开网页或直接音频地址，正文和原文件会保存到电脑。':
    'Paste a public page or direct audio URL. The text or original file will be saved to your computer.',
  本机保存: 'Saved locally',
  '公开 HTTPS 链接': 'Public HTTPS URL',
  用于练习: 'Use for',
  写作素材: 'Writing material',
  口语素材: 'Speaking material',
  '自定义标题（选填）': 'Custom title (optional)',
  留空则使用网页标题: 'Leave blank to use the page title',
  '正在整理…': 'Organising…',
  '需要登录、付费或动态加载的网站可能无法读取。':
    'Pages requiring sign-in, payment or dynamic loading may not be readable.',
  导入新材料: 'Import new material',
  '一次导入，进入完整学习流程': 'One import, one complete study flow',
  '材料经过整理后，可以在练习、复习、统计和资料库中重复使用。':
    'Organised material can be reused in practice, review, reports and your library.',
  读取来源: 'Read the source',
  检查链接类型与可访问性: 'Check its type and availability',
  整理内容: 'Organise content',
  '提取正文、音频和来源信息': 'Extract text, audio and source details',
  随时从练习页重新打开: 'Open it again from Practice anytime',
  电子书听力方案: 'Listening for ebooks',
  'EPUB 导入后优先使用原有音频；没有音频时可用浏览器朗读。':
    'Use included EPUB audio first; otherwise play it with browser speech.',
  '新的链接、文件、题库和电子书请前往导入中心；这里专注于选择材料并完成练习。':
    'Use Import Center for new links, files, question banks and ebooks. This page is for choosing material and practising.',
  '导入内容尚未保存，确定离开导入中心？':
    'Imported content has not been saved. Leave the Import Center?',
  搜索: 'Search',
  '搜索文章内容、单词、笔记、音频标题…':
    'Search article text, words, notes and audio titles…',
  页面: 'Pages',
  电脑资料: 'Computer library',
  复习内容: 'Review content',
  没有找到匹配内容: 'No matching content',
  '本机资料服务暂时未连接，仍可搜索学习记录。':
    'The local library is offline. Study history is still searchable.',
  换一个更短的关键词试试: 'Try a shorter search term.',
  选择: 'Select',
  打开: 'Open',
  音频正文需要转写后才能检索: 'Audio needs a transcript for full-text search',
  导入网页正文或音频链接: 'Import a public article or audio URL',
  读取并保存: 'Read and save',
  打开电脑中保存的材料: 'Open saved material',
  选择资料或练习档案: 'Choose material or a practice archive',
  推荐主题: 'Recommended topic',
  国际政治: 'International politics',
  经济金融: 'Economics & finance',
  更换练习资源: 'Change practice material',
  选择一份未练习的材料: 'Choose unused material',
  原创练习: 'Original practice',
  原创模拟练习: 'Original practice',
  浏览器朗读: 'Browser reading',
  实时公开资源: 'Live public resources',
  在此练习: 'Practise here',
  '从允许使用的公开 API 更新本机缓存':
    'Update the local cache from permitted public APIs',
  '查询中…': 'Searching…',
  更新资源: 'Refresh resources',
  '当前显示缓存或内置资源；网络恢复后可以再次更新。':
    'Showing cached or built-in resources. Refresh again when the network is available.',
  '公开资源最多每 6 小时更新一次。完成并保存后，将不再出现在推荐列表。':
    'Public resources refresh at most every 6 hours. Completed and saved material leaves the recommendation list.',
  停止朗读: 'Stop reading',
  播放英文朗读: 'Play English reading',
  在此打开: 'Open here',
  把新表达留在单词库: 'Save new language to vocabulary',
  课前词汇预习: 'Vocabulary preview',
  本题建议词汇: 'Suggested vocabulary',
  重点词: 'key words',
  默认折叠: 'collapsed by default',
  '正在分析…': 'Analysing…',
  已写入回答: 'Used in your response',
  建议在回答中使用: 'Try to use this word',
  还不熟悉: 'Still unfamiliar',
  我认识: 'I know this',
  '当前材料没有匹配到内置重点词；仍可在正文中选词收藏。':
    'No built-in key words matched this material. You can still select and save words from the text.',
  '查看、收藏或标记单词后，日期会出现在这里。':
    'Dates appear here after you view, save or mark a word.',
  '单词 / 短语': 'Word / phrase',
  '释义（可稍后补充）': 'Meaning (can add later)',
  收藏单词: 'Save word',
  边练边检查: 'Practise and check',
  写下你的回答: 'Write your response',
  作文: 'Essay',
  写完后自查: 'Check after writing',
  '是否回应两个观点并表达自己的立场？每段是否围绕一个主题？例子是否支持论点？检查时态、冠词和句子边界。':
    'Did you address both views and state your position? Does each paragraph have one focus? Do the examples support your argument? Check tenses, articles and sentence boundaries.',
  '此处不提供 AI 批改或官方分数。':
    'AI marking and official scores are not provided here.',
  选择答案: 'Choose an answer',
  检查答案: 'Check answers',
  复盘笔记: 'Review notes',
  保存练习与材料: 'Save practice and material',
  显示听力原文: 'Show transcript',
  文章: 'Articles',
  单词: 'Vocabulary',
  练习音频: 'Practice audio',
  我的录音: 'My recordings',
  刷新列表: 'Refresh list',
  打包备份: 'Create backup',
  标题: 'Title',
  摘要: 'Summary',
  资料类型: 'Material type',
  词汇: 'Vocabulary',
  语法: 'Grammar',
  '音频时长（秒，未知可留空）': 'Audio duration (seconds; blank if unknown)',
  保存修改: 'Save changes',
  重新提取元数据: 'Extract metadata again',
  手工填写: 'Manual',
  文件名: 'Filename',
  文件内嵌信息: 'Embedded metadata',
  自动提取: 'Automatically extracted',
  未记录: 'Not recorded',
  标题来源: 'Title source',
  提取时间: 'Extraction time',
  时长来源: 'Duration source',
  时长更新时间: 'Duration updated',
  资料更新时间: 'Material updated',
  元数据提取不完整: 'Metadata extraction incomplete',
  '来源链接（选填）': 'Source URL (optional)',
  正文: 'Text',
  '例句（选填）': 'Example (optional)',
  保存到电脑: 'Save to computer',
  搜索已保存资料: 'Search saved material',
  下载原文件: 'Download original',
  开始录音: 'Start recording',
  停止录音: 'Stop recording',
  保存录音: 'Save recording',
  目标总分: 'Target band',
  考试日期: 'Exam date',
  导入进度: 'Import progress',
  替换全部进度: 'Replace all',
  合并进度: 'Merge progress',
  取消: 'Cancel',
  本地自动保存: 'Saved locally',
  '一步一步，走向你的目标。': 'One step at a time, toward your goal.',
  '8 题快速估算当前基础': '8 questions to estimate your foundation',
  '约 10 分钟 · 非官方估算': 'About 10 minutes · unofficial estimate',
  进度保存在当前浏览器: 'Progress is saved in this browser',
  '定期导出，留住每一步。': 'Export regularly to keep every step.',
  分钟: 'min',
  小时: 'hours',
  天: 'days',
  个学习日: 'study days',
  '每天一点，稳步向前': 'A little each day, steadily forward',
  '听一遍抓主旨，再逐句听写并核对原文。':
    'Listen for the main idea, then transcribe and check line by line.',
  '完成一篇阅读，标出定位词与同义替换。':
    'Complete a reading and mark locating words and paraphrases.',
  '用观点、解释和例子，写出一个完整段落。':
    'Write a full paragraph with a claim, explanation and example.',
  '描述一次让你印象深刻的旅行，录音后复述。':
    'Describe a memorable trip, record it, then retell it.',
  在工作台内开始: 'Start in the workbench',
  '直接阅读、听音频、作答和录音。完成后，连同学习材料一起保存到电脑。':
    'Read, listen, answer and record here, then save everything to your computer.',
  进入: 'Open',
  练习: 'practice',
  '内置内容为原创模拟练习；也可以导入公开网页或音频链接。':
    'Built-in material is original practice; you can also import public articles or audio.',
  重置计时: 'Reset timer',
  今天没有到期卡片: 'No cards are due today',
  张卡片已进入复习计划: 'cards in your review plan',
  剩余: 'Remaining',
  '第一条学习记录，从今天开始。': 'Your first study log can start today.',
  '完成练习后，保存你的学习成果。':
    'Save your work after completing a practice.',
  今天: 'Today',
  已记录: 'logged',
  '正文会提取为可阅读文本并保存到电脑。需要登录、付费或动态加载的网站可能无法读取；不会绕过网站访问限制。':
    'Readable text is extracted and saved to your computer. Pages that require sign-in, payment or dynamic loading may not be readable; access restrictions are never bypassed.',
  '原创模拟练习 · 合成语音 · 非官方真题':
    'Original practice · synthetic voice · not an official test',
  '选中原文中的词语，或直接输入；例句会尽量取自当前材料。':
    'Select a word in the text or type it here; the example will use the current material when possible.',
  我的电脑资料库: 'Library on this computer',
  '原文和音频实际保存为文件；备份可整体迁移到其他存储位置。':
    'Texts and audio are saved as files. A backup can move the whole library to another storage service.',
  重新连接: 'Reconnect',
  资料分类: 'Library categories',
  保存练习文章: 'Save a practice article',
  收下一个新单词: 'Save a new word',
  保存练习音频: 'Save practice audio',
  留下自己的声音: 'Save your own voice',
  关联科目: 'Related skill',
  文章原文: 'Article text',
  保存文章: 'Save article',
  保存单词: 'Save word',
  '也可以上传 TXT、Markdown 或 PDF，保留原文件。':
    'You can also upload a TXT, Markdown or PDF file and keep the original.',
  上传文章文件: 'Upload article file',
  上传已有录音: 'Upload a recording',
  上传练习音频: 'Upload practice audio',
  直接录音: 'Record here',
  已保存的: 'Saved ',
  份: 'items',
  查找资料: 'Find material',
  '还没有保存这类资料。': 'No material of this type has been saved yet.',
  '没有找到匹配资料。': 'No matching material was found.',
  '试试其他关键词。': 'Try another search term.',
  '在左侧添加，保存后这里会出现你的学习材料。':
    'Add something on the left and it will appear here after saving.',
  '资料库里的单词，以及已保存练习中的客观题，会自动成为复习卡。原文件不会被修改。':
    'Vocabulary and objective questions from saved practice become review cards automatically. Your original files remain unchanged.',
  '在练习文章里选中单词并收藏，或者保存一次带客观题的练习，然后回来同步。':
    'Save a word from a practice text or save a practice with questions, then return here to sync.',
  '练习中有未保存内容或录音，确定离开？':
    'This practice has unsaved work or a recording. Leave anyway?',
  '资料库有未保存内容或正在进行的操作。离开会放弃未保存的录音或文字，是否继续？':
    'The library has unsaved content or an active operation. Leaving will discard unsaved text or recordings. Continue?',
  '删除这条学习记录？': 'Delete this study log?',
  '切换材料会放弃未保存作答或录音，是否继续？':
    'Changing material will discard unsaved answers or recordings. Continue?',
  '切换分类会放弃当前未保存内容，是否继续？':
    'Changing category will discard the current unsaved content. Continue?',
  '放弃这段尚未保存的录音？': 'Discard this unsaved recording?',
  收起: 'Close',
  查看来源: 'View source',
  '粘贴公开文章或音频的 HTTPS 链接':
    'Paste a public article or audio HTTPS URL',
  选中原文后自动填入: 'Filled when you select text',
  '例如：把……考虑在内': 'For example: consider something',
  '这次的错题原因、关键表达、下次要改进的地方…':
    'Mistakes, useful language and what to improve next time…',
  '记下新表达、错题原因，或下次想改进的地方…':
    'New language, reasons for mistakes or what to improve next…',
};

const ja: Record<string, string> = {
  ...en,
  学习工作台: '学習ワークベンチ',
  我的备考: '試験準備',
  今日学习: '今日の学習',
  练习中心: '練習',
  复习: '復習',
  能力摸底: 'レベル確認',
  学习记录: '学習記録',
  本周学习报表: '今週の学習レポート',
  学习时间: '学習時間',
  阅读文章: '読んだ記事',
  新增单词: '新しい単語',
  实际听音: '実際のリスニング',
  口语录音: 'スピーキング録音',
  认识单词: '覚えた単語',
  单词轨迹: '単語の履歴',
  标记认识: '覚えたと記録',
  重新标记陌生: '未習得に戻す',
  查看: '閲覧',
  收藏: '保存',
  篇: '件',
  个: '語',
  词: '語',
  我的资料库: 'マイライブラリ',
  目标与备份: '目標とバックアップ',
  个人学习空间: '個人学習スペース',
  导出学习进度: '進捗を書き出す',
  我的工作台: 'マイワークベンチ',
  记录学习: '学習を記録',
  '把目标，变成每天的进步。': '目標を、毎日の前進に。',
  '从一个小任务开始，今天的积累会被记住。':
    '小さな課題から始めましょう。今日の積み重ねを記録します。',
  '在这里练习，把进步留下。': 'ここで練習し、成長を残す。',
  '原文、作答、音频和录音，都在同一张工作台。':
    '文章、解答、音声、録音を一つの場所に。',
  '在快要忘记之前，再想起一次。': '忘れる前に、もう一度思い出す。',
  '按照你的记忆表现安排下一次复习，让积累真正留下来。':
    '思い出せた度合いから次の復習日を決め、学びを定着させます。',
  '用几道题，找到现在的起点。': '少ない問題で、今の出発点を知る。',
  '短时间完成基础摸底，结果只用于安排学习。':
    '短時間で基礎を確認し、学習計画の目安にします。',
  '每一次练习，都有迹可循。': '一つひとつの練習を記録に。',
  '学过的内容，留在自己手里。': '学んだ内容を、自分の手元に。',
  '给下一阶段，定一个目标。': '次の段階に向けて目標を決める。',
  目标分数: '目標スコア',
  调整目标: '目標を変更',
  累计学习: '累計学習',
  距离考试: '試験まで',
  设置考试日期: '試験日を設定',
  查看备考目标: '目標を見る',
  今日四项练习: '今日の4技能',
  已记录: '記録済み',
  听力: 'リスニング',
  阅读: 'リーディング',
  写作: 'ライティング',
  口语: 'スピーキング',
  精听一段录音: '音声を精聴する',
  限时阅读与错题复盘: '時間を測って読解・復習',
  练习一个论证段落: '論証段落を書く',
  练习一个口语话题: 'スピーキング課題',
  专注此刻: '集中タイマー',
  开始专注: '集中を始める',
  暂停专注: '一時停止',
  '学习时长（分钟）': '学習時間（分）',
  '练习分数（选填）': '練習スコア（任意）',
  '这次学到了什么？': '今回学んだこと',
  保存学习记录: '学習記録を保存',
  今日复习: '今日の復習',
  '最近 7 天': '最近7日間',
  '学习时长 · 分钟': '学習時間・分',
  最近的积累: '最近の積み重ね',
  全部记录: 'すべての記録',
  开始今日学习: '今日の学習を始める',
  导出记录: '記録を書き出す',
  今天待复习: '今日の復習',
  今日已完成: '今日は完了',
  开始复习: '復習を始める',
  全部卡片: '全カード',
  已掌握: '定着済み',
  连续复习: '連続復習',
  '近 14 天记住率': '14日間の正答率',
  '14 天复习曲线': '14日間の復習曲線',
  复习材料自动整理: '復習教材を自動整理',
  同步资料库: 'ライブラリを同期',
  '正在同步…': '同期中…',
  先收集第一张复习卡: '最初の復習カードを集めましょう',
  退出复习: '復習を終了',
  显示答案: '答えを見る',
  单词卡: '単語カード',
  错题卡: '問題カード',
  忘记: '忘れた',
  困难: '難しい',
  记得: '覚えた',
  熟练: '簡単',
  今天再看: '今日もう一度',
  今天的复习完成了: '今日の復習は完了です',
  查看复习统计: '復習統計を見る',
  听力练习: 'リスニング練習',
  阅读练习: 'リーディング練習',
  写作练习: 'ライティング練習',
  口语练习: 'スピーキング練習',
  导入中心: 'インポートセンター',
  开始练习: '練習を始める',
  '把散落的材料，整理成下一次练习。':
    '散らばった教材を、次の練習へつなげましょう。',
  '链接、文件、题库和电子书，将从这里进入你的学习系统。':
    'リンク、ファイル、問題集、電子書籍をここから学習システムに取り込みます。',
  选择来源: '取り込み元を選ぶ',
  网页与音频链接: 'Web・音声URL',
  现在可用: '利用可能',
  文档与音频文件: '文書・音声ファイル',
  资料库已支持: '資料庫で利用可能',
  下一阶段: '次の段階',
  规划中: '計画中',
  '已有本地文件？': '手元にファイルがありますか？',
  前往资料库上传: '資料庫でアップロード',
  从一个链接开始整理: 'リンクから教材を整理する',
  '粘贴公开网页或直接音频地址，正文和原文件会保存到电脑。':
    '公開ページまたは音声のURLを貼り付けると、本文や元ファイルをパソコンに保存します。',
  本机保存: 'ローカル保存',
  '公开 HTTPS 链接': '公開HTTPS URL',
  用于练习: '練習用途',
  写作素材: 'ライティング教材',
  口语素材: 'スピーキング教材',
  '自定义标题（选填）': 'タイトル（任意）',
  留空则使用网页标题: '空欄の場合はページタイトルを使用',
  '正在整理…': '整理中…',
  '需要登录、付费或动态加载的网站可能无法读取。':
    'ログイン、支払い、動的読み込みが必要なページは取得できない場合があります。',
  导入新材料: '新しい教材を取り込む',
  '一次导入，进入完整学习流程': '一度の取り込みで学習全体へ',
  '材料经过整理后，可以在练习、复习、统计和资料库中重复使用。':
    '整理した教材は、練習・復習・統計・資料庫で繰り返し使えます。',
  读取来源: '取り込み元を読む',
  检查链接类型与可访问性: '形式とアクセス可否を確認',
  整理内容: '内容を整理',
  '提取正文、音频和来源信息': '本文・音声・出典情報を抽出',
  随时从练习页重新打开: '練習ページからいつでも再開',
  电子书听力方案: '電子書籍のリスニング',
  'EPUB 导入后优先使用原有音频；没有音频时可用浏览器朗读。':
    'EPUB内の音声を優先し、音声がなければブラウザー読み上げを使います。',
  '新的链接、文件、题库和电子书请前往导入中心；这里专注于选择材料并完成练习。':
    '新しいリンク、ファイル、問題集、電子書籍はインポートセンターへ。ここでは教材を選んで練習します。',
  '导入内容尚未保存，确定离开导入中心？':
    '取り込み内容はまだ保存されていません。インポートセンターを離れますか？',
  搜索: '検索',
  '搜索文章内容、单词、笔记、音频标题…':
    '記事本文、単語、メモ、音声タイトルを検索…',
  页面: 'ページ',
  电脑资料: 'パソコンの資料',
  复习内容: '復習内容',
  没有找到匹配内容: '一致する内容がありません',
  '本机资料服务暂时未连接，仍可搜索学习记录。':
    'ローカル資料サービスは未接続ですが、学習記録は検索できます。',
  换一个更短的关键词试试: 'より短いキーワードを試してください。',
  选择: '選択',
  打开: '開く',
  音频正文需要转写后才能检索: '音声の全文検索には文字起こしが必要です',
  导入网页正文或音频链接: '公開記事または音声URLを読み込む',
  读取并保存: '読み込んで保存',
  打开电脑中保存的材料: '保存済み教材を開く',
  选择资料或练习档案: '教材または練習記録を選択',
  推荐主题: 'おすすめテーマ',
  国际政治: '国際政治',
  经济金融: '経済・金融',
  更换练习资源: '練習教材を変更',
  选择一份未练习的材料: '未学習の教材を選択',
  原创练习: 'オリジナル練習',
  原创模拟练习: 'オリジナル練習',
  浏览器朗读: 'ブラウザー読み上げ',
  实时公开资源: '最新の公開教材',
  在此练习: 'ここで練習',
  '从允许使用的公开 API 更新本机缓存':
    '利用可能な公開APIからローカルキャッシュを更新',
  '查询中…': '検索中…',
  更新资源: '教材を更新',
  '当前显示缓存或内置资源；网络恢复后可以再次更新。':
    'キャッシュまたは内蔵教材を表示しています。ネットワーク復旧後に再更新できます。',
  '公开资源最多每 6 小时更新一次。完成并保存后，将不再出现在推荐列表。':
    '公開教材は最大6時間ごとに更新します。完了して保存した教材はおすすめから外れます。',
  停止朗读: '読み上げを停止',
  播放英文朗读: '英語の読み上げを再生',
  在此打开: 'ここで開く',
  把新表达留在单词库: '新しい表現を単語帳に保存',
  课前词汇预习: '学習前の重要語句',
  本题建议词汇: 'この問題のおすすめ語彙',
  重点词: '重要語',
  默认折叠: '初期状態では折りたたみ',
  '正在分析…': '分析中…',
  已写入回答: '回答で使用済み',
  建议在回答中使用: '回答で使ってみましょう',
  还不熟悉: 'まだ不安',
  我认识: '知っている',
  '当前材料没有匹配到内置重点词；仍可在正文中选词收藏。':
    '内蔵の重要語句に一致しませんでした。本文から選んで保存できます。',
  '查看、收藏或标记单词后，日期会出现在这里。':
    '単語を閲覧・保存・分類すると、日付がここに表示されます。',
  '单词 / 短语': '単語・フレーズ',
  '释义（可稍后补充）': '意味（後から追加可）',
  收藏单词: '単語を保存',
  边练边检查: '練習して確認',
  写下你的回答: '回答を書く',
  作文: '作文',
  写完后自查: '書き終えたら確認',
  '是否回应两个观点并表达自己的立场？每段是否围绕一个主题？例子是否支持论点？检查时态、冠词和句子边界。':
    '両方の意見に触れ、自分の立場を示しましたか。各段落に一つの焦点がありますか。例は主張を支えていますか。時制・冠詞・文の区切りも確認しましょう。',
  '此处不提供 AI 批改或官方分数。':
    'ここではAI添削や公式スコアは提供しません。',
  选择答案: '答えを選択',
  检查答案: '答えを確認',
  复盘笔记: '復習メモ',
  保存练习与材料: '練習と教材を保存',
  显示听力原文: 'スクリプトを表示',
  文章: '記事',
  单词: '単語',
  练习音频: '練習音声',
  我的录音: '自分の録音',
  刷新列表: '一覧を更新',
  打包备份: 'バックアップ作成',
  标题: 'タイトル',
  摘要: '概要',
  资料类型: '教材タイプ',
  词汇: '語彙',
  语法: '文法',
  '音频时长（秒，未知可留空）': '音声の長さ（秒、不明なら空欄）',
  保存修改: '変更を保存',
  重新提取元数据: 'メタデータを再取得',
  手工填写: '手動入力',
  文件名: 'ファイル名',
  文件内嵌信息: '埋め込み情報',
  自动提取: '自動取得',
  未记录: '未記録',
  标题来源: 'タイトルの出典',
  提取时间: '取得日時',
  时长来源: '再生時間の出典',
  时长更新时间: '再生時間の更新日時',
  资料更新时间: '教材の更新日時',
  元数据提取不完整: 'メタデータの取得が不完全です',
  '来源链接（选填）': '出典URL（任意）',
  正文: '本文',
  '例句（选填）': '例文（任意）',
  保存到电脑: 'パソコンに保存',
  搜索已保存资料: '保存済み教材を検索',
  下载原文件: '元ファイルをダウンロード',
  开始录音: '録音開始',
  停止录音: '録音停止',
  保存录音: '録音を保存',
  目标总分: '目標バンド',
  考试日期: '試験日',
  导入进度: '進捗を読み込む',
  替换全部进度: 'すべて置換',
  合并进度: '進捗を統合',
  取消: 'キャンセル',
  本地自动保存: 'ローカル自動保存',
  '一步一步，走向你的目标。': '一歩ずつ、目標へ。',
  '8 题快速估算当前基础': '8問で現在の基礎を確認',
  '约 10 分钟 · 非官方估算': '約10分・非公式の目安',
  进度保存在当前浏览器: '進捗はこのブラウザに保存されます',
  '定期导出，留住每一步。': '定期的に書き出して学習記録を守りましょう。',
  分钟: '分',
  小时: '時間',
  天: '日',
  个学习日: '学習日',
  '每天一点，稳步向前': '毎日少しずつ、着実に前へ',
  '听一遍抓主旨，再逐句听写并核对原文。':
    'まず要点を聞き、次に一文ずつ書き取って確認します。',
  '完成一篇阅读，标出定位词与同义替换。':
    '文章を読み、根拠となる語句と言い換えを確認します。',
  '用观点、解释和例子，写出一个完整段落。':
    '主張・説明・例を使って一段落を書きます。',
  '描述一次让你印象深刻的旅行，录音后复述。':
    '印象に残った旅について話し、録音後に言い直します。',
  在工作台内开始: 'ワークベンチ内で開始',
  '直接阅读、听音频、作答和录音。完成后，连同学习材料一起保存到电脑。':
    'ここで読み、聞き、解答・録音し、教材と一緒にパソコンへ保存します。',
  进入: '開く',
  练习: '練習',
  '内置内容为原创模拟练习；也可以导入公开网页或音频链接。':
    '内蔵教材はオリジナル模擬練習です。公開記事や音声も読み込めます。',
  重置计时: 'タイマーをリセット',
  今天没有到期卡片: '今日が期限のカードはありません',
  张卡片已进入复习计划: '枚を復習計画に登録済み',
  剩余: '残り',
  '第一条学习记录，从今天开始。': '最初の学習記録を今日から始めましょう。',
  '完成练习后，保存你的学习成果。': '練習後に学習成果を保存できます。',
  今天: '今日',
  '回看练习、分数和复盘，找到下一步的重点。':
    '練習・スコア・振り返りを確認し、次に集中する点を見つけます。',
  '收藏文章和单词，保存音频，回听每一次口语练习。':
    '記事と単語を集め、音声を保存し、スピーキング録音を聞き返せます。',
  '按自己的节奏备考，随时备份与迁移学习进度。':
    '自分のペースで学び、いつでも進捗をバックアップ・移行できます。',
  '正文会提取为可阅读文本并保存到电脑。需要登录、付费或动态加载的网站可能无法读取；不会绕过网站访问限制。':
    '読みやすい本文を抽出してパソコンに保存します。ログイン・有料・動的読込が必要なページは取得できない場合があり、アクセス制限は回避しません。',
  '原创模拟练习 · 合成语音 · 非官方真题':
    'オリジナル模擬練習・合成音声・公式問題ではありません',
  '选中原文中的词语，或直接输入；例句会尽量取自当前材料。':
    '本文の語句を選択するか直接入力します。できる限り現在の教材から例文を取り込みます。',
  我的电脑资料库: 'このパソコンのライブラリ',
  '原文和音频实际保存为文件；备份可整体迁移到其他存储位置。':
    '文章と音声はファイルとして保存され、バックアップで別の保存先へまとめて移行できます。',
  重新连接: '再接続',
  资料分类: '教材カテゴリー',
  保存练习文章: '練習記事を保存',
  收下一个新单词: '新しい単語を保存',
  保存练习音频: '練習音声を保存',
  留下自己的声音: '自分の声を保存',
  关联科目: '関連する技能',
  文章原文: '記事本文',
  保存文章: '記事を保存',
  保存单词: '単語を保存',
  '也可以上传 TXT、Markdown 或 PDF，保留原文件。':
    'TXT・Markdown・PDFをアップロードし、元ファイルも保存できます。',
  上传文章文件: '記事ファイルをアップロード',
  上传已有录音: '録音をアップロード',
  上传练习音频: '練習音声をアップロード',
  直接录音: 'ここで録音',
  已保存的: '保存済みの',
  份: '件',
  查找资料: '教材を検索',
  '还没有保存这类资料。': 'この種類の教材はまだ保存されていません。',
  '没有找到匹配资料。': '一致する教材が見つかりませんでした。',
  '试试其他关键词。': '別のキーワードをお試しください。',
  '在左侧添加，保存后这里会出现你的学习材料。':
    '左側から追加して保存すると、ここに教材が表示されます。',
  '资料库里的单词，以及已保存练习中的客观题，会自动成为复习卡。原文件不会被修改。':
    'ライブラリの単語と保存済み練習の選択問題から、復習カードを自動作成します。元ファイルは変更しません。',
  '在练习文章里选中单词并收藏，或者保存一次带客观题的练习，然后回来同步。':
    '練習文から単語を保存するか、選択問題付きの練習を保存してから同期してください。',
  '练习中有未保存内容或录音，确定离开？':
    '練習に未保存の内容または録音があります。移動しますか？',
  '资料库有未保存内容或正在进行的操作。离开会放弃未保存的录音或文字，是否继续？':
    'ライブラリに未保存の内容または進行中の操作があります。未保存の文章や録音を破棄して移動しますか？',
  '删除这条学习记录？': 'この学習記録を削除しますか？',
  '切换材料会放弃未保存作答或录音，是否继续？':
    '教材を切り替えると未保存の解答や録音が破棄されます。続けますか？',
  '切换分类会放弃当前未保存内容，是否继续？':
    'カテゴリーを切り替えると未保存の内容が破棄されます。続けますか？',
  '放弃这段尚未保存的录音？': 'この未保存の録音を破棄しますか？',
  收起: '閉じる',
  查看来源: '出典を見る',
  '粘贴公开文章或音频的 HTTPS 链接':
    '公開記事または音声のHTTPSリンクを貼り付け',
  选中原文后自动填入: '本文を選択すると自動入力',
  '例如：把……考虑在内': '例：～を考慮に入れる',
  '这次的错题原因、关键表达、下次要改进的地方…':
    '間違えた理由、重要表現、次回改善したいこと…',
  '记下新表达、错题原因，或下次想改进的地方…':
    '新しい表現、間違えた理由、次回改善したいこと…',
};

const tw: Record<string, string> = Object.fromEntries(
  Object.keys(en).map((key) => [key, key]),
);
Object.assign(tw, {
  学习工作台: '學習工作台',
  我的备考: '我的備考',
  今日学习: '今日學習',
  练习中心: '練習中心',
  复习: '複習',
  能力摸底: '能力摸底',
  学习记录: '學習記錄',
  我的资料库: '我的資料庫',
  目标与备份: '目標與備份',
  导出学习进度: '匯出學習進度',
  记录学习: '記錄學習',
  目标分数: '目標分數',
  调整目标: '調整目標',
  累计学习: '累計學習',
  距离考试: '距離考試',
  今日四项练习: '今日四項練習',
  听力: '聽力',
  阅读: '閱讀',
  写作: '寫作',
  口语: '口說',
  今日复习: '今日複習',
  '最近 7 天': '最近 7 天',
  今天待复习: '今天待複習',
  开始复习: '開始複習',
  全部卡片: '全部卡片',
  已掌握: '已掌握',
  连续复习: '連續複習',
  '14 天复习曲线': '14 天複習曲線',
  同步资料库: '同步資料庫',
  显示答案: '顯示答案',
  忘记: '忘記',
  记得: '記得',
  熟练: '熟練',
  听力练习: '聽力練習',
  阅读练习: '閱讀練習',
  写作练习: '寫作練習',
  口语练习: '口說練習',
  读取并保存: '讀取並儲存',
  选择答案: '選擇答案',
  检查答案: '檢查答案',
  复盘笔记: '複盤筆記',
  保存练习与材料: '儲存練習與材料',
  文章: '文章',
  单词: '單字',
  练习音频: '練習音訊',
  我的录音: '我的錄音',
  标题: '標題',
  摘要: '摘要',
  资料类型: '資料類型',
  词汇: '詞彙',
  语法: '文法',
  '音频时长（秒，未知可留空）': '音訊時長（秒，未知可留空）',
  保存修改: '儲存修改',
  重新提取元数据: '重新擷取中繼資料',
  手工填写: '手動填寫',
  文件名: '檔名',
  文件内嵌信息: '檔案內嵌資訊',
  自动提取: '自動擷取',
  未记录: '尚未記錄',
  标题来源: '標題來源',
  提取时间: '擷取時間',
  时长来源: '時長來源',
  时长更新时间: '時長更新時間',
  资料更新时间: '資料更新時間',
  元数据提取不完整: '中繼資料擷取不完整',
  正文: '正文',
  保存到电脑: '儲存到電腦',
  下载原文件: '下載原始檔',
  目标总分: '目標總分',
  考试日期: '考試日期',
  导入进度: '匯入進度',
  替换全部进度: '取代全部進度',
  合并进度: '合併進度',
  取消: '取消',
  个人学习空间: '個人學習空間',
  进度保存在当前浏览器: '進度儲存在目前瀏覽器',
  '定期导出，留住每一步。': '定期匯出，保留每一步。',
  '用几道题，找到现在的起点。': '用幾道題，找到目前的起點。',
  '短时间完成基础摸底，结果只用于安排学习。':
    '短時間完成基礎摸底，結果只用於安排學習。',
  本地自动保存: '本機自動儲存',
  '一步一步，走向你的目标。': '一步一步，走向你的目標。',
});

const dictionaries: Record<Locale, Record<string, string>> = {
  ja,
  en,
  'zh-CN': {},
  'zh-TW': tw,
};

const traditionalCharacters: Record<string, string> = {
  学: '學',
  习: '習',
  进: '進',
  步: '步',
  标: '標',
  变: '變',
  积: '積',
  录: '錄',
  听: '聽',
  读: '讀',
  词: '詞',
  频: '頻',
  说: '說',
  练: '練',
  题: '題',
  误: '誤',
  复: '複',
  盘: '盤',
  时: '時',
  写: '寫',
  论: '論',
  证: '證',
  观: '觀',
  点: '點',
  释: '釋',
  满: '滿',
  内: '內',
  网: '網',
  页: '頁',
  链: '鏈',
  计: '計',
  达: '達',
  结: '結',
  仅: '僅',
  储: '儲',
  导: '導',
  张: '張',
  划: '劃',
  开: '開',
  选: '選',
  总: '總',
  数: '數',
  据: '據',
  库: '庫',
  个: '個',
  条: '條',
  长: '長',
  这: '這',
  从: '從',
  声: '聲',
  当: '當',
  浏: '瀏',
  览: '覽',
  稳: '穩',
  后: '後',
  让: '讓',
  够: '夠',
  与: '與',
  语: '語',
  测: '測',
  试: '試',
  门: '門',
  无: '無',
  为: '為',
  设: '設',
  备: '備',
  换: '換',
  移: '移',
  动: '動',
  实: '實',
  现: '現',
  历: '歷',
  史: '史',
  记: '記',
  索: '索',
  寻: '尋',
  优: '優',
  化: '化',
  应: '應',
  对: '對',
  义: '義',
  简: '簡',
  体: '體',
  繁: '繁',
  处: '處',
  发: '發',
  过: '過',
  还: '還',
  已: '已',
  连: '連',
  续: '續',
  显: '顯',
  查: '查',
  看: '看',
  载: '載',
  传: '傳',
  统: '統',
  组: '組',
  织: '織',
  经: '經',
  验: '驗',
  间: '間',
  单: '單',
  线: '線',
  关: '關',
  闭: '閉',
  暂: '暫',
  停: '停',
  将: '將',
  并: '並',
  请: '請',
  确: '確',
  认: '認',
  买: '買',
  费: '費',
  额: '額',
  该: '該',
  类: '類',
  务: '務',
  会: '會',
  钟: '鐘',
  阅: '閱',
  错: '錯',
  话: '話',
  电: '電',
  脑: '腦',
  创: '創',
  拟: '擬',
  余: '餘',
  专: '專',
  么: '麼',
  础: '礎',
  约: '約',
  见: '見',
};

export function translate(locale: Locale, value: string) {
  if (locale === 'zh-CN') return value;
  const translated = dictionaries[locale][value] || value;
  if (locale !== 'zh-TW') return translated;
  return Array.from(
    translated,
    (character) => traditionalCharacters[character] || character,
  ).join('');
}

export function DomLocalizer({ locale }: { locale: Locale }) {
  const originals = useRef(new WeakMap<Text, string>());
  const applied = useRef(new WeakMap<Text, string>());
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === 'ja'
        ? 'IELTS 学習ワークベンチ'
        : locale === 'en'
          ? 'IELTS Study Workbench'
          : locale === 'zh-TW'
            ? 'IELTS 學習工作台'
            : 'IELTS 学习工作台';
    const dictionary = dictionaries[locale];
    const excluded =
      '[data-user-content], .practice-text, .practice-citation, .practice-question, .assessment-test, .library-item, .history-row p, .recent-row b, input, textarea';
    const translateDynamic = (value: string) => {
      const match = value.match(/^(\d+) 张卡片待复习$/);
      if (match)
        return locale === 'ja'
          ? `${match[1]}枚のカードを復習`
          : locale === 'en'
            ? `${match[1]} cards due`
            : `${match[1]} 張卡片待複習`;
      const planned = value.match(/^(\d+) 张卡片已进入复习计划$/);
      if (planned)
        return locale === 'ja'
          ? `${planned[1]}枚を復習計画に登録済み`
          : locale === 'en'
            ? `${planned[1]} cards in your review plan`
            : `${planned[1]} 張卡片已進入複習計畫`;
      const previous = value.match(/^上次测试：(.*)$/);
      if (previous)
        return locale === 'ja'
          ? `前回のテスト：${previous[1]}`
          : locale === 'en'
            ? `Previous test: ${previous[1]}`
            : `上次測試：${previous[1]}`;
      return null;
    };
    const translateText = (node: Text) => {
      if (node.parentElement?.closest(excluded)) return;
      if (node.data !== applied.current.get(node))
        originals.current.set(node, node.data);
      const value = originals.current.get(node) || node.data;
      const trimmed = value.trim();
      let translated =
        locale === 'zh-CN'
          ? trimmed
          : dictionary[trimmed] || translateDynamic(trimmed);
      if (!translated) {
        let partial = trimmed;
        for (const source of Object.keys(dictionary).sort(
          (a, b) => b.length - a.length,
        )) {
          if (source.length >= 3 && partial.includes(source))
            partial = partial.replaceAll(source, dictionary[source]);
        }
        if (partial !== trimmed) translated = partial;
      }
      if (locale === 'zh-TW') {
        const base = translated || trimmed;
        const converted = Array.from(
          base,
          (character) => traditionalCharacters[character] || character,
        ).join('');
        if (converted !== trimmed) translated = converted;
      }
      const next = translated ? value.replace(trimmed, translated) : value;
      applied.current.set(node, next);
      if (node.data !== next) node.data = next;
    };
    const translateElement = (element: Element) => {
      for (const attribute of ['placeholder', 'title', 'aria-label']) {
        const value = element.getAttribute(attribute);
        if (value) {
          const original =
            element.getAttribute(`data-i18n-${attribute}`) || value;
          if (!element.hasAttribute(`data-i18n-${attribute}`))
            element.setAttribute(`data-i18n-${attribute}`, original);
          const next =
            locale === 'zh-CN' ? original : dictionary[original] || original;
          if (value !== next) element.setAttribute(attribute, next);
        }
      }
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) translateText(child as Text);
        else if (child.nodeType === Node.ELEMENT_NODE)
          translateElement(child as Element);
      }
    };
    translateElement(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData')
          translateText(mutation.target as Text);
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) translateText(node as Text);
          else if (node.nodeType === Node.ELEMENT_NODE)
            translateElement(node as Element);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [locale]);
  return null;
}
