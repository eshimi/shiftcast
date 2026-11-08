import test from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, annotate, interpolate } from '../src/pressure.js';
import { norm } from '../src/drugs.js';

test('levelOf: 仕様の4段階', () => {
  assert.equal(levelOf(1.0), 'rise');
  assert.equal(levelOf(0.9), 'none');
  assert.equal(levelOf(-0.4), 'none');
  assert.equal(levelOf(-0.5), 'slight');
  assert.equal(levelOf(-0.99), 'slight');
  assert.equal(levelOf(-1.0), 'caution');
  assert.equal(levelOf(-1.49), 'caution');
  assert.equal(levelOf(-1.5), 'warning');
  assert.equal(levelOf(-3), 'warning');
});
test('annotate: 3時間間隔を1時間あたりに換算', () => {
  const H = 3600e3;
  const a = annotate([{ ts: 0, pressure: 1010 }, { ts: 3 * H, pressure: 1005 }, { ts: 6 * H, pressure: 1004 }, { ts: 20 * H, pressure: 990 }]);
  assert.equal(a[1].rate, -1.67);
  assert.equal(a[1].level, 'warning');
  assert.equal(a[2].level, 'none');
  assert.equal(a[3].rate, null); // 欠測をまたぐ区間は評価しない
});
test('interpolate', () => {
  const H = 3600e3;
  const s = [{ ts: 0, pressure: 1000 }, { ts: 3 * H, pressure: 1006 }];
  assert.equal(interpolate(s, 1.5 * H), 1003);
  assert.equal(interpolate(s, 4 * H), null);
});
test('norm: ひらがな/全角/記号の揺れを吸収', () => {
  assert.equal(norm('ろきそにん Ｓ'), norm('ロキソニンS'));
});
