import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from './api-client.js';

test('ApiClient initializes with default configured URL', () => {
  const client = new ApiClient('http://localhost:3000/api/v1');
  assert.equal(client.getBaseUrl(), 'http://localhost:3000/api/v1');
});

test('ApiClient formats health endpoint correctly', () => {
  const client = new ApiClient('http://localhost:3000/api/v1');
  assert.equal(`${client.getBaseUrl()}/health`, 'http://localhost:3000/api/v1/health');
});
