import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = { title: "open-effects" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
