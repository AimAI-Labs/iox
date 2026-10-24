import assert from 'node:assert/strict';
import test from 'node:test';
import { deferred, mountSessionView, nodes, textOf } from './helpers/session-components.mjs';
const saved = { id: 'saved', title: 'Saved', actionId: 'action', model: 'model', streamText: 'answer', selectedText: '', createdAt: 1, updatedAt: 1 };
const event = { stopPropagation() {} };

test('failed refresh retains the loaded list and reports a load error', async (t) => {
  let fail = false;
  const h = mountSessionView('hook', async () => { if (fail) throw Error('read'); return [saved]; });
  t.after(h.unmount);
  await h.settle(); fail = true;
  await h.value.refreshSessions(); h.render();
  assert.equal(h.value.sessions[0].id, 'saved');
  assert.equal(h.value.storageError, 'load');
});

test('pending and failed saves do not confirm a session ID and leave the snapshot retryable', async (t) => {
  const saving = deferred(); let attempts = 0;
  const h = mountSessionView('hook', async (command) => command === 'save_chat_session'
    ? (++attempts === 1 ? saving.promise : 'canonical') : []);
  t.after(h.unmount);
  await h.save();
  assert.equal(h.value.currentSessionId, null);
  saving.reject(Error('write')); await h.settle();
  assert.equal(h.value.currentSessionId, null);
  assert.equal(h.value.storageError, 'save');
  h.render({ isLoading: true }); await h.save();
  assert.equal(attempts, 2);
  assert.equal(h.value.currentSessionId, 'canonical');
});

test('successful commit remains confirmed when subsequent list refresh fails', async (t) => {
  let committed = false;
  const h = mountSessionView('hook', async (command) => {
    if (command === 'save_chat_session') { committed = true; return 'canonical'; }
    if (committed) throw Error('refresh');
    return [];
  });
  t.after(h.unmount); await h.save(); await h.settle();
  assert.equal(h.value.currentSessionId, 'canonical');
  assert.equal(h.value.storageError, 'load');
});

test('failed delete and restore keep the current conversation', async (t) => {
  let resets = 0;
  const h = mountSessionView('hook', async (command) => {
    if (command === 'save_chat_session') return 'saved';
    if (command === 'delete_chat_session' || command === 'get_chat_session') throw Error('failure');
    return [saved];
  }, { onResetToNewChat: () => resets++ });
  t.after(h.unmount); await h.save();
  await h.value.handleDeleteSession(event, 'saved'); h.render();
  assert.equal(h.value.currentSessionId, 'saved'); assert.equal(resets, 0);
  assert.equal(h.value.storageError, 'delete');
  await h.value.handleSwitchSession('other'); h.render();
  assert.equal(h.value.currentSessionId, 'saved'); assert.equal(h.value.storageError, 'load');
});

test('settings load failure shows an alert instead of claiming empty history', async (t) => {
  const h = mountSessionView('settings', async () => { throw Error('read'); });
  t.after(h.unmount); await h.settle();
  assert.equal(nodes(h.value, (node) => node.props?.role === 'alert').length, 1);
  assert.ok(!textOf(h.value).includes('sessions.noSessions'));
});

test('settings failed delete and clear preserve loaded rows and report errors', async (t) => {
  const h = mountSessionView('settings', async (command) => {
    if (command === 'get_all_full_chat_sessions') return [saved];
    throw Error('write');
  });
  t.after(h.unmount); await h.settle(); await h.settle();
  const deleteButton = nodes(h.value, (node) => node.type === 'button' && node.props.title === 'sessions.deleteSession')[0];
  await deleteButton.props.onClick(event); h.render();
  assert.ok(textOf(h.value).includes('Saved'));
  assert.equal(nodes(h.value, (node) => node.props?.role === 'alert').length, 1);
  const clearButton = nodes(h.value, (node) => node.type === 'button' && textOf(node).includes('sessions.clearAll'))[0];
  await clearButton.props.onClick(); h.render();
  assert.ok(textOf(h.value).includes('Saved'));
  assert.equal(nodes(h.value, (node) => node.props?.role === 'alert').length, 1);
});

