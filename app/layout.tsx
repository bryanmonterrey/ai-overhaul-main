import React from "react";
import { ClientProviders } from './providers/ClientProviders';
import ClientLayout from './ClientLayout';
import "./globals.css";
import { metadata } from './metadata';
import { Toaster } from "@/components/ui/toaster"
import { ViewTransitions } from 'next-view-transitions'

export { metadata };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransitions>
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="antialiased bg-[#11111A] text-white relative">
        <ClientProviders>
          <ClientLayout>
            {children}
            <Toaster />
          </ClientLayout>
        </ClientProviders>
      </body>
    </html>
    </ViewTransitions>
  );
}