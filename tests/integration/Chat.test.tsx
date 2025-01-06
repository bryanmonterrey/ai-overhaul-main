// src/tests/integration/Chat.test.tsx

import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Chat from '@/app/components/personality/Chat';
import { AIError, AIRateLimitError } from '@/app/core/errors/AIError';

// Create properly typed mock functions
const mockEstimateTokenCount = jest.fn<(text: string) => Promise<number>>()
  .mockResolvedValue(10);
const mockGetTokenCount = jest.fn<() => Promise<{ total: number }>>()
  .mockResolvedValue({ total: 20 });

// Mock TokenCounter with proper types
jest.mock('@/lib/utils/ai', () => ({
  TokenCounter: {
    estimateTokenCount: mockEstimateTokenCount,
    getTokenCount: mockGetTokenCount
  }
}));

describe('Chat Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends message and displays response', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      response: 'Test response',
      emotionalState: 'neutral',
      aiResponse: {
        model: 'claude-3',
        tokenCount: { total: 20 },
        cached: false
      }
    };

    // Setup fetch mock for this test with proper typing
    const mockFetch = jest.fn<() => Promise<Response>>()
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);
    global.fetch = mockFetch as unknown as typeof fetch;

    render(<Chat />);

    // Type and send message
    await act(async () => {
      const input = screen.getByPlaceholderText('ENTER_COMMAND...');
      await user.type(input, 'Hello!');
      await user.click(screen.getByText('EXECUTE'));
    });

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('Test response')).toBeInTheDocument();
      expect(screen.getByText(/STATE: neutral/)).toBeInTheDocument();
      expect(screen.getByText('Model: claude-3')).toBeInTheDocument();
      expect(screen.getByText('Tokens: 20')).toBeInTheDocument();
    });
  });

  it('handles rate limit errors correctly', async () => {
    const user = userEvent.setup();
    const mockError = new AIRateLimitError('Rate limit exceeded', 30);

    const mockFetch = jest.fn<typeof fetch>().mockRejectedValue(mockError);
    global.fetch = mockFetch;

    render(<Chat />);

    await act(async () => {
      const input = screen.getByPlaceholderText('ENTER_COMMAND...');
      await user.type(input, 'Hello!');
      await user.click(screen.getByText('EXECUTE'));
    });

    await waitFor(() => {
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    });
  });

  it('updates token count correctly', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      response: 'Test response',
      emotionalState: 'neutral',
      personalityState: {},
      aiResponse: {
        model: 'claude-3',
        tokenCount: { total: 20 },
        cached: false
      }
    };

    const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);
    global.fetch = mockFetch;

    render(<Chat />);

    await act(async () => {
      const input = screen.getByPlaceholderText('ENTER_COMMAND...');
      await user.type(input, 'Hello!');
      await user.click(screen.getByText('EXECUTE'));

      // Wait for token count to update
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      const tokenCount = screen.getByText(/TOKEN_COUNT:/);
      expect(tokenCount).toHaveTextContent('TOKEN_COUNT: 2');
    });
  });
});