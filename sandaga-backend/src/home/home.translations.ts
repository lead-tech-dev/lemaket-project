import {
  HomeServiceCard,
  HomeTestimonial,
  HomeTrendingSearch
} from './home.types';

export type HomeLocale = 'fr' | 'en';

type HeroStatStrings = {
  activeListings: {
    label: string;
    detailDefault: string;
    detailWithFeatured: string;
  };
  categories: {
    label: string;
    detailWithExamples: string;
  };
  proSellers: {
    label: string;
    detailWithPros: string;
    detailFallback: string;
  };
};

type HeroStrings = {
  eyebrow: string;
  title: string;
  subtitle: string;
  stats: HeroStatStrings;
};

type RibbonStrings = {
  boosted: string;
  pro: string;
  featured: string;
  recommended: string;
};

export type HomeLocaleStrings = {
  hero: HeroStrings;
  services: HomeServiceCard[];
  testimonials: HomeTestimonial[];
  trendingSearches: HomeTrendingSearch[];
  ribbons: RibbonStrings;
};

const DEFAULT_LOCALE: HomeLocale = 'fr';
const SUPPORTED_LOCALES: HomeLocale[] = ['fr', 'en'];

const HOME_TRANSLATIONS: Record<HomeLocale, HomeLocaleStrings> = {
  fr: {
    hero: {
      eyebrow: 'Depuis toujours, l’occasion a du bon',
      title: 'Partez à la découverte des bonnes affaires autour de vous',
      subtitle:
        'Des millions d’annonces vérifiées pour trouver le logement, le job ou l’objet qui vous correspond.',
      stats: {
        activeListings: {
          label: 'Annonces actives',
          detailDefault: 'Nouvelles annonces chaque jour',
          detailWithFeatured: '{{count}} mises en avant'
        },
        categories: {
          label: 'Catégories',
          detailWithExamples: 'Populaires : {{examples}}'
        },
        proSellers: {
          label: 'Vendeurs PRO',
          detailWithPros: 'Professionnels actifs',
          detailFallback: 'Devenez vendeur pro'
        }
      }
    },
    services: [
      {
        title: 'Paiement sécurisé',
        description:
          'Une solution intégrée pour acheter et vendre en toute confiance.',
        actionLabel: 'Découvrir le paiement OMAKET',
        actionUrl: '/services/paiement'
      },
      {
        title: 'Livraison simplifiée',
        description:
          'Des partenaires fiables pour expédier ou recevoir votre article.',
        actionLabel: 'Explorer la livraison OMAKET',
        actionUrl: '/services/livraison'
      },
      {
        title: 'Assistance dédiée',
        description:
          'Un accompagnement 7j/7 pour vos questions et vos transactions.',
        actionLabel: 'Contacter le support',
        actionUrl: '/support'
      }
    ],
    testimonials: [
      {
        id: 'testimonial-awa',
        quote:
          "J’ai trouvé mon nouvel appartement en une semaine grâce à OMAKET. Les contacts sont sérieux et la messagerie sécurisée rassure tout le monde.",
        author: 'Awa, vendeuse PRO',
        location: 'Douala, Cameroun',
        avatarUrl: null
      },
      {
        id: 'testimonial-mamadou',
        quote:
          'En tant qu’artisan, je reçois des demandes qualifiées tous les jours. Mes ventes ont augmenté de 35% depuis mon passage en compte PRO.',
        author: 'Mamadou, artisan menuisier',
        location: 'Yaoundé, Cameroun',
        avatarUrl: null
      },
      {
        id: 'testimonial-oussou',
        quote:
          'Les options de mise en avant sont très efficaces. Mon stock high-tech part deux fois plus vite en activant les promotions.',
        author: 'Ousmane, vendeur high-tech',
        location: 'Bafoussam, Cameroun',
        avatarUrl: null
      }
    ],
    trendingSearches: [
      {
        id: 'trend-immobilier',
        label: 'Appartements avec balcon',
        query: 'appartement balcon',
        resultCount: 1860
      },
      {
        id: 'trend-voitures',
        label: 'SUV d’occasion',
        query: 'SUV',
        resultCount: 1420
      },
      {
        id: 'trend-emploi',
        label: 'Jobs développeur JS',
        query: 'développeur javascript',
        resultCount: 980
      },
      {
        id: 'trend-mode',
        label: 'Sneakers édition limitée',
        query: 'sneakers',
        resultCount: 760
      },
      {
        id: 'trend-services',
        label: 'Cours particuliers en ligne',
        query: 'cours particuliers',
        resultCount: 540
      }
    ],
    ribbons: {
      boosted: 'Boostée',
      pro: 'Pro',
      featured: 'À la une',
      recommended: 'Recommandé'
    }
  },
  en: {
    hero: {
      eyebrow: 'Second-hand has always been the smart choice',
      title: 'Discover the best local deals around you',
      subtitle:
        'Millions of verified listings to find the home, job or item that fits you.',
      stats: {
        activeListings: {
          label: 'Active listings',
          detailDefault: 'New listings every day',
          detailWithFeatured: '{{count}} highlighted listings'
        },
        categories: {
          label: 'Categories',
          detailWithExamples: 'Popular: {{examples}}'
        },
        proSellers: {
          label: 'PRO sellers',
          detailWithPros: 'Active professionals',
          detailFallback: 'Become a pro seller'
        }
      }
    },
    services: [
      {
        title: 'Secure payment',
        description:
          'An integrated solution to buy and sell with confidence.',
        actionLabel: 'Discover OMAKET Pay',
        actionUrl: '/services/paiement'
      },
      {
        title: 'Hassle-free delivery',
        description:
          'Trusted partners to ship or receive your item.',
        actionLabel: 'Explore OMAKET Delivery',
        actionUrl: '/services/livraison'
      },
      {
        title: 'Dedicated assistance',
        description:
          '7-day support for your questions and transactions.',
        actionLabel: 'Contact support',
        actionUrl: '/support'
      }
    ],
    testimonials: [
      {
        id: 'testimonial-awa',
        quote:
          'I found my new apartment in one week thanks to OMAKET. Serious contacts and secure messaging reassure everyone.',
        author: 'Awa, PRO seller',
        location: 'Douala, Cameroon',
        avatarUrl: null
      },
      {
        id: 'testimonial-mamadou',
        quote:
          'As a craftsman I receive qualified requests every day. My sales jumped 35% after switching to a PRO account.',
        author: 'Mamadou, carpenter',
        location: 'Yaounde, Cameroon',
        avatarUrl: null
      },
      {
        id: 'testimonial-oussou',
        quote:
          'Highlight options are very effective. My high-tech stock moves twice as fast when promotions are enabled.',
        author: 'Ousmane, tech seller',
        location: 'Bafoussam, Cameroon',
        avatarUrl: null
      }
    ],
    trendingSearches: [
      {
        id: 'trend-immobilier',
        label: 'Apartments with balconies',
        query: 'balcony apartment',
        resultCount: 1860
      },
      {
        id: 'trend-voitures',
        label: 'Second-hand SUVs',
        query: 'SUV',
        resultCount: 1420
      },
      {
        id: 'trend-emploi',
        label: 'JavaScript developer jobs',
        query: 'javascript developer',
        resultCount: 980
      },
      {
        id: 'trend-mode',
        label: 'Limited edition sneakers',
        query: 'limited sneakers',
        resultCount: 760
      },
      {
        id: 'trend-services',
        label: 'Online private lessons',
        query: 'online tutoring',
        resultCount: 540
      }
    ],
    ribbons: {
      boosted: 'Boosted',
      pro: 'Pro',
      featured: 'Top pick',
      recommended: 'Recommended'
    }
  }
};