test('load failure remains distinguishable from empty history after a save failure', async (t) => {
  const h = mountSessionView('hook', async () => { throw Error('corrupt history'); });
  t.after(h.unmount); await h.settle(); await h.save();
  assert.equal(h.value.storageError, 'save');
  assert.equal(h.value.historyLoaded, false);
});

test('a refresh failure preserves the previous successful history load', async (t) => {
  let fail = false;
  const h = mountSessionView('hook', async () => { if (fail) throw Error('read'); return [saved]; });
  t.after(h.unmount); await h.settle(); fail = true;
  await h.value.refreshSessions(); h.render();
  assert.equal(h.value.historyLoaded, true);
  assert.equal(h.value.sessions[0].id, 'saved');
});


test('history panel only describes empty history after a successful read', (t) => {
  const h = mountSessionView('panel', async () => [], {
    isOpen: true, sessions: [], historyLoaded: false, storageError: 'save',
  });
  t.after(h.unmount);
  assert.equal(nodes(h.value, (node) => node.props?.role === 'alert').length, 1);
  assert.ok(!textOf(h.value).includes('sessions.noSessions'));
  h.render({ historyLoaded: true, storageError: null });
  assert.ok(textOf(h.value).includes('sessions.noSessions'));
});

test('an update that fails retains the previously committed session ID', async (t) => {
  let saves = 0;
  const h = mountSessionView('hook', async (command) => {
    if (command !== 'save_chat_session') return [saved];
    if (++saves === 1) return 'saved';
    throw Error('write');
  });
  t.after(h.unmount); await h.save();
  h.render({ isLoading: true, streamText: 'updated answer' }); await h.save();
  assert.equal(h.value.currentSessionId, 'saved');
  assert.equal(h.value.storageError, 'save');
});


test('save acknowledgement belongs to the original workspace conversation after a tab switch', async (t) => {
  const pending = deferred();
  const h = mountSessionView('hook', async (command) => command === 'save_chat_session' ? pending.promise : []);
  t.after(h.unmount);
  const first = h.workspace.getSnapshot().activeId;
  await h.save(); h.workspace.newTab(); h.render();
  const second = h.workspace.getSnapshot().activeId;
  pending.resolve('canonical-A'); await h.settle();
  assert.equal(h.workspace.getSnapshot().activeId, second);
  assert.equal(h.workspace.getSnapshot().tabs.find((tab) => tab.id === first).sessionId, 'canonical-A');
  assert.equal(h.workspace.getSnapshot().active.sessionId, null);
});

test('only the latest history load restores a conversation, including A to B to A navigation', async (t) => {
  const first = deferred(), second = deferred();
  let loads = 0;
  const h = mountSessionView('hook', async (command) => command === 'get_chat_session' ? (++loads === 1 ? first.promise : second.promise) : []);
  t.after(h.unmount);
  const loadingA = h.value.handleSwitchSession('A');
  const loadingB = h.value.handleSwitchSession('B');
  second.resolve({ ...saved, id: 'B', actionId: 'other', selectedText: 'selection B', model: 'model B' });
  await loadingB; h.render();
  first.resolve({ ...saved, id: 'A' }); await loadingA; h.render();
  assert.equal(h.workspace.getSnapshot().active.sessionId, 'B');
  assert.equal(h.workspace.getSnapshot().active.selectedText, 'selection B');
  assert.equal(h.workspace.getSnapshot().active.action.id, 'other');

  const delayed = deferred();
  const other = mountSessionView('hook', async (command) => command === 'get_chat_session' ? delayed.promise : []);
  t.after(other.unmount);
  const original = other.workspace.getSnapshot().activeId;
  const load = other.value.handleSwitchSession('saved');
  other.workspace.newTab(); other.workspace.select(original);
  delayed.resolve(saved); await load; other.render();
  assert.equal(other.workspace.getSnapshot().activeId, original);
  assert.equal(other.workspace.getSnapshot().active.sessionId, null);
});

