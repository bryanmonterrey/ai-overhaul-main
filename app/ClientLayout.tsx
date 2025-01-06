'use client';

import React, { useState, useEffect } from 'react';
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/layout/Footer";
import { Analytics } from "@vercel/analytics/react"
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsSidebarVisible(window.innerWidth >= 800);
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1 pt-16 pb-12">
        
        <main className={`flex-1 p-6 transition-all duration-300 `}>
          {children}
        </main>
      </div>
      <Footer />
      <Analytics />
    </div>
  );
}