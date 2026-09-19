import type { ResourceRef } from './progress';
import type { Skill } from './progress';
export type Question = {
  prompt: string;
  options?: string[];
  answers: string[];
  explanation: string;
};
export type Material = {
  resourceRef?: ResourceRef;
  id: string;
  title: string;
  skill: Skill;
  label: string;
  source: string;
  body: string;
  questions: Question[];
  audioUrl?: string | null;
  topic?: 'international-politics' | 'economy-finance';
};
export const practiceMaterials: Material[] = [
  {
    id: 'reading-trade-rules-v1',
    title: 'Why international trade rules still matter',
    skill: 'reading',
    topic: 'economy-finance',
    label: '原创模拟练习 · 经济金融 · 非官方真题',
    source: '',
    body: `International trade is often described through large numbers: the value of exports, the size of tariffs or the rate at which an economy grows. Yet businesses also depend on something less visible — predictable rules. A company that sells machinery abroad may spend years building relationships, adapting its products and arranging transport. If import requirements change without warning, even a competitive company can face serious losses.

Trade agreements try to reduce this uncertainty. They may limit tariffs, explain how products will be inspected and create a process for resolving disagreements. Such agreements do not remove every barrier. Governments still use trade policy to protect public health, national security or industries they consider strategically important. The difficult question is how to pursue these aims without making ordinary trade unnecessarily costly.

Smaller businesses can be especially affected by complicated rules. A large multinational company may employ specialists to complete customs documents and monitor regulatory changes. A small producer may have only one employee responsible for international orders. For that producer, a minor difference in labelling requirements can determine whether entering a new market is worthwhile.

Digital trade has introduced additional questions. Services can cross borders without a ship or aircraft, while customer information may be stored in several countries. Governments therefore debate how data should move, where it should be stored and how consumers should be protected. Rules written mainly for physical goods do not always provide clear answers.

Supporters of common standards argue that predictable systems encourage investment and give smaller firms a fairer chance. Critics reply that detailed agreements can restrict a government's freedom to respond to local needs. Both concerns are real. The practical goal is not to eliminate national choices, but to make those choices transparent enough for people and businesses to plan ahead.`,
    questions: [
      {
        prompt: 'Predictable rules help companies mainly by reducing…',
        options: [
          'transport distances',
          'uncertainty',
          'product quality',
          'competition',
        ],
        answers: ['uncertainty'],
        explanation: '第一段说明规则的价值在于避免进口要求突然改变。',
      },
      {
        prompt:
          'A small producer may have only one employee handling international orders.',
        options: ['True', 'False', 'Not Given'],
        answers: ['True'],
        explanation: '第三段直接给出了这一情况，说明复杂规则对小企业的影响。',
      },
      {
        prompt:
          'What kind of trade creates questions about the movement of data? (ONE WORD)',
        answers: ['digital'],
        explanation: '第四段以 Digital trade 引出数据跨境问题。',
      },
    ],
  },
  {
    id: 'listening-cooperation-v1',
    title: 'A briefing on regional cooperation',
    skill: 'listening',
    topic: 'international-politics',
    label: '原创模拟练习 · 国际政治 · 浏览器朗读',
    source: '',
    body: `Welcome to today's briefing on regional cooperation. The programme begins at ten o'clock with a short introduction in Conference Room Two. At ten thirty, delegates will discuss emergency food supplies and the transport routes used to deliver them. The afternoon session was originally planned for one fifteen, but it will now start at one forty-five because the visiting speakers arrive later than expected. That session focuses on agreements between neighbouring countries during natural disasters. Participants should bring their identification card and the blue information booklet sent with their invitation. Printed copies of the final report will be available next Monday, while the digital version will be emailed on Friday evening.`,
    questions: [
      {
        prompt: 'Which room is used for the introduction?',
        answers: ['conference room two', 'room two', '2'],
        explanation: '开头说明 introduction 在 Conference Room Two。',
      },
      {
        prompt: 'What time will the afternoon session now begin?',
        answers: ['1:45', 'one forty-five', 'one forty five', '13:45'],
        explanation:
          '注意 originally planned 后面的转折：now start at one forty-five。',
      },
      {
        prompt: 'When will the digital report be emailed?',
        options: ['Friday evening', 'Monday morning', 'Next Tuesday'],
        answers: ['Friday evening'],
        explanation:
          '末句将 printed copies 和 digital version 的时间进行了对比。',
      },
    ],
  },
  {
    id: 'writing-global-costs-v1',
    title: 'Who should pay for global problems?',
    skill: 'writing',
    topic: 'international-politics',
    label: '原创模拟练习 · 国际政治 · Task 2 风格',
    source: '',
    body: `Some people believe that wealthier countries should pay a larger share of the cost of dealing with global problems. Others argue that every country should contribute equally.

Discuss both views and give your own opinion.

Write at least 250 words. Support your answer with reasons and relevant examples.`,
    questions: [],
  },
  {
    id: 'writing-inflation-v1',
    title: 'Should controlling inflation be the main priority?',
    skill: 'writing',
    topic: 'economy-finance',
    label: '原创模拟练习 · 经济金融 · Task 2 风格',
    source: '',
    body: `Some people believe that controlling inflation should always be a government's main economic priority. Others think that employment and public services can be more important.

Discuss both views and give your own opinion.

Write at least 250 words. Support your answer with reasons and relevant examples.`,
    questions: [],
  },
  {
    id: 'speaking-money-news-v1',
    title: 'Describe a piece of economic news you remember',
    skill: 'speaking',
    topic: 'economy-finance',
    label: '原创模拟练习 · 经济金融 · Part 2 / 3 风格',
    source: '',
    body: `Describe a piece of economic or financial news that you remember.

You should say:
• what the news was about
• where you heard or read it
• why it caught your attention
and explain whether it affected any decision you made.

Prepare for one minute, then speak for one to two minutes.

Follow-up discussion:
1. Why do some people avoid financial news?
2. Should schools teach students how interest and inflation work?
3. How can governments explain economic decisions more clearly?`,
    questions: [],
  },
  {
    id: 'speaking-global-event-v1',
    title: 'Describe an international event you followed',
    skill: 'speaking',
    topic: 'international-politics',
    label: '原创模拟练习 · 国际政治 · Part 2 / 3 风格',
    source: '',
    body: `Describe an international event that you followed in the news.

You should say:
• what happened
• how you learned about it
• why you continued following it
and explain what the event taught you about other countries.

Prepare for one minute, then speak for one to two minutes.

Follow-up discussion:
1. Why do people in different countries report the same event differently?
2. How can people check whether international news is reliable?
3. Should young people learn more about international organisations?`,
    questions: [],
  },
  {
    id: 'reading-gardens-v1',
    title: 'Urban gardens: more than spare land',
    skill: 'reading',
    label: '原创模拟练习 · 阅读短篇 · 非官方真题',
    source: '',
    body: `In many cities, small pieces of unused land are being turned into community gardens. Residents grow vegetables, share tools and meet neighbours they might otherwise never speak to. Supporters often describe these projects as a simple solution to several urban problems. Yet the experience of running a garden shows that success depends on much more than finding an empty plot.

A neighbourhood group in the fictional city of Bellford began its garden on land beside a railway line. Before planting anything, the organisers tested the soil. The results showed that some areas were unsuitable for growing food directly in the ground. Instead of abandoning the project, they built raised beds and filled them with clean soil. This made the garden more expensive to establish, but it also allowed people using wheelchairs to reach some of the growing areas more easily.

Water was another concern. The group initially relied on volunteers carrying water from a nearby building. This arrangement became difficult during a dry summer. A local business later donated tanks that collected rainwater from the building's roof. The tanks reduced the need to carry water, although they did not remove it completely. In long periods without rain, volunteers still needed an additional supply.

The organisers expected food production to be the project's main benefit. After its first year, however, a survey of participants suggested a different priority. Most respondents valued the social contact more than the vegetables they harvested. Some older residents said that a regular gardening session gave structure to their week. New arrivals to the area found that working alongside others was an easy way to start conversations.

Not everyone participated equally. A few experienced gardeners took on much of the routine work, while other members visited only occasionally. The group responded by introducing a shared calendar and dividing large jobs into smaller tasks. Members could choose a task that suited the time they had available. Participation became more regular, but the organisers continued to remind people that the garden depended on collective effort.

The Bellford example is an illustrative account rather than a report of a real research project. It highlights a practical point: urban gardens can create valuable social spaces, but their long-term future requires attention to soil, water, access and the way work is shared. An attractive opening event is only the beginning.`,
    questions: [
      {
        prompt:
          'The organisers planted vegetables directly into all of the original soil.',
        options: ['True', 'False', 'Not Given'],
        answers: ['False'],
        explanation:
          '第二段说明部分土壤不适合种食物，因此使用装有干净土壤的高架种植床。',
      },
      {
        prompt:
          'The rainwater tanks completely removed the need for another water supply.',
        options: ['True', 'False', 'Not Given'],
        answers: ['False'],
        explanation:
          '第三段明确说没有完全消除额外供水需求，长时间不下雨时仍需要其他水源。',
      },
      {
        prompt:
          'Most survey respondents valued social contact more than the vegetables.',
        options: ['True', 'False', 'Not Given'],
        answers: ['True'],
        explanation: '第四段直接说明多数受访者更重视社交联系。',
      },
      {
        prompt: 'The garden produced twice as much food in its second year.',
        options: ['True', 'False', 'Not Given'],
        answers: ['Not Given'],
        explanation: '文章未提供第二年的产量，也没有年份之间的产量对比。',
      },
      {
        prompt:
          'What did the organisers introduce to help distribute the work? (TWO WORDS)',
        answers: ['shared calendar'],
        explanation: '第五段提到 introducing a shared calendar，用于分配工作。',
      },
    ],
  },
  {
    id: 'listening-centre-v1',
    title: 'A welcome talk at the community centre',
    skill: 'listening',
    label: '原创模拟练习 · 合成语音 · 非官方真题',
    source: '',
    audioUrl: '/practice/community-centre.wav',
    body: `Good morning, and welcome to Riverside Community Centre. My name is Emma, and I will explain the activities available to new members this month.

Our photography course starts on Tuesday, the fourteenth of May. Classes begin at six thirty in the evening and finish at eight. Please bring a camera if you have one, although we can lend equipment to beginners. The course lasts for four weeks and costs forty-eight pounds in total. The price includes printed learning materials.

If you prefer outdoor activities, our walking group meets every Saturday at nine fifteen. We usually meet outside the library, but this week the group will leave from the north entrance of the park because the library road is closed. There is no charge for joining the walks. However, you should bring your own water and a waterproof jacket.

Finally, the centre is looking for volunteers to help in the community garden. You do not need gardening experience. The first volunteer session is on Sunday afternoon, and anyone interested should email their name and phone number to the centre before Friday. Thank you, and please ask at reception if you have any questions.`,
    questions: [
      {
        prompt: 'How many weeks does the photography course last?',
        answers: ['4', 'four', '4 weeks', 'four weeks'],
        explanation: '录音说 The course lasts for four weeks。',
      },
      {
        prompt: 'What is the total course fee in pounds?',
        answers: ['48', 'forty-eight', 'forty eight', '48 pounds', '£48'],
        explanation: '课程总费用是 forty-eight pounds，已包含印刷学习资料。',
      },
      {
        prompt: 'Where will the walking group meet this week?',
        options: [
          'Outside the library',
          'At the north entrance of the park',
          'At the community garden',
        ],
        answers: ['At the north entrance of the park'],
        explanation:
          '注意转折 but this week；平时在图书馆外，本周改为公园北门。',
      },
      {
        prompt: 'By which day should volunteers send their details?',
        answers: ['friday'],
        explanation: '录音末尾要求 before Friday 发送姓名和电话号码。',
      },
    ],
  },
  {
    id: 'writing-spaces-v1',
    title: 'Should cities invest more in public spaces?',
    skill: 'writing',
    label: '原创模拟练习 · Task 2 风格 · 非官方真题',
    source: '',
    body: `Some people believe that city governments should spend more money on public parks and libraries. Others think that improving roads and transport should be the priority.

Discuss both views and give your own opinion.

Write at least 250 words. Give reasons for your answer and include relevant examples from your own knowledge or experience.`,
    questions: [],
  },
  {
    id: 'speaking-place-v1',
    title: 'Describe a place where you enjoy learning',
    skill: 'speaking',
    label: '原创模拟练习 · Part 2 / 3 风格 · 非官方真题',
    source: '',
    body: `Describe a place where you enjoy learning something new.

You should say:
• where the place is
• what you learn there
• who you usually go there with
and explain why you enjoy learning in this place.

Prepare for one minute, then aim to speak for one to two minutes.

Follow-up discussion:
1. How does the environment affect people's ability to learn?
2. What can public libraries offer that online resources cannot?
3. Should adults continue learning throughout their lives?`,
    questions: [],
  },
];
export function answerMatches(value: string, accepted: string[]) {
  const normal = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[.!?。]+$/, '')
      .replace(/\s+/g, ' ');
  return accepted.some((a) => normal(a) === normal(value));
}
