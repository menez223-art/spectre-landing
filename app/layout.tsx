import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { NavigationProgress } from "@/app/components/NavigationProgress";
import { themeNoFlashScript } from "@/app/theme-script";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "استوديو صفحات الهبوط — أنشئ صفحة هبوط احترافية",
    template: "%s | استوديو صفحات الهبوط",
  },
  description:
    "استوديو صفحات الهبوط: أدخل اسم المنتج والصورة والسعر، والاستوديو يولّد لك صفحة هبوط كاملة احترافية مع نظام الطلب والتوصيل لـ 58 ولاية والدفع عند الاستلام.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body className={`${cairo.variable} ${tajawal.variable} font-body min-h-screen`}>
        <ThemeProvider>
          <LocaleProvider>
            <NavigationProgress />
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
