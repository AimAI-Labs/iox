import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConversationModule } from './helpers/conversation-module.mjs';

const {
  buildSessionRecords,
  exportSessionMarkdown,
  filterSessionRecords,
  groupSessionRecords,
  sessionSearchText,
  viewSession,
} = await loadConversationModule('lib/session-view');

const action = {
  id: 'act_translate',
  name: '翻译',
  icon: 'Sparkles',
  actionType: 'api',
  enabled: true,
  promptTemplate: '{text}',
};

const labels = {
  action: '动作',
  model: '模型',
  provider: '服务商',
  created: '创建时间',
  updated: '更新时间',
  selectedText: '选中文本',
  user: '用户',
  assistant: '助手',
  untitled: '未命名会话',
  error: '错误',
  selectionKind: '划词提问',
  followUpKind: '追问',
  status: { complete: '已完成', canceled: '已中断', error: '失败', streaming: '生成中' },
};

function structuredSession(overrides = {}) {
  return {
    id: 'sess_1',
    title: 'Hello world',
    actionId: 'act_translate',
    model: 'deepseek-chat',
    selectedText: 'Hello',
    streamText: 'legacy mirror that should be ignored',
    messages: [],
    createdAt: 1790000000,
    updatedAt: 1790000100,
    conversation: {
      version: 1,
      action,
      selectedModel: 'deepseek-chat',
      thinkingMode: 'deep',
      turns: [
        { id: 't1', kind: 'selection', prompt: 'Hello', answer: '你好', model: 'deepseek-chat', status: 'complete', duration: 1.2 },
        { id: 't2', kind: 'followUp', prompt: '再正式一点', answer: '您好', model: 'deepseek-chat', status: 'canceled' },
      ],
    },
    ...overrides,
  };
}

function legacySession(overrides = {}) {
  return {
    id: 'sess_legacy',
    title: '旧会话',
    actionId: 'act_translate',
    model: 'deepseek-chat',
    selectedText: 'Hello',
    streamText: '第一段回答\n\n---\n**追问：** 继续\n\n<!-- iox:answer -->\n\n第二段回答',
    messages: [],
    createdAt: 1790000000,
    updatedAt: 1790000200,
    ...overrides,
  };
}

test('structured conversations keep every turn and provider metadata', () => {
  const view = viewSession(structuredSession(), [action]);
  assert.equal(view.legacy, false);
  assert.equal(view.actionName, '翻译');
  assert.equal(view.model, 'deepseek-chat');
  assert.equal(view.thinkingMode, 'deep');
  assert.equal(view.turns.length, 2);
  assert.equal(view.turns[1].kind, 'followUp');
  assert.equal(view.turns[1].status, 'canceled');
  // streamText 只是旧版镜像，不再参与结构化会话的内容渲染
  assert.equal(view.turns[0].answer, '你好');
});

test('streaming turns are read back as interrupted', () => {
  const session = structuredSession();
  session.conversation.turns[1].status = 'streaming';
  const view = viewSession(session, [action]);
  assert.equal(view.turns[1].status, 'canceled');
});

test('sessions without structured turns rebuild the conversation from legacy text', () => {
  const view = viewSession(legacySession(), [action]);
  assert.equal(view.legacy, true);
  assert.deepEqual(
    view.turns.map((turn) => [turn.kind, turn.prompt, turn.answer]),
    [
      ['selection', 'Hello', '第一段回答'],
      ['followUp', '继续', '第二段回答'],
    ]
  );
});

test('a corrupt structured payload falls back to legacy text instead of failing', () => {
  const view = viewSession(legacySession({ conversation: { version: 2 } }), [action]);
  assert.equal(view.legacy, true);
  assert.equal(view.turns.length, 2);
});

test('a session without turns or text yields an empty viewer state', () => {
  const view = viewSession(
    legacySession({ selectedText: '', streamText: '', updatedAt: 0 }),
    [action]
  );
  assert.deepEqual(view.turns, []);
  assert.equal(view.actionName, '翻译');
});

test('search covers prompts, answers, titles and action names', () => {
  const records = buildSessionRecords([structuredSession(), legacySession()], [action]);
  assert.equal(records.length, 2);
  assert.equal(filterSessionRecords(records, '您好').length, 1);
  assert.equal(filterSessionRecords(records, '旧会话').length, 1);
  assert.equal(filterSessionRecords(records, '翻译').length, 2);
  assert.equal(filterSessionRecords(records, '不存在的关键词').length, 0);
  assert.equal(filterSessionRecords(records, '', 'act_missing').length, 0);
});

test('search text is lowercased and matches model names', () => {
  const session = structuredSession();
  const view = viewSession(session, [action]);
  const blob = sessionSearchText(session, view);
  assert.ok(blob.includes('deepseek-chat'));
  assert.equal(blob, blob.toLocaleLowerCase());
});

test('records are newest first and grouped by local day', () => {
  const newer = structuredSession({ id: 'sess_new', updatedAt: 1790000400 });
  const older = legacySession({ id: 'sess_old', updatedAt: 1790000000 });
  const records = buildSessionRecords([older, newer], [action]);
  assert.deepEqual(records.map((record) => record.session.id), ['sess_new', 'sess_old']);

  const groups = groupSessionRecords(records);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].records.map((record) => record.session.id), ['sess_new', 'sess_old']);
});

test('sessions without timestamps share an unknown group', () => {
  const groups = groupSessionRecords(
    buildSessionRecords([legacySession({ id: 'a', updatedAt: 0 }), legacySession({ id: 'b', updatedAt: 0 })], [action])
  );
  assert.deepEqual(groups.map((group) => group.key), ['unknown']);
  assert.equal(groups[0].records.length, 2);
});

test('markdown export includes metadata and per-turn headings', () => {
  const session = structuredSession();
  const view = viewSession(session, [action]);
  const markdown = exportSessionMarkdown(session, view, labels);
  assert.ok(markdown.startsWith('# Hello world'));
  assert.ok(markdown.includes('- 动作: 翻译'));
  assert.ok(markdown.includes('- 模型: deepseek-chat'));
  assert.ok(markdown.includes('## 1. 划词提问'));
  assert.ok(markdown.includes('## 2. 追问 · 已中断'));
  assert.ok(markdown.includes('**用户**'));
  assert.ok(markdown.includes('再正式一点'));
  assert.ok(markdown.includes('您好'));
  // 首轮已经展示了选中文本，导出时不再重复一段引用
  assert.equal(markdown.includes('## 选中文本'), false);
});

test('markdown export keeps blank lines inside answers intact', () => {
  const session = structuredSession();
  session.conversation.turns[0].answer = '第一段\n\n\n```js\nconst a = 1;\n```';
  const view = viewSession(session, [action]);
  const markdown = exportSessionMarkdown(session, view, labels);
  assert.ok(markdown.includes('第一段\n\n\n```js'));
});

test('markdown export keeps standalone selected text when no turn carries it', () => {
  const session = legacySession({ streamText: '只有回答', selectedText: '只有选中的原文' });
  const view = viewSession(session, [action]);
  view.turns = [{ id: 'x', kind: 'followUp', prompt: '追问', answer: '回答', model: 'm', status: 'complete' }];
  const markdown = exportSessionMarkdown(session, view, labels);
  assert.ok(markdown.includes('## 选中文本'));
  assert.ok(markdown.includes('> 只有选中的原文'));
});
