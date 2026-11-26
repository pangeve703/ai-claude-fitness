import { cookies, headers } from "next/headers";
import { isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "./config";
import { dictionaries } from "./dictionaries";

/**
 * Resolves the visitor's locale for Server Components and Route Handlers:
 * the `lang` cookie (set by the language switcher) wins, otherwise the
 * browser's Accept-Language header, otherwise English.
 */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
