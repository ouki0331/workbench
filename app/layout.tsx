import type { Metadata } from 'next';
import type { Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'IELTS 学習ワークベンチ',
  description: 'IELTSの練習、復習、レベル確認と学習進捗を一つの場所に。',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
