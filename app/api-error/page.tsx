'use client';

import React from 'react';
import Link from 'next/link';

const ApiErrorPage = () => {
  return (
    <div className="min-h-screen bg-[#11111A] text-[#DDDDDD] p-2">
      <div className="max-w-3xl mx-auto py-8">
        <h1 className="text-2xl mb-4 font-ia">API Error</h1>
        <p className="mb-4 font-ia">
          There was an error processing your request. This could be due to:
        </p>
        <ul className="list-disc pl-5 mb-6 font-ia">
          <li>Rate limiting</li>
          <li>Invalid API credentials</li>
          <li>Server issues</li>
          <li>Network connectivity problems</li>
        </ul>
        <Link 
          href="/"
          className="text-[#DDDDDD] hover:text-white font-ia underline"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default ApiErrorPage;