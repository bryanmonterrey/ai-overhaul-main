import { jest } from '@jest/globals';

type TokenEstimator = (text: string) => Promise<number>;
type TokenCounter = () => Promise<{ total: number }>;

export const TokenCounter = {
  estimateTokenCount: jest.fn<TokenEstimator>().mockResolvedValue(10),
  getTokenCount: jest.fn<TokenCounter>().mockResolvedValue({ total: 20 })
};

export const mockTokenCounter = {
  estimateTokenCount: jest.fn<TokenEstimator>().mockResolvedValue(10),
  getTokenCount: jest.fn<TokenCounter>().mockResolvedValue({ total: 20 })
}; 