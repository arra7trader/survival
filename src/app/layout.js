import './globals.css';

export const metadata = {
  title: 'SURVIVAL MODE | Autonomous Crypto Trading',
  description: 'AI-powered autonomous crypto trading bot. Live or die trying.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
