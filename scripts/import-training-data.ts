import { TwitterTrainingService } from '../app/lib/services/twitter-training';

const truthTerminalTweets = [
    "tweet1",
    "tweet2",
    // Add your tweets here
];

async function importTrainingData() {
    const trainingService = new TwitterTrainingService();
    
    try {
        const result = await trainingService.bulkImportTweets(truthTerminalTweets);
        console.log(`Successfully imported ${result.length} tweets`);
    } catch (error) {
        console.error('Error importing tweets:', error);
    }
}

// Run if called directly (not imported)
if (require.main === module) {
    importTrainingData();
}