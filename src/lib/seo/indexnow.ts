/* IndexNow submission.

   IndexNow is an open ping protocol: you tell participating search engines
   that a set of URLs changed, and they crawl. Bing, Yandex, Seznam and Naver
   support it. **Google does not** — which is the first thing to understand
   about this file, because it is the reason it is short, cheap, and
   deliberately not the main event.

   It is worth building anyway for three reasons. It is one HTTP call. It is
   supported by every engine except the one that matters most, which still
   makes it the majority of non-Google search traffic. And it is harmless: a
   failed ping costs a request, not a ranking.

   What it is not is a substitute for the sitemap and internal links. A ping
   gets a crawl; it does not make a page worth indexing. That is what the gate
   is for, and why the gate was built first.

   Fails closed and never throws. A search-engine ping is the definition of
   best-effort: if it fails, the URL is still in the sitemap and still linked
   from its hub, and it will be found. */
import type { RuntimeEnvironment } from "./runtime";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** IndexNow caps a single submission at 10,000 URLs. */
export const INDEXNOW_MAX_URLS = 10_000;

export type IndexNowConfig = {
  /** The API key, which must also be served at `https://{host}/{key}.txt`. */
  key: string;
  host: string;
};

export type IndexNowResult =
  | { submitted: false; reason: "not-configured" | "empty" | "network-error" }
  | { submitted: true; status: number; urlCount: number };

export function indexNowConfig(env: RuntimeEnvironment = process.env): IndexNowConfig | null {
  const key = env.INDEXNOW_KEY;
  const host = env.INDEXNOW_HOST ?? env.NEXT_PUBLIC_SITE_HOST;
  if (!key || !host) return null;
  return { key, host };
}

/** Where the key file must be served. IndexNow verifies it owns the host by
    fetching this, so getting it wrong is a silent no-op at the engine end. */
export function indexNowKeyLocation(config: IndexNowConfig): string {
  return `https://${config.host}/${config.key}.txt`;
}

function absoluteUrls(urls: readonly string[], host: string): string[] {
  return [...new Set(urls)].map((url) => (url.startsWith("http") ? url : `https://${host}${url}`));
}

export async function submitToIndexNow(
  urls: readonly string[],
  env: RuntimeEnvironment = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const config = indexNowConfig(env);
  if (!config) return { submitted: false, reason: "not-configured" };

  const urlList = absoluteUrls(urls, config.host).slice(0, INDEXNOW_MAX_URLS);
  if (urlList.length === 0) return { submitted: false, reason: "empty" };

  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: config.host,
        key: config.key,
        keyLocation: indexNowKeyLocation(config),
        urlList,
      }),
    });
    return { submitted: true, status: response.status, urlCount: urlList.length };
  } catch {
    /* B-11: "network-error" instead of "not-configured". Conflating the two
       made an operator diagnose a DNS/auth problem as a missing env var —
       the fix for the first is credentials, for the second it's ops. */
    return { submitted: false, reason: "network-error" };
  }
}
