// src/tests/mocks/twitter-api.mock.ts

import { jest } from '@jest/globals';
import type { TwitterClient, TwitterResponse, TwitterTimelineResponse } from '@/app/core/twitter/types';

export const mockTwitterApi: TwitterClient = {
  tweet: jest.fn<() => Promise<TwitterResponse>>(),
  userTimeline: jest.fn<() => Promise<TwitterTimelineResponse>>(),
  userMentionTimeline: jest.fn<() => Promise<TwitterTimelineResponse>>()
};