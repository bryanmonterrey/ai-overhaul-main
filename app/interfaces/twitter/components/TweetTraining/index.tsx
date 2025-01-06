'use client';

import React, { useState } from 'react';
import { Button } from '../../../../components/common/Button';
import { Input } from '../../../../components/common/Input';
import { Card } from '../../../../components/common/Card';
import { Alert } from '../../../../components/common/Alert';

export default function TweetTraining() {
    const [content, setContent] = useState('');
    const [source, setSource] = useState('truth_terminal');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/twitter/training', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, source }),
            });
            
            if (!res.ok) throw new Error('Failed to save tweet');
            
            setContent('');
            setMessage('Tweet saved successfully!');
        } catch (error) {
            setMessage('Error saving tweet');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setFile(e.target.files[0]);
    };

    const uploadCSV = async () => {
        if (!file) return;
        setLoading(true);
        
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/twitter/training', {
                method: 'PUT',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            
            const data = await res.json();
            setMessage(`Successfully imported ${data.inserted} tweets`);
            setFile(null);
        } catch (error) {
            setMessage('Error uploading CSV');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card variant="system" title="ADD_TRAINING_DATA">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Enter tweet text"
                        className="min-h-[100px] w-full p-2 bg-[#11111A] text-[#DDDDDD] border border-zinc-800 resize-none"
                    />
                    <Input
                        value={source}
                        className='bg-[#11111A] text-[#DDDDDD]'
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="Source (e.g., truth_terminal)"
                    />
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Tweet'}
                    </Button>
                </form>
            </Card>

            <Card variant="system" title="UPLOAD_CSV">
                <div className="space-y-4">
                    <Input
                        type="file"
                        accept=".csv"
                        className='space-x-5 bg-[#11111A] border border-zinc-800 text-[#DDDDDD] gap-x-3'
                        onChange={handleFileUpload}
                    />
                    <Button 
                        onClick={uploadCSV} 
                        disabled={!file || loading}
                        className='bg-[#11111A] text-[#DDDDDD]'
                    >
                        {loading ? 'Uploading...' : 'Upload CSV'}
                    </Button>
                    <p className="text-sm text-gray-500">
                        CSV format: content,source,themes (themes separated by semicolons)
                    </p>
                </div>
            </Card>

            {message && (
                <Alert>
                    {message}
                </Alert>
            )}
        </div>
    );
}