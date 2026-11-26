// Run with: node --test 'src/lib/*.test.mjs'
// Node 22.18+ loads schedule.ts directly (type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, formatRange, sortRows } from './schedule.ts';

test('formatTime: morning and afternoon hours', () => {
  assert.equal(formatTime('09:05'), '9:05am');
  assert.equal(formatTime('13:00'), '1:00pm');
  assert.equal(formatTime('23:59'), '11:59pm');
});

test('formatTime: noon is 12pm and midnight is 12am', () => {
  assert.equal(formatTime('12:00'), '12:00pm');
  assert.equal(formatTime('00:00'), '12:00am');
  assert.equal(formatTime('00:30'), '12:30am');
});

test('formatTime: rejects anything that is not 24-hour HH:MM', () => {
  for (const bad of ['1:00', '24:00', '12:60', '1:00pm', '', '11:00 ']) {
    assert.throws(() => formatTime(bad), /Invalid time/, `expected "${bad}" to throw`);
  }
});

test('formatRange: spaced en dash between start and end, matching the live pages', () => {
  assert.equal(formatRange('11:00', '12:15'), '11:00am – 12:15pm');
  assert.equal(formatRange('12:00', '13:30'), '12:00pm – 1:30pm');
  assert.equal(formatRange('00:30', '01:00'), '12:30am – 1:00am');
});

test('sortRows: Monday-first weekday order beats start time', () => {
  const rows = [
    { day: 'Thursday', start: '13:00' },
    { day: 'Tuesday', start: '17:00' },
    { day: 'Monday', start: '19:00' },
  ];
  assert.deepEqual(
    sortRows(rows).map((r) => `${r.day} ${r.start}`),
    ['Monday 19:00', 'Tuesday 17:00', 'Thursday 13:00'],
  );
  assert.equal(rows[0].day, 'Thursday', 'input array is not mutated');
});

test('sortRows: rows on the same day go in start order', () => {
  const rows = [
    { day: 'Tuesday', start: '16:00' },
    { day: 'Tuesday', start: '09:30' },
    { day: 'Tuesday', start: '13:00' },
  ];
  assert.deepEqual(
    sortRows(rows).map((r) => r.start),
    ['09:30', '13:00', '16:00'],
  );
});

test('sortRows: an unknown day name throws instead of sorting silently', () => {
  assert.throws(() => sortRows([{ day: 'Tues', start: '10:00' }, { day: 'Monday', start: '10:00' }]), /Unknown day/);
});