test('save transport is serial per conversation and uses canonical identity for the next revision', async (t) => {
  const first = deferred(); let writes = 0;
  const h = mountSessionView('hook', async (command) => command === 'save_chat_session' ? (++writes === 1 ? first.promise : 'canonical') : []);
  t.after(h.unmount); await h.save();
  const plan = h.workspace.followUp('new question', 5);
  h.workspace.append(plan.generationId, 'new answer'); h.workspace.finish(plan.generationId);
  await h.save(); assert.equal(writes, 1);
  first.resolve('canonical'); await h.settle(); await h.save();
  assert.equal(writes, 2);
  const latest = h.calls.filter((call) => call.command === 'save_chat_session').at(-1).args.session;
  assert.equal(latest.id, 'canonical');
  assert.equal(latest.conversation.turns.at(-1).answer, 'new answer');
});

test('closing a tab before save acknowledgement cannot bind the replacement tab', async (t) => {
  const pending = deferred();
  const h = mountSessionView('hook', async (command) => command === 'save_chat_session' ? pending.promise : []);
  t.after(h.unmount); await h.save();
  const old = h.workspace.getSnapshot().activeId;
  h.workspace.close(old); h.render();
  const replacement = h.workspace.getSnapshot().activeId;
  pending.resolve('old-canonical'); await h.settle();
  assert.equal(h.workspace.getSnapshot().activeId, replacement);
  assert.equal(h.workspace.getSnapshot().active.sessionId, null);
  assert.equal(h.value.storageError, null);
});

test('deleting waits for an in-flight update and does not auto-save deleted content again', async (t) => {
  const pending = deferred(); let writes = 0;
  const h = mountSessionView('hook', async (command) => {
    if (command === 'save_chat_session') return ++writes === 1 ? 'saved' : pending.promise;
    return [];
  });
  t.after(h.unmount); await h.save();
  h.workspace.regenerate(5); await h.save();
  const deleting = h.value.handleDeleteSession(event, 'saved'); await h.settle();
  assert.equal(h.calls.filter((call) => call.command === 'delete_chat_session').length, 0);
  pending.resolve('saved'); await deleting; await h.settle(); await h.save();
  assert.equal(h.calls.filter((call) => call.command === 'delete_chat_session').length, 1);
  assert.equal(writes, 2);
  assert.equal(h.workspace.getSnapshot().active.sessionId, null);
});

test('unsupported structured history reports a load failure without replacing the active conversation', async (t) => {
  const h = mountSessionView('hook', async (command) => command === 'get_chat_session' ? { ...saved, conversation: { version: 99 } } : []);
  t.after(h.unmount); const original = h.workspace.getSnapshot();
  await h.value.handleSwitchSession('saved'); h.render();
  assert.equal(h.workspace.getSnapshot().activeId, original.activeId);
  assert.equal(h.workspace.getSnapshot().active.turns[0].answer, original.active.turns[0].answer);
  assert.equal(h.workspace.getSnapshot().active.generation, null);
  assert.equal(h.value.storageError, 'load');
});

test('a history selection revokes the running generation before the read completes', async (t) => {
  const pending = deferred();
  const h = mountSessionView('hook', async (command) => command === 'get_chat_session' ? pending.promise : []);
  t.after(h.unmount);
  const existing = h.workspace.getSnapshot().active;
  const loading = h.value.handleSwitchSession('saved');
  assert.equal(h.workspace.getSnapshot().active.generation, null);
  assert.equal(h.workspace.getSnapshot().active.id, existing.id);
  assert.equal(h.workspace.getSnapshot().active.turns[0].answer, existing.turns[0].answer);
  pending.resolve(saved); await loading;
});
