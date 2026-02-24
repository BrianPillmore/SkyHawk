/**
 * SEO meta tag utility.
 * Provides functions to dynamically update document head meta tags
 * for improved search engine visibility and social sharing.
 */

export interface SEOConfig {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  keywords?: string[];
}

const DEFAULT_OG_IMAGE = 'https://gotruf.com/og-default.png';
const SITE_NAME = 'GotRuf';

/**
 * Create or update a <meta> tag by name or property attribute.
 */
function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  let element = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Set or update the canonical link element.
 */
function setCanonicalLink(url: string): void {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

/**
 * Update all document meta tags based on the provided SEO configuration.
 * Call this on page mount/navigation to keep meta tags in sync.
 */
export function updateDocumentMeta(config: SEOConfig): void {
  // Title
  const fullTitle = config.title.includes(SITE_NAME)
    ? config.title
    : `${config.title} | ${SITE_NAME}`;
  document.title = fullTitle;

  // Standard meta tags
  setMetaTag('name', 'description', config.description);

  if (config.keywords && config.keywords.length > 0) {
    setMetaTag('name', 'keywords', config.keywords.join(', '));
  }

  // Open Graph tags
  setMetaTag('property', 'og:title', fullTitle);
  setMetaTag('property', 'og:description', config.description);
  setMetaTag('property', 'og:image', config.ogImage || DEFAULT_OG_IMAGE);
  setMetaTag('property', 'og:type', config.ogType || 'website');
  setMetaTag('property', 'og:site_name', SITE_NAME);

  // Twitter Card tags
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', fullTitle);
  setMetaTag('name', 'twitter:description', config.description);
  setMetaTag('name', 'twitter:image', config.ogImage || DEFAULT_OG_IMAGE);

  // Canonical URL
  if (config.canonical) {
    setCanonicalLink(config.canonical);
  }
}

// ---------------------------------------------------------------------------
// Structured Data (JSON-LD)
// ---------------------------------------------------------------------------

/**
 * Inject or update a JSON-LD structured data script in the document head.
 * Uses a data attribute to identify and replace existing blocks.
 */
export function setStructuredData(id: string, data: Record<string, unknown>): void {
  let script = document.querySelector(`script[data-jsonld="${id}"]`) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-jsonld', id);
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/**
 * Pre-built structured data for the GotRuf organization.
 */
export function getOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GotRuf',
    url: 'https://gotruf.com',
    logo: 'https://gotruf.com/logo.png',
    description:
      'Professional roof measurements powered by satellite imagery and AI. Affordable alternative to EagleView.',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'enterprise@gotruf.com',
      contactType: 'sales',
    },
  };
}

/**
 * Pre-built structured data for the GotRuf product.
 */
export function getProductSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'GotRuf Roof Report',
    description:
      'Complete roof measurements including area, pitch, edges, material estimates, 3D model, and solar analysis. Powered by satellite imagery and AI.',
    brand: {
      '@type': 'Brand',
      name: 'GotRuf',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Pay Per Report',
        price: '9.99',
        priceCurrency: 'USD',
        description: 'Single roof measurement report',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '99.00',
        priceCurrency: 'USD',
        description: '25 reports per month with rollover',
        availability: 'https://schema.org/InStock',
      },
    ],
  };
}

/**
 * Build an FAQ structured data schema from question/answer pairs.
 */
export function getFAQSchema(
  faqs: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
