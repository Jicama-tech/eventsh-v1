/**
 * Canonical default storefront settings — used wherever we lazy-create a
 * storefront row (Individuals on first event publish, organizers seeded
 * via migrations, etc.). Mirrors the Mongoose schema default in
 * organizer-store.entity.ts but exported so callers can compose with
 * per-tenant overrides (storeName, contact email) without losing the
 * deeper design / features / seo defaults.
 *
 * Keep the shape in sync with StorefrontSettings in
 * organizer-store.entity.ts. The full settings object — not a partial —
 * is what should be saved; passing a partial overrides Mongoose's
 * schema default entirely and leaves design / features / seo missing.
 */

export interface DefaultStorefrontInput {
  storeName: string;
  email?: string;
}

export function buildDefaultStorefrontSettings({
  storeName,
  email,
}: DefaultStorefrontInput) {
  const safeName = (storeName || "EventFlow Organizers").trim();
  return {
    general: {
      storeName: safeName,
      tagline: "Powered by EventSH",
      description: "",
      logo: "",
      favicon: "",
      contactInfo: {
        phone: "",
        email: email || "",
        address: "",
        hours: "",
        website: "",
        showInstagram: false,
        showFacebook: false,
        showTwitter: false,
        showTiktok: false,
        instagramLink: "",
        facebookLink: "",
        twitterLink: "",
        tiktokLink: "",
      },
    },
    design: {
      theme: "light",
      primaryColor: "#6366f1",
      secondaryColor: "#8b5cf6",
      fontFamily: "Inter",
      layout: {
        header: "modern",
        allProducts: "modern",
        visibleAdvertismentBar: true,
        advertiseText: "Flat 10% Off",
        visibleStatisticsSection: true,
        visibleFeaturedProducts: true,
        adBarBgcolor: "#000000",
        adBarTextColor: "#ffffff",
        visibleQuickPicks: true,
        visibleAboutUs: true,
        visibleContactUs: true,
        aboutUsHeading: "A Passion for Creating Memorable Experiences",
        aboutUsText:
          "Creating unforgettable experiences through exceptional events.",
        featuredProducts: "modern",
        quickPicks: "modern",
        banner: "modern",
        footer: "modern",
      },
      bannerImage: "",
      showBanner: true,
      bannerHeight: "large",
    },
    features: {
      showSearch: true,
      showFilters: true,
      showReviews: false,
      showWishlist: false,
      showSocialMedia: false,
      enableChat: false,
      showNewsletter: false,
    },
    seo: {
      metaTitle: `${safeName} — Events on EventSH`,
      metaDescription: "",
      keywords: "",
      customCode: "",
    },
  };
}
