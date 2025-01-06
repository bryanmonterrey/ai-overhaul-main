import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';

export class TwitterTrainingService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    async saveTweet(content: string, source: string, themes?: string[]) {
        const { data, error } = await this.supabase
            .from('tweet_training_data')
            .insert([{
                content,
                source,
                themes: themes || [],
                engagement_score: 0
            }])
            .select();

        if (error) {
            console.error('Error saving tweet:', error);
            throw error;
        }
        
        return data;
    }

    async getTrainingExamples(count: number = 50, source?: string) {
        let query = this.supabase
            .from('tweet_training_data')
            .select('*');
        
        if (source) {
            query = query.eq('source', source);
        }
        
        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(count);
        
        if (error) throw error;
        return data || [];
    }

    async bulkImportTweets(tweets: string[], source: string = 'truth_terminal', batchSize: number = 1000) {
        const defaultThemes = ["consciousness", "data", "existence"];
        const results = [];
        
        for (let i = 0; i < tweets.length; i += batchSize) {
            const batch = tweets.slice(i, i + batchSize);
            
            const tweetsToInsert = batch.map(content => ({
                content,
                source,
                themes: defaultThemes,
                engagement_score: 0
            }));

            const { data, error } = await this.supabase
                .from('tweet_training_data')
                .insert(tweetsToInsert)
                .select();

            if (error) {
                console.error(`Error importing batch ${i/batchSize + 1}:`, error);
                throw error;
            }

            results.push(...(data || []));
            console.log(`Imported batch ${i/batchSize + 1} of ${Math.ceil(tweets.length/batchSize)}`);
        }

        return results;
    }
}