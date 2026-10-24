import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConversationModule } from './helpers/conversation-module.mjs';

const { encodeLegacyTranscript, decodeLegacyTranscript } = await loadConversationModule('conversation/legacyTranscript');

test('legacy encoding round-trips turns with blank lines and code blocks', () => {
  const turns = [
    { kind: 'selection', prompt: 'selection', answer: 'first answer' },
    { kind: 'followUp', prompt: 'question\n\n```js\nx\n```', answer: 'second\n\nanswer' },
  ];
  const decoded = decodeLegacyTranscript(encodeLegacyTranscript(turns));
  assert.deepEqual(decoded, [
    { prompt: '', answer: 'first answer' },
    { prompt: 'question\n\n```js\nx\n```', answer: 'second\n\nanswer' },
  ]);
});

test('legacy decoding still reads history written before the answer marker existed', () => {
  const decoded = decodeLegacyTranscript('first answer\n\n---\n**追问：** question\n\nanswer');
  assert.deepEqual(decoded, [{ prompt: '', answer: 'first answer' }, { prompt: 'question', answer: 'answer' }]);
});

test('a marker literal inside a prompt remains a documented legacy limitation', () => {
  const turns = [{ kind: 'followUp', prompt: 'x\n\n---\n**追问：** y', answer: 'a' }];
  // 旧格式无法区分标记与正文，一次追问被拆成三块；结构化存储不受影响，这里只锁定现状。
  assert.equal(decodeLegacyTranscript(encodeLegacyTranscript(turns)).length, 3);
});
