# Google Search Central Notes for Architech SEO Review

**Reviewed:** 27 Aug 2026

## Primary guidance

1. Google Search Central’s SEO Starter Guide says SEO helps search engines crawl, index, and understand content; Google primarily discovers pages through links and sitemaps are useful but not a substitute for discoverability. It recommends descriptive URLs, logical topical directories, unique/useful/up-to-date people-first content, relevant links with clear anchor text, and reducing duplicate URLs with redirects or canonicals when appropriate.

Source: https://developers.google.com/search/docs/fundamentals/seo-starter-guide

2. Google’s spam policies define doorway abuse as pages created for similar queries that funnel users to a less useful destination. They also prohibit scaled content abuse, hidden text/link abuse, keyword stuffing, link spam, cloaking, and machine-generated query traffic. Dynamic accordions, tabs, slideshows, tooltips, and screen-reader-only text are not automatically spam when they improve user experience and are not used to hide ranking content.

Source: https://developers.google.com/search/docs/essentials/spam-policies

3. Google’s structured-data guidance says JSON-LD is recommended for maintainability; markup must describe visible page content and should contain fewer complete and accurate properties rather than many incomplete or inaccurate ones. Structured data can make pages eligible for rich results but does not guarantee a rich result. Rich Results Test and Search Console reports should be used for validation and monitoring.

Source: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data

4. Google’s Core Web Vitals guidance recommends, at the 75th percentile, LCP <= 2.5 seconds, INP < 200 milliseconds, and CLS < 0.1. Field data in Search Console and web-vitals tooling should be used to monitor real users; lab scores alone are insufficient.

Source: https://developers.google.com/search/docs/appearance/core-web-vitals

## Application decisions for Architech

- Keep Ahmedabad-first locality, listing, guide, project, and tool pages only when each has distinct useful content, active data, and a crawlable internal-link path.
- Keep clean canonical URLs and a deliberate noindex/follow policy for arbitrary filter combinations; do not canonicalize legitimate locality or BHK pages to a broad city page.
- Use visible, evidence-backed facts in listing JSON-LD; never add AggregateRating, Review, sold prices, distances, or RERA claims without verified source data.
- Treat original locality data, price-trend methodology, correction history, and source trails as authority assets; do not use purchased links, PBNs, bulk guest-post anchors, or automated Google query scraping.
- Validate changes through rendered HTML, structured-data tests, Search Console after launch, and field Core Web Vitals.
