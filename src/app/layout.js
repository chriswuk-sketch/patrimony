import { Playfair_Display, DM_Sans } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  display: 'swap',
})

export const metadata = {
  title: 'Patrimony — Personal Wealth Dashboard',
  description: 'Track your net worth, investments, pension and budget in one place.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="bg-bg-dark text-text-primary font-dm antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
