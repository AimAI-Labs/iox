import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConversationModule } from './helpers/conversation-module.mjs';

const { createProviderBalanceStore, getBalanceAdapter, BALANCE_REFRESH_MS, formatBalanceAmount } =
  await loadConversationModule('lib/providerBalance');

const provider = { id: 'account-a', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'fixture-key' };
const data = (total = '12.34') => ({
  isAvailable: true,
  balanceInfos: [{ currency: 'CNY', totalBalance: total, grantedBalance: '2.00', toppedUpBalance: '10.34' }],
});
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function clock() {
  let time = 1_000_000;
  let id = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimeout(callback, delay) { timers.set(++id, { callback, at: time + delay }); return id; },
    clearTimeout(timer) { timers.delete(timer); },
    async advance(ms) {
      time += ms;
      for (const [timer, entry] of [...timers]) {
        if (entry.at <= time) { timers.delete(timer); entry.callback(); }
      }
      await settle();
    },
    get size() { return timers.size; },
  };
}

test('balance capability follows the official account origin rather than the model name or provider id', () => {
  for (const baseUrl of ['https://api.deepseek.com', 'https://api.deepseek.com/v1/', ' https://api.deepseek.com/beta ']) {
    assert.equal(getBalanceAdapter({ ...provider, id: 'custom-name', baseUrl }), 'deepseek');
  }
  for (const baseUrl of ['http://api.deepseek.com', 'https://api.deepseek.com.evil.test', 'https://proxy.test/deepseek',
    'https://api.deepseek.com:444', 'https://user@api.deepseek.com', 'invalid']) {
    assert.equal(getBalanceAdapter({ ...provider, id: 'deepseek', baseUrl }), null);
  }
  assert.equal(getBalanceAdapter(), null);
});

test('first subscriber fetches, shared subscribers coalesce and polling waits five minutes', async () => {
  const timer = clock();
  let calls = 0;
  const store = createProviderBalanceStore(async (id) => { assert.equal(id, provider.id); calls++; return data(); }, timer);
  const account = store.account(provider);
  const unsubscribe = account.subscribe(() => {});
  const other = account.subscribe(() => {});
  await settle();
  assert.equal(calls, 1);
  assert.equal(account.getSnapshot().data.balanceInfos[0].totalBalance, '12.34');
  assert.equal(timer.size, 1);
  await timer.advance(BALANCE_REFRESH_MS - 1);
  assert.equal(calls, 1);
  await timer.advance(1);
  assert.equal(calls, 2);
  unsubscribe();
  assert.equal(timer.size, 1);
  other();
  assert.equal(timer.size, 0);
});

test('manual refresh bypasses freshness and simultaneous refreshes use one request', async () => {
  const pending = deferred();
  let calls = 0;
  const store = createProviderBalanceStore(() => { calls++; return calls === 1 ? Promise.resolve(data()) : pending.promise; }, clock());
  const account = store.account(provider);
  await account.refresh();
  const first = account.refresh();
  const second = account.refresh();
  assert.equal(first, second);
  await settle();
  assert.equal(calls, 2);
  assert.equal(account.getSnapshot().data.balanceInfos[0].totalBalance, '12.34');
  pending.resolve(data('9.87'));
  await first;
  assert.equal(account.getSnapshot().data.balanceInfos[0].totalBalance, '9.87');
});

test('reopening uses cached data and schedules the remaining interval, with no polling after disposal', async () => {
  const timer = clock();
  let calls = 0;
  const store = createProviderBalanceStore(async () => { calls++; return data(); }, timer);
  const account = store.account(provider);
  const stop = account.subscribe(() => {});
  await settle();
  stop();
  await timer.advance(60_000);
  assert.equal(store.account({ ...provider }), account);
  const stopAgain = account.subscribe(() => {});
  await settle();
  assert.equal(calls, 1);
  await timer.advance(BALANCE_REFRESH_MS - 60_000);
  assert.equal(calls, 2);
  stopAgain();
  await timer.advance(BALANCE_REFRESH_MS * 2);
  assert.equal(calls, 2);
});

test('credential changes isolate late responses even when provider ids are reused', async () => {
  const old = deferred();
  let calls = 0;
  const store = createProviderBalanceStore(() => ++calls === 1 ? old.promise : Promise.resolve(data('99.00')), clock());
  const first = store.account(provider);
  const pending = first.refresh();
  await settle();
  const changed = store.account({ ...provider, apiKey: 'new-fixture-key' });
  assert.notEqual(changed, first);
  assert.equal(changed.getSnapshot().data, null);
  await changed.refresh();
  old.resolve(data('1.00'));
  await pending;
  assert.equal(changed.getSnapshot().data.balanceInfos[0].totalBalance, '99.00');
});

test('refresh failure keeps last successful balance and timestamp, and retries on the normal interval', async () => {
  const timer = clock();
  let fail = false;
  const store = createProviderBalanceStore(async () => { if (fail) throw 'unauthorized'; return data(); }, timer);
  const account = store.account(provider);
  const stop = account.subscribe(() => {});
  await settle();
  const updatedAt = account.getSnapshot().updatedAt;
  fail = true;
  await timer.advance(BALANCE_REFRESH_MS);
  assert.equal(account.getSnapshot().error, 'unauthorized');
  assert.equal(account.getSnapshot().data.balanceInfos[0].totalBalance, '12.34');
  assert.equal(account.getSnapshot().updatedAt, updatedAt);
  assert.equal(timer.size, 1);
  fail = false;
  await timer.advance(BALANCE_REFRESH_MS);
  assert.equal(account.getSnapshot().error, null);
  stop();
});

test('missing credentials never query the transport and snapshots are stable between updates', async () => {
  const store = createProviderBalanceStore(() => assert.fail('must not request without a key'), clock());
  const account = store.account({ ...provider, apiKey: ' ' });
  await account.refresh();
  assert.equal(account.getSnapshot().error, 'missingKey');
  assert.equal(account.getSnapshot(), account.getSnapshot());
});

test('currencies stay separate and sub-cent balances remain visible', () => {
  assert.match(formatBalanceAmount('12.34', 'CNY', 'zh-CN'), /12\.34/);
  assert.match(formatBalanceAmount('9.87', 'USD', 'en-US'), /\$9\.87/);
  assert.match(formatBalanceAmount('0.0012', 'CNY', 'zh-CN'), /0\.0012/);
});

test('unmount and StrictMode subscription replay reuse an outstanding request and leave no timer behind', async () => {
  const timer = clock();
  const pending = deferred();
  let calls = 0;
  let notifications = 0;
  const store = createProviderBalanceStore(() => { calls++; return pending.promise; }, timer);
  const account = store.account(provider);
  const stop = account.subscribe(() => { notifications++; });
  await settle();
  stop();
  const stopAgain = account.subscribe(() => { notifications++; });
  await settle();
  assert.equal(calls, 1);
  stopAgain();
  const before = notifications;
  pending.resolve(data());
  await settle();
  assert.equal(notifications, before);
  assert.equal(timer.size, 0);
  const stopThird = account.subscribe(() => {});
  await settle();
  assert.equal(calls, 1);
  assert.equal(timer.size, 1);
  stopThird();
});

test('each request carries the expected account configuration for Rust to reject a delayed config snapshot', async () => {
  const store = createProviderBalanceStore(async (id, expected) => {
    assert.equal(id, provider.id);
    assert.equal(expected.apiKey, provider.apiKey);
    assert.equal(expected.baseUrl, provider.baseUrl);
    throw 'configChanged';
  }, clock());
  const account = store.account(provider);
  await account.refresh();
  assert.equal(account.getSnapshot().error, 'configChanged');
  assert.equal(account.getSnapshot().data, null);
});
