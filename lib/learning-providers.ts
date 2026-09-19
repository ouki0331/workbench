import type { Locale } from './i18n';

export type LearningTopic = 'international-politics' | 'economy-finance';
export type VocabularyEntry = {
  word: string;
  ipa: string;
  definition: string;
  meanings: Partial<Record<Locale, string>>;
  level: 'B2' | 'C1';
};
export type VocabularyRequest = {
  text: string;
  topic?: LearningTopic;
  mode: 'preview' | 'writing';
  limit?: number;
};

export interface VocabularyProvider {
  id: string;
  getVocabulary(request: VocabularyRequest): Promise<VocabularyEntry[]>;
}

export interface GrammarProvider {
  id: string;
  available: boolean;
  explain(
    sentence: string,
    locale: Locale,
  ): Promise<{
    summary: string;
    structure: string[];
    usage: string[];
  }>;
}

export interface ContentProvider<TCatalogItem, TMaterial> {
  id: string;
  list(topic: string): Promise<TCatalogItem[]>;
  load(item: TCatalogItem): Promise<TMaterial>;
}

export interface TranslationProvider {
  id: string;
  translate(text: string, from: string, to: Locale): Promise<string>;
}

export interface StorageProvider<TItem> {
  id: string;
  list(kind?: string): Promise<TItem[]>;
  read(id: string): Promise<TItem>;
  write(item: TItem): Promise<TItem>;
  export(): Promise<Blob | string>;
}

export interface LearningModule {
  id: string;
  name: Partial<Record<Locale, string>>;
  subjects: { id: string; name: Partial<Record<Locale, string>> }[];
  topics: { id: string; name: Partial<Record<Locale, string>> }[];
}

