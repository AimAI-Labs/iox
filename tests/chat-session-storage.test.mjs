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
