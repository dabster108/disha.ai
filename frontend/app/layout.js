import { Geist, Geist_Mono } from "next/font/google";
import { ProfileProvider } from "@/context/ProfileContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "DISHA AI — Your Direction. Your Future.",
  description:
    "Nepal's AI-powered career guidance platform for students and fresh graduates.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} light h-full scroll-smooth antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-on-surface">
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}
