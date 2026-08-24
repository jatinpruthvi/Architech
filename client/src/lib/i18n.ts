/* Lightweight i18n foundation (Phase-1 Hindi per the architecture).
   ASCII slugs stay stable; only reviewed UI strings are translated.
   Property editorial content remains English until editorially reviewed. */
export type Lang = "en" | "hi";

export const strings = {
  en: {
    nav: { explore: "Explore Ahmedabad", find: "Find a home", notes: "Field notes", saved: "Saved", start: "Start exploring" },
    hero: {
      kicker: "Ahmedabad · 23.03° N, 72.58° E · अमदावाद",
      h1a: "Find the ",
      h1em: "place",
      h1b: "before the address.",
      sub: "A high-trust way to discover Ahmedabad — verified RERA context, locality intelligence, and homes curated with an architect's eye.",
      placeholderBuy: "Try “3 BHK near Law Garden” or a locality…",
      placeholderRent: "Try “2 BHK furnished in Navrangpura”…",
      search: "Search", buy: "Buy", rent: "Rent", beginWith: "Begin with —",
      stats: ["verified homes", "localities mapped", "RERA-checked"],
      scroll: "Scroll — the city opens up",
      demoNote: "Figures are illustrative for this concept preview.",
    },
    sections: {
      localityKicker: "The locality index",
      localityTitle: "A city is more than a pin on a map.",
      curatedKicker: "Curated this week",
      methodKicker: "Our method",
      homesCount: "homes",
    },
    cta: { kicker: "Begin today", title1: "Your address is out there, ", title2: "waiting", start: "Start exploring", browse: "Browse localities" },
    search: {
      title1: "in", cityName: "Ahmedabad.", home: "home", homes: "homes",
      filter: "Combine", clearAll: "Clear all", sort: "Sort",
      sortFresh: "Freshest first", sortAsc: "Price — low to high", sortDesc: "Price — high to low",
      filters: { "2bhk": "2 BHK", "3bhk": "3 BHK +", under15: "Under ₹1.5 Cr", rera: "RERA verified" } as Record<string, string>,
    },
    footer: {
      made: "Made in Amdavad",
      tagline: "Find the place before you choose the address.",
      explore: "Explore", trust: "Trust", office: "Field office",
      links: { buy: "Buy in Ahmedabad", search: "Search homes", notes: "Field notes", verify: "How we verify", rera: "RERA methodology", saved: "Saved homes" },
    },
    common: { skip: "Skip to content", translationNote: "" },
  },
  hi: {
    nav: { explore: "अहमदाबाद देखें", find: "घर खोजें", notes: "फ़ील्ड नोट्स", saved: "सहेजे गए", start: "खोज शुरू करें" },
    hero: {
      kicker: "अहमदाबाद · 23.03° N, 72.58° E · Ahmedabad",
      h1a: "पहले ",
      h1em: "जगह",
      h1b: "फिर पता चुनिए।",
      sub: "अहमदाबाद में घर खोजने का एक भरोसेमंद तरीक़ा — प्रमाणित RERA संदर्भ, इलाक़े की समझ, और वास्तुकार की नज़र से चुने गए घर।",
      placeholderBuy: "जैसे “लॉ गार्डन के पास 3 BHK” या कोई इलाक़ा…",
      placeholderRent: "जैसे “नवरंगपुरा में 2 BHK फ़र्निश्ड”…",
      search: "खोजें", buy: "ख़रीदें", rent: "किराया", beginWith: "यहाँ से शुरू करें —",
      stats: ["सत्यापित घर", "मैप किए इलाक़े", "RERA-जाँचे"],
      scroll: "स्क्रॉल करें — शहर खुलता है",
      demoNote: "आँकड़े इस कॉन्सेप्ट प्रीव्यू के लिए उदाहरणात्मक हैं।",
    },
    sections: {
      localityKicker: "इलाक़ों की सूची",
      localityTitle: "शहर नक़्शे के एक बिंदु से कहीं ज़्यादा है।",
      curatedKicker: "इस हफ़्ते की पसंद",
      methodKicker: "हमारा तरीक़ा",
      homesCount: "घर",
    },
    cta: { kicker: "आज ही शुरू करें", title1: "आपका पता कहीं ", title2: "इंतज़ार", start: "खोज शुरू करें", browse: "इलाक़े देखें" },
    search: {
      title1: "—", cityName: "अहमदाबाद में।", home: "घर", homes: "घर",
      filter: "जोड़ें", clearAll: "सब हटाएँ", sort: "क्रम",
      sortFresh: "सबसे ताज़ा पहले", sortAsc: "क़ीमत — कम से ज़्यादा", sortDesc: "क़ीमत — ज़्यादा से कम",
      filters: { "2bhk": "2 BHK", "3bhk": "3 BHK +", under15: "₹1.5 करोड़ से कम", rera: "RERA सत्यापित" } as Record<string, string>,
    },
    footer: {
      made: "अमदावाद में निर्मित",
      tagline: "पता चुनने से पहले जगह को जानिए।",
      explore: "देखें", trust: "भरोसा", office: "फ़ील्ड कार्यालय",
      links: { buy: "अहमदाबाद में ख़रीदें", search: "घर खोजें", notes: "फ़ील्ड नोट्स", verify: "हम कैसे सत्यापित करते हैं", rera: "RERA पद्धति", saved: "सहेजे गए घर" },
    },
    common: { skip: "सीधे सामग्री पर जाएँ", translationNote: "आंशिक अनुवाद · संपादकीय समीक्षा जारी — शेष सामग्री अभी अंग्रेज़ी में है।" },
  },
} as const;

export type Strings = (typeof strings)["en"];
