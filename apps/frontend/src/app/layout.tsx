import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pharma Signal Dashboard',
  description: 'Enterprise data ingestion, schema profiling, and monitoring platform.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="dashboard-layout">
          <Sidebar />
          <div className="main-content">
            <Header />
            <main className="content-container">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
