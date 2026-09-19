import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['km', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'km';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('NEXT_LOCALE')?.value as Locale) || defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
