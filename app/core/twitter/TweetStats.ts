// app/core/twitter/TweetStats.ts

export class TweetStats {
    private stats = {
        approved: 0,
        rejected: 0,
        posted: 0,
        failed: 0
    };

    public increment(type: keyof typeof this.stats) {
        this.stats[type]++;
    }

    public getStats() {
        return { ...this.stats };
    }

    public reset() {
        Object.keys(this.stats).forEach(key => {
            this.stats[key as keyof typeof this.stats] = 0;
        });
    }
}