// src/tests/setup.ts

import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn(() => 'test-uuid-1234');
Object.defineProperty(global.crypto, 'randomUUID', {
  configurable: true,
  value: mockRandomUUID
});

// Create a proper Response mock
const createResponseMock = (data: any) => ({
  ok: true,
  json: () => Promise.resolve(data),
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  redirected: false,
  type: 'basic' as ResponseType,
  url: 'http://test.com',
  body: null,
  bodyUsed: false,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  blob: () => Promise.resolve(new Blob()),
  formData: () => Promise.resolve(new FormData()),
  text: () => Promise.resolve(''),
  clone: function() { return Promise.resolve(createResponseMock(data)); }
});

// Setup global mocks
beforeEach(() => {
  jest.clearAllMocks();
  mockRandomUUID.mockClear();
  global.fetch = jest.fn(() => Promise.resolve(new Response()));
});

export { jest, createResponseMock };

// Make jest available globally
(global as any).jest = jest;