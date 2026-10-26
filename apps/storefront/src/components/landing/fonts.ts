import { Inter_Tight, TASA_Orbiter } from 'next/font/google';

/** Marketing-site type: a display face for headings and a tight grotesque for text. */
export const displayFont = TASA_Orbiter({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-display',
  display: 'swap',
});

export const bodyFont = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});
