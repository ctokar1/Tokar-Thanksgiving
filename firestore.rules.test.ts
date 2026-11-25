import assert from 'node:assert/strict';

/**
 * Deterministic verification harness mirroring the exact validation logic
 * in `firestore.rules` and `firebase-blueprint.json` against the Dirty Dozen
 * adversarial payloads documented in `security_spec.md`.
 */

const VALID_ID_RE = /^[a-zA-Z0-9_\-]+$/;
const SERVER_TIME_TOKEN = Symbol('request.time');

interface MockAuth {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
  };
}

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= 128 && VALID_ID_RE.test(id);
}

function isValidGratitudeNote(data: Record<string, unknown>, requestTime: unknown): boolean {
  const keys = Object.keys(data);
  const required = ['name', 'message', 'createdAt'];
  if (!required.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => required.includes(k))) return false;

  return (
    typeof data.name === 'string' &&
    data.name.length >= 1 &&
    data.name.length <= 48 &&
    typeof data.message === 'string' &&
    data.message.length >= 1 &&
    data.message.length <= 240 &&
    data.createdAt === requestTime
  );
}

function isAdmin(auth: MockAuth | null): boolean {
  return (
    auth !== null &&
    auth.token.email === 'c_tokar@chuh.org' &&
    auth.token.email_verified === true
  );
}

export function runDirtyDozenChecks(): void {
  // 1. Shadow field injection
  assert.equal(
    isValidGratitudeNote({ name: 'Joni', message: 'Pie!', createdAt: SERVER_TIME_TOKEN, isAdmin: true }, SERVER_TIME_TOKEN),
    false,
  );
  // 2. Empty name
  assert.equal(
    isValidGratitudeNote({ name: '', message: 'Family', createdAt: SERVER_TIME_TOKEN }, SERVER_TIME_TOKEN),
    false,
  );
  // 3. Name > 48 chars
  assert.equal(
    isValidGratitudeNote({ name: 'A'.repeat(49), message: 'Family', createdAt: SERVER_TIME_TOKEN }, SERVER_TIME_TOKEN),
    false,
  );
  // 4. Empty message
  assert.equal(
    isValidGratitudeNote({ name: 'Jason', message: '', createdAt: SERVER_TIME_TOKEN }, SERVER_TIME_TOKEN),
    false,
  );
  // 5. Message > 240 chars
  assert.equal(
    isValidGratitudeNote({ name: 'Jason', message: 'X'.repeat(241), createdAt: SERVER_TIME_TOKEN }, SERVER_TIME_TOKEN),
    false,
  );
  // 6. Wrong type: name as number
  assert.equal(
    isValidGratitudeNote({ name: 123, message: 'Turkey', createdAt: SERVER_TIME_TOKEN }, SERVER_TIME_TOKEN),
    false,
  );
  // 7. Wrong type: message as array
  assert.equal(
    isValidGratitudeNote({ name: 'Scotty', message: ['Popcorn'], createdAt: SERVER_TIME_TOKEN }, SERVER_TIME_TOKEN),
    false,
  );
  // 8. Missing createdAt
  assert.equal(
    isValidGratitudeNote({ name: 'Kristin', message: 'Popcorn dessert' }, SERVER_TIME_TOKEN),
    false,
  );
  // 9. Spoofed timestamp
  assert.equal(
    isValidGratitudeNote({ name: 'Brandon', message: 'Potatoes', createdAt: '2020-01-01T00:00:00Z' }, SERVER_TIME_TOKEN),
    false,
  );
  // 10. ID poisoning
  assert.equal(isValidId('bad$id'), false);
  assert.equal(isValidId('a'.repeat(129)), false);
  // 11. Valid note succeeds
  assert.equal(
    isValidGratitudeNote({ name: 'Jennie', message: 'Grateful for everyone here!', createdAt: SERVER_TIME_TOKEN }, SERVER_TIME_TOKEN),
    true,
  );
  // 12. Email spoofing without email_verified === true fails
  assert.equal(isAdmin({ uid: 'u1', token: { email: 'c_tokar@chuh.org', email_verified: false } }), false);
  assert.equal(isAdmin({ uid: 'u2', token: { email: 'c_tokar@chuh.org', email_verified: true } }), true);
}
