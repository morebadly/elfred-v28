import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelProvider } from '../../server/elfred/providers.mjs';

test('chat-only relay key does not advertise unrelated capabilities', () => {
  const provider = new ModelProvider({
    ELFRED_MODEL_BASE_URL: 'https://relay.example/v1',
    ELFRED_MODEL_API_KEY: 'test-relay-key',
    ELFRED_MODEL_NAME: 'relay-chat'
  });
  assert.equal(provider.status().configured, true);
  assert.equal(provider.status().embedding, 'not_configured');
  assert.equal(provider.status().web_search, 'not_configured');
  assert.equal(provider.status().image_generate, 'not_configured');
  assert.ok(!JSON.stringify(provider.status()).includes('test-relay-key'));
});

test('relay capabilities can be explicitly configured with their own key', () => {
  const provider = new ModelProvider({
    ELFRED_MODEL_BASE_URL: 'https://relay.example/v1',
    ELFRED_MODEL_API_KEY: 'test-relay-key',
    ELFRED_EMBEDDING_API_KEY: 'test-embedding-key',
    ELFRED_EXTERNAL_API_KEY: 'test-external-key'
  });
  assert.equal(provider.status().embedding, 'configured');
  assert.equal(provider.status().web_search, 'configured');
});
