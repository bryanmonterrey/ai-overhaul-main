'use client';

import React from 'react';
import TweetTraining from '../../interfaces/twitter/components/TweetTraining';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

export default function TrainingPage() {
    return (
        <ErrorBoundary>
            <div className="p-4">
                <TweetTraining />
            </div>
        </ErrorBoundary>
    );
}