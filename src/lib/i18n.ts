/**
 * Minimal i18n layer. MVP ships English only, but every user-facing string
 * goes through `t()` so a real i18n library can be dropped in later.
 */

export const messages = {
  en: {
    "brand.name": "Extendly",
    "nav.explore": "Explore plugins",
    "nav.platforms": "Platforms",
    "nav.categories": "Categories",
    "nav.sell": "Sell on Extendly",
    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",
    "nav.account": "Account",
    "nav.library": "My Library",
    "nav.favorites": "Favorites",
    "nav.wishlist": "Wishlist",
    "nav.collections": "Collections",
    "hero.title": "Extend what your tools can do.",
    "hero.subtitle":
      "Discover, buy and sell plugins, extensions and add-ons for the tools you already use.",
    "search.placeholder": "Search plugins, extensions and add-ons...",
    "section.browseByPlatform": "Browse by platform",
    "section.trending": "Trending plugins",
    "section.popular": "Popular plugins",
    "section.newReleases": "New releases",
    "section.topRated": "Top rated",
    "section.free": "Free plugins",
    "section.openSource": "Open source",
    "section.featuredCategories": "Featured categories",
    "common.viewAll": "View all",
    "common.free": "Free",
    "common.loading": "Loading...",
    "common.empty": "Nothing here yet.",
  },
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)["en"];

let activeLocale: Locale = "en";

export function setLocale(locale: Locale) {
  activeLocale = locale;
}

export function t(key: MessageKey): string {
  return messages[activeLocale][key] ?? messages.en[key] ?? key;
}
