import type { ReactNode } from 'react';
import './globals.css';

/** Root layout loads global CSS here so the asset URL is not under [locale]. */
export const metadata = {
  title: 'پی تا کلید',
  description: 'از نیاز پروژه تا تأمین مصالح و خدمات ساختمانی',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
