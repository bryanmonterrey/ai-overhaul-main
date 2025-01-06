'use client';

import { useState, useCallback } from 'react';
import { LettaClient } from './letta-client';
import { 
    ChatMemory, 
    TweetMemory, 
    TradingParamsMemory 
} from '../../types/memory';

export function useMemGPT() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const client = new LettaClient();

    const storeChat = useCallback(async (messages: ChatMemory['data']['messages']) => {
        setLoading(true);
        try {
            return await client.storeMemory<ChatMemory>({
                key: `chat-${Date.now()}`,
                memory_type: 'chat_history',
                data: { messages }
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const storeTweet = useCallback(async (tweet: TweetMemory['data']['generated_tweets'][0]) => {
        setLoading(true);
        try {
            return await client.storeMemory<TweetMemory>({
                key: `tweet-${Date.now()}`,
                memory_type: 'tweet_history',
                data: {
                    generated_tweets: [tweet]
                }
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const storeTrading = useCallback(async (params: TradingParamsMemory['data']) => {
        setLoading(true);
        try {
            return await client.storeMemory<TradingParamsMemory>({
                key: `trading-${Date.now()}`,
                memory_type: 'trading_params',
                data: params
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        storeChat,
        storeTweet,
        storeTrading,
        loading,
        error,
        client,
    };
}