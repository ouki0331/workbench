INSERT OR IGNORE INTO tag_groups (id, key, selection_mode, color_token, sort_order) VALUES
  ('tag-group-content-type', 'content_type', 'single', 'terracotta', 10),
  ('tag-group-skill', 'skill', 'multi', 'forest', 20),
  ('tag-group-topic', 'topic', 'multi', 'amber', 30),
  ('tag-group-genre', 'genre', 'multi', 'clay', 40),
  ('tag-group-exam', 'exam', 'multi', 'plum', 50),
  ('tag-group-level', 'level', 'single', 'plum', 60),
  ('tag-group-user', 'user', 'multi', 'neutral', 90);

INSERT OR IGNORE INTO tags
  (id, group_id, key, name_en, name_ja, name_zh_cn, name_zh_tw, external_scheme, external_id, sort_order)
VALUES
  ('type-article', 'tag-group-content-type', 'article', 'Article', '記事', '文章', '文章', 'DCMIType', 'Text', 10),
  ('type-news-report', 'tag-group-content-type', 'news_report', 'News report', 'ニュース記事', '新闻报道', '新聞報導', 'internal', 'news_report', 20),
  ('type-essay', 'tag-group-content-type', 'essay', 'Essay', 'エッセイ', '随笔', '隨筆', 'internal', 'essay', 30),
  ('type-prose', 'tag-group-content-type', 'prose', 'Prose', '散文', '散文', '散文', 'internal', 'prose', 35),
  ('type-fiction', 'tag-group-content-type', 'fiction', 'Fiction', 'フィクション', '小说作品', '小說作品', 'internal', 'fiction', 40),
  ('type-book-chapter', 'tag-group-content-type', 'book_chapter', 'Book chapter', '書籍の章', '书籍章节', '書籍章節', 'internal', 'book_chapter', 50),
  ('type-transcript', 'tag-group-content-type', 'transcript', 'Transcript', '書き起こし', '转写文本', '轉寫文字', 'internal', 'transcript', 60),
  ('type-question-set', 'tag-group-content-type', 'question_set', 'Question set', '問題集', '题组', '題組', 'internal', 'question_set', 70),
  ('type-audio', 'tag-group-content-type', 'audio', 'Audio', '音声', '音频', '音訊', 'DCMIType', 'Sound', 80),
  ('type-recording', 'tag-group-content-type', 'recording', 'My recording', '自分の録音', '我的录音', '我的錄音', 'internal', 'recording', 90),
  ('type-vocabulary', 'tag-group-content-type', 'vocabulary', 'Vocabulary entry', '単語項目', '词汇条目', '詞彙條目', 'internal', 'vocabulary', 100),

  ('skill-listening', 'tag-group-skill', 'listening', 'Listening', 'リスニング', '听力', '聽力', 'internal', 'listening', 10),
  ('skill-reading', 'tag-group-skill', 'reading', 'Reading', 'リーディング', '阅读', '閱讀', 'internal', 'reading', 20),
  ('skill-writing', 'tag-group-skill', 'writing', 'Writing', 'ライティング', '写作', '寫作', 'internal', 'writing', 30),
  ('skill-speaking', 'tag-group-skill', 'speaking', 'Speaking', 'スピーキング', '口语', '口語', 'internal', 'speaking', 40),
  ('skill-vocabulary', 'tag-group-skill', 'vocabulary', 'Vocabulary', '語彙', '词汇', '詞彙', 'internal', 'vocabulary', 50),
  ('skill-grammar', 'tag-group-skill', 'grammar', 'Grammar', '文法', '语法', '語法', 'internal', 'grammar', 60),

  ('topic-politics', 'tag-group-topic', 'politics', 'Politics', '政治', '政治', '政治', 'internal-curated-from-IPTC', 'medtop:11000000', 10),
  ('topic-international-relations', 'tag-group-topic', 'international_relations', 'International relations', '国際関係', '国际关系', '國際關係', 'internal-curated-from-IPTC', 'international_relations', 20),
  ('topic-economy', 'tag-group-topic', 'economy', 'Economy', '経済', '经济', '經濟', 'internal-curated-from-IPTC', 'medtop:04000000', 30),
  ('topic-finance', 'tag-group-topic', 'finance', 'Finance', '金融', '金融', '金融', 'internal-curated-from-IPTC', 'finance', 40),
  ('topic-business', 'tag-group-topic', 'business', 'Business', 'ビジネス', '商业', '商業', 'internal-curated-from-IPTC', 'business', 50),
  ('topic-science', 'tag-group-topic', 'science', 'Science', '科学', '科学', '科學', 'internal-curated-from-IPTC', 'medtop:13000000', 60),
  ('topic-technology', 'tag-group-topic', 'technology', 'Technology', 'テクノロジー', '科技', '科技', 'internal-curated-from-IPTC', 'medtop:20000756', 70),
  ('topic-environment', 'tag-group-topic', 'environment', 'Environment', '環境', '环境', '環境', 'IPTC Media Topics', 'medtop:06000000', 80),
  ('topic-education', 'tag-group-topic', 'education', 'Education', '教育', '教育', '教育', 'IPTC Media Topics', 'medtop:05000000', 90),
  ('topic-health', 'tag-group-topic', 'health', 'Health', '健康', '健康', '健康', 'IPTC Media Topics', 'medtop:07000000', 100),
  ('topic-society', 'tag-group-topic', 'society', 'Society', '社会', '社会', '社會', 'IPTC Media Topics', 'medtop:14000000', 110),
  ('topic-culture', 'tag-group-topic', 'culture', 'Culture', '文化', '文化', '文化', 'internal-curated-from-IPTC', 'culture', 120),
  ('topic-arts-entertainment', 'tag-group-topic', 'arts_entertainment', 'Arts and entertainment', '芸術・娯楽', '艺术与娱乐', '藝術與娛樂', 'IPTC Media Topics', 'medtop:20000002', 130),
  ('topic-literature', 'tag-group-topic', 'literature', 'Literature', '文学', '文学', '文學', 'internal', 'literature', 140),
  ('topic-history', 'tag-group-topic', 'history', 'History', '歴史', '历史', '歷史', 'internal', 'history', 150),
  ('topic-law-justice', 'tag-group-topic', 'law_justice', 'Law and justice', '法律・司法', '法律与司法', '法律與司法', 'internal-curated-from-IPTC', 'medtop:02000000', 160),
  ('topic-conflict-security', 'tag-group-topic', 'conflict_security', 'Conflict and security', '紛争・安全保障', '冲突与安全', '衝突與安全', 'IPTC Media Topics', 'medtop:16000000', 170),

  ('genre-news', 'tag-group-genre', 'news', 'News', 'ニュース', '新闻', '新聞', 'internal', 'news', 10),
  ('genre-analysis', 'tag-group-genre', 'analysis', 'Analysis', '分析', '分析', '分析', 'internal', 'analysis', 20),
  ('genre-opinion', 'tag-group-genre', 'opinion', 'Opinion', '論説', '评论', '評論', 'internal', 'opinion', 30),
  ('genre-explainer', 'tag-group-genre', 'explainer', 'Explainer', '解説', '解读', '解讀', 'internal', 'explainer', 40),
  ('genre-academic', 'tag-group-genre', 'academic', 'Academic', '学術', '学术', '學術', 'internal', 'academic', 50),
  ('genre-biography', 'tag-group-genre', 'biography', 'Biography', '伝記', '传记', '傳記', 'internal', 'biography', 60),
  ('genre-speech', 'tag-group-genre', 'speech', 'Speech', 'スピーチ', '演讲', '演講', 'internal', 'speech', 70),
  ('genre-interview', 'tag-group-genre', 'interview', 'Interview', 'インタビュー', '访谈', '訪談', 'internal', 'interview', 80),
  ('genre-dialogue', 'tag-group-genre', 'dialogue', 'Dialogue', '対話', '对话', '對話', 'internal', 'dialogue', 90),
  ('genre-narrative', 'tag-group-genre', 'narrative', 'Narrative', '物語', '叙事', '敘事', 'internal', 'narrative', 100),
  ('genre-prose', 'tag-group-genre', 'prose', 'Prose', '散文', '散文', '散文', 'internal', 'genre_prose', 105),
  ('genre-personal-essay', 'tag-group-genre', 'personal_essay', 'Personal essay', '随筆', '随笔', '隨筆', 'internal', 'personal_essay', 106),
  ('genre-short-story', 'tag-group-genre', 'short_story', 'Short story', '短編小説', '短篇小说', '短篇小說', 'internal', 'short_story', 110),
  ('genre-novel', 'tag-group-genre', 'novel', 'Novel', '小説', '长篇小说', '長篇小說', 'internal', 'novel', 120),
  ('genre-poetry', 'tag-group-genre', 'poetry', 'Poetry', '詩', '诗歌', '詩歌', 'internal', 'poetry', 130),
  ('genre-report', 'tag-group-genre', 'report', 'Report', '報告書', '报告', '報告', 'internal', 'report', 140),
  ('genre-review', 'tag-group-genre', 'review', 'Review', 'レビュー', '评论文章', '評論文章', 'internal', 'review', 150),
  ('genre-instructions', 'tag-group-genre', 'instructions', 'Instructions', '手順', '说明', '說明', 'internal', 'instructions', 160),

  ('exam-general', 'tag-group-exam', 'general_english', 'General English', '一般英語', '通用英语', '通用英語', 'internal', 'general_english', 10),
  ('exam-ielts', 'tag-group-exam', 'ielts', 'IELTS', 'IELTS', '雅思', '雅思', 'internal', 'ielts', 20),
  ('exam-toefl', 'tag-group-exam', 'toefl', 'TOEFL', 'TOEFL', '托福', '托福', 'internal', 'toefl', 30),

  ('level-pre-a1', 'tag-group-level', 'pre_a1', 'Pre-A1', 'Pre-A1', 'Pre-A1', 'Pre-A1', 'CEFR', 'Pre-A1', 5),
  ('level-a1', 'tag-group-level', 'a1', 'A1', 'A1', 'A1', 'A1', 'CEFR', 'A1', 10),
  ('level-a2', 'tag-group-level', 'a2', 'A2', 'A2', 'A2', 'A2', 'CEFR', 'A2', 20),
  ('level-b1', 'tag-group-level', 'b1', 'B1', 'B1', 'B1', 'B1', 'CEFR', 'B1', 30),
  ('level-b2', 'tag-group-level', 'b2', 'B2', 'B2', 'B2', 'B2', 'CEFR', 'B2', 40),
  ('level-c1', 'tag-group-level', 'c1', 'C1', 'C1', 'C1', 'C1', 'CEFR', 'C1', 50),
  ('level-c2', 'tag-group-level', 'c2', 'C2', 'C2', 'C2', 'C2', 'CEFR', 'C2', 60);

INSERT OR IGNORE INTO places
  (id, kind, code_scheme, code, parent_id, name_en, name_ja, name_zh_cn, name_zh_tw)
VALUES
  ('place-world', 'world', 'UN-M49', '001', NULL, 'World', '世界', '全球', '全球'),
  ('place-africa', 'region', 'UN-M49', '002', 'place-world', 'Africa', 'アフリカ', '非洲', '非洲'),
  ('place-americas', 'region', 'UN-M49', '019', 'place-world', 'Americas', 'アメリカ大陸', '美洲', '美洲'),
  ('place-asia', 'region', 'UN-M49', '142', 'place-world', 'Asia', 'アジア', '亚洲', '亞洲'),
  ('place-europe', 'region', 'UN-M49', '150', 'place-world', 'Europe', 'ヨーロッパ', '欧洲', '歐洲'),
  ('place-oceania', 'region', 'UN-M49', '009', 'place-world', 'Oceania', 'オセアニア', '大洋洲', '大洋洲');