function normalizeLocale(value?: string | null): HomeLocale | undefined {
  if (!value) {
    return undefined;
  }
  const lower = value.toLowerCase();
  return SUPPORTED_LOCALES.find(
    locale => lower === locale || lower.startsWith(`${locale}-`)
  );
}

function resolveFromHeader(header?: string): HomeLocale | undefined {
  if (!header) {
    return undefined;
  }
  return header
    .split(',')
    .map(part => part.trim())
    .map(part => part.split(';')[0])
    .map(normalizeLocale)
    .find((locale): locale is HomeLocale => Boolean(locale));
}

export function resolvePreferredHomeLocale(
  locale?: string,
  acceptLanguage?: string
): HomeLocale {
  return (
    normalizeLocale(locale) ??
    resolveFromHeader(acceptLanguage) ??
    DEFAULT_LOCALE
  );
}

export function getHomeTranslations(
  locale?: string | HomeLocale
): HomeLocaleStrings {
  if (!locale) {
    return HOME_TRANSLATIONS[DEFAULT_LOCALE];
  }

  if (typeof locale === 'string') {
    const normalized = normalizeLocale(locale);
    return HOME_TRANSLATIONS[normalized ?? DEFAULT_LOCALE];
  }

  return HOME_TRANSLATIONS[locale];
}
