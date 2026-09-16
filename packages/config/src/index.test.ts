import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEnv } from './index';

test('loadEnv accepts valid config', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://127.0.0.1:6379',
    JWT_ACCESS_SECRET: 'abcdefghijklmnopqrstuvwxyz012345',
    JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxyz678901',
  });
  assert.equal(env.API_PORT, 4000);
  assert.equal(env.JWT_ACCESS_TTL, '15m');
  assert.equal(env.AI_PROVIDER, 'none');
  assert.equal(env.AI_MAX_COMPLETE_TOKENS, 512);
  assert.equal(env.OPENAI_MODEL, 'gpt-4o-mini');
});

test('loadEnv requires OPENAI_API_KEY when AI_PROVIDER=openai', () => {
  assert.throws(() =>
    loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_ACCESS_SECRET: 'abcdefghijklmnopqrstuvwxyz012345',
      JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxyz678901',
      AI_PROVIDER: 'openai',
    }),
  );
});

test('loadEnv rejects short JWT secrets', () => {
  assert.throws(() =>
    loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
    }),
  );
});
