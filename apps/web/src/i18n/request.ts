import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  // In a real app, this would come from the URL (e.g., /en/forum) or
  // user preferences. For this assessment, we use a cookie for simplicity.
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  const supportedLocales = ["en", "es"];
  const resolvedLocale = supportedLocales.includes(locale) ? locale : "en";

  return {
    locale: resolvedLocale,
    messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
  };
});