const entries: VocabularyEntry[] = [
  [
    'agreement',
    '/əˈɡriːmənt/',
    'an arrangement accepted by two or more sides',
    '协议',
    '協議',
    '合意・協定',
    'B2',
  ],
  [
    'regulation',
    '/ˌreɡjəˈleɪʃən/',
    'an official rule that controls an activity',
    '法规',
    '法規',
    '規制',
    'B2',
  ],
  [
    'policy',
    '/ˈpɒləsi/',
    'a plan or set of principles used by an organisation or government',
    '政策',
    '政策',
    '政策',
    'B2',
  ],
  [
    'diplomacy',
    '/dɪˈpləʊməsi/',
    'the management of relations between countries',
    '外交',
    '外交',
    '外交',
    'C1',
  ],
  [
    'delegate',
    '/ˈdelɪɡət/',
    'a person chosen to represent a group',
    '代表',
    '代表',
    '代表者',
    'B2',
  ],
  [
    'cooperation',
    '/kəʊˌɒpəˈreɪʃən/',
    'the act of working together toward the same result',
    '合作',
    '合作',
    '協力',
    'B2',
  ],
  [
    'sanction',
    '/ˈsæŋkʃən/',
    'a penalty used to influence a country or organisation',
    '制裁',
    '制裁',
    '制裁',
    'C1',
  ],
  [
    'sovereignty',
    '/ˈsɒvrənti/',
    'the authority of a state to govern itself',
    '主权',
    '主權',
    '主権',
    'C1',
  ],
  [
    'negotiation',
    '/nɪˌɡəʊʃiˈeɪʃən/',
    'formal discussion intended to reach an agreement',
    '谈判',
    '談判',
    '交渉',
    'B2',
  ],
  [
    'humanitarian',
    '/hjuːˌmænɪˈteəriən/',
    'concerned with reducing human suffering',
    '人道主义的',
    '人道主義的',
    '人道的な',
    'C1',
  ],
  [
    'strategic',
    '/strəˈtiːdʒɪk/',
    'planned to achieve an important long-term result',
    '战略性的',
    '戰略性的',
    '戦略的な',
    'B2',
  ],
  [
    'transparent',
    '/trænsˈpærənt/',
    'open and easy for others to understand or examine',
    '透明的',
    '透明的',
    '透明性のある',
    'B2',
  ],
  [
    'economy',
    '/ɪˈkɒnəmi/',
    'the system by which goods and services are produced and used',
    '经济',
    '經濟',
    '経済',
    'B2',
  ],
  [
    'inflation',
    '/ɪnˈfleɪʃən/',
    'a continuing rise in the general level of prices',
    '通货膨胀',
    '通貨膨脹',
    'インフレーション',
    'B2',
  ],
  [
    'investment',
    '/ɪnˈvestmənt/',
    'money or effort used with the aim of producing future benefit',
    '投资',
    '投資',
    '投資',
    'B2',
  ],
  [
    'revenue',
    '/ˈrevənjuː/',
    'income received by a business or government',
    '收入',
    '收入',
    '収益',
    'B2',
  ],
  [
    'deficit',
    '/ˈdefɪsɪt/',
    'the amount by which spending is greater than income',
    '赤字',
    '赤字',
    '赤字',
    'C1',
  ],
  [
    'tariff',
    '/ˈtærɪf/',
    'a tax placed on goods entering or leaving a country',
    '关税',
    '關稅',
    '関税',
    'C1',
  ],
  [
    'subsidy',
    '/ˈsʌbsɪdi/',
    'money given to support an activity or reduce its cost',
    '补贴',
    '補貼',
    '補助金',
    'C1',
  ],
  [
    'currency',
    '/ˈkʌrənsi/',
    'the money used by a particular country',
    '货币',
    '貨幣',
    '通貨',
    'B2',
  ],
  [
    'consumer',
    '/kənˈsjuːmə/',
    'a person who buys or uses goods and services',
    '消费者',
    '消費者',
    '消費者',
    'B2',
  ],
  [
    'productivity',
    '/ˌprɒdʌkˈtɪvəti/',
    'the rate at which goods or services are produced',
    '生产率',
    '生產率',
    '生産性',
    'C1',
  ],
  [
    'regulatory',
    '/ˈreɡjələtəri/',
    'connected with official rules that control an activity',
    '监管的',
    '監管的',
    '規制上の',
    'C1',
  ],
  [
    'uncertainty',
    '/ʌnˈsɜːtnti/',
    'a state in which the result is not known',
    '不确定性',
    '不確定性',
    '不確実性',
    'B2',
  ],
  [
    'worthwhile',
    '/ˌwɜːθˈwaɪl/',
    'valuable enough to justify the time or effort spent',
    '值得的',
    '值得的',
    '価値のある',
    'B2',
  ],
].map(([word, ipa, definition, zhCN, zhTW, ja, level]) => ({
  word,
  ipa,
  definition,
  meanings: { 'zh-CN': zhCN, 'zh-TW': zhTW, ja, en: definition },
  level: level as 'B2' | 'C1',
}));

const byWord = new Map(entries.map((entry) => [entry.word, entry]));
const topicWords: Record<LearningTopic, string[]> = {
  'international-politics': [
    'diplomacy',
    'negotiation',
    'cooperation',
    'sovereignty',
    'humanitarian',
    'sanction',
  ],
  'economy-finance': [
    'inflation',
    'investment',
    'productivity',
    'regulation',
    'consumer',
    'deficit',
  ],
};

export const builtInVocabularyProvider: VocabularyProvider = {
  id: 'built-in-v1',
  async getVocabulary({ text, topic, mode, limit = 12 }) {
    const normalised = text.toLowerCase(),
      matched = entries.filter((entry) =>
        new RegExp(`\\b${entry.word}(?:s|es)?\\b`, 'i').test(normalised),
      ),
      suggested =
        mode === 'writing' && topic
          ? topicWords[topic].map((word) => byWord.get(word)!)
          : [],
      combined = [...matched, ...suggested];
    return Array.from(
      new Map(combined.map((entry) => [entry.word, entry])).values(),
    )
      .sort((a, b) => (a.level === b.level ? 0 : a.level === 'C1' ? -1 : 1))
      .slice(0, limit);
  },
};

export const disabledGrammarProvider: GrammarProvider = {
  id: 'disabled',
  available: false,
  async explain() {
    throw Error('尚未配置语法解释服务');
  },
};
