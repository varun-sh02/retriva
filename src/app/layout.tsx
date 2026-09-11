import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

// Brand type is Helvetica Neue (a system font, not a webfont — see
// public/brand's README), set directly as --font-sans in globals.css.
// IBM Plex Mono is the one loaded webfont, for ids/page numbers/scores/stages.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Retriva",
  description: "Upload your knowledge. Ask anything. See the evidence.",
  icons: {
    icon: [
      { url: "/brand/favicon-light.svg", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-dark.svg", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/brand/app-icon-saffron-2x.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", plexMono.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider delay={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
