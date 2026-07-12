import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Community Forum",
    default: "Community Forum",
  },
  description:
    "A course discussion forum — ask questions, share knowledge, and save posts for later.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Navbar />
            <main id="main-content" className="main-content">
              {children}
            </main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
