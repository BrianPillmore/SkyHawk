/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  updateDocumentMeta,
  setStructuredData,
  getOrganizationSchema,
  getProductSchema,
  getFAQSchema,
  type SEOConfig,
} from '../../src/utils/seo';

/**
 * Tests for the SEO meta tag utility.
 * Validates that meta tags, structured data, and canonical links
 * are correctly set on the document head.
 */

describe('updateDocumentMeta', () => {
  beforeEach(() => {
    // Reset document head
    document.title = '';
    document.head.innerHTML = '';
  });

  it('sets document.title with site name suffix', () => {
    updateDocumentMeta({
      title: 'Pricing',
      description: 'Our pricing page',
    });

    expect(document.title).toBe('Pricing | GotRuf');
  });

  it('does not double-append site name if already present', () => {
    updateDocumentMeta({
      title: 'GotRuf — Professional Roof Measurements',
      description: 'Homepage',
    });

    expect(document.title).toBe('GotRuf — Professional Roof Measurements');
  });

  it('sets meta description', () => {
    updateDocumentMeta({
      title: 'Test',
      description: 'A test description',
    });

    const meta = document.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('A test description');
  });

  it('sets keywords meta tag', () => {
    updateDocumentMeta({
      title: 'Test',
      description: 'Test desc',
      keywords: ['roof', 'measurement', 'AI'],
    });

    const meta = document.querySelector('meta[name="keywords"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('roof, measurement, AI');
  });

  it('sets Open Graph meta tags', () => {
    updateDocumentMeta({
      title: 'Pricing',
      description: 'Pricing page',
      ogImage: 'https://gotruf.com/og-pricing.png',
      ogType: 'product',
    });

    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Pricing | GotRuf');
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('Pricing page');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://gotruf.com/og-pricing.png');
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('product');
    expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('GotRuf');
  });

  it('uses default OG image when none specified', () => {
    updateDocumentMeta({
      title: 'Test',
      description: 'Test',
    });

    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://gotruf.com/og-default.png');
  });

  it('uses default OG type "website" when none specified', () => {
    updateDocumentMeta({
      title: 'Test',
      description: 'Test',
    });

    expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
  });

  it('sets Twitter Card meta tags', () => {
    updateDocumentMeta({
      title: 'Test Page',
      description: 'Test description',
    });

    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe('Test Page | GotRuf');
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe('Test description');
  });

  it('sets canonical link', () => {
    updateDocumentMeta({
      title: 'Pricing',
      description: 'Pricing',
      canonical: 'https://gotruf.com/pricing',
    });

    const link = document.querySelector('link[rel="canonical"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://gotruf.com/pricing');
  });

  it('updates existing meta tags instead of creating duplicates', () => {
    updateDocumentMeta({
      title: 'First',
      description: 'First description',
    });

    updateDocumentMeta({
      title: 'Second',
      description: 'Second description',
    });

    const descriptions = document.querySelectorAll('meta[name="description"]');
    expect(descriptions.length).toBe(1);
    expect(descriptions[0].getAttribute('content')).toBe('Second description');
  });

  it('updates canonical link instead of creating duplicate', () => {
    updateDocumentMeta({
      title: 'A',
      description: 'A',
      canonical: 'https://gotruf.com/a',
    });

    updateDocumentMeta({
      title: 'B',
      description: 'B',
      canonical: 'https://gotruf.com/b',
    });

    const canonicals = document.querySelectorAll('link[rel="canonical"]');
    expect(canonicals.length).toBe(1);
    expect(canonicals[0].getAttribute('href')).toBe('https://gotruf.com/b');
  });
});

describe('setStructuredData', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('inserts a JSON-LD script tag', () => {
    setStructuredData('test', { '@context': 'https://schema.org', '@type': 'Organization', name: 'Test' });

    const script = document.querySelector('script[data-jsonld="test"]');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('type')).toBe('application/ld+json');

    const data = JSON.parse(script?.textContent || '{}');
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Organization');
    expect(data.name).toBe('Test');
  });

  it('updates existing structured data by ID', () => {
    setStructuredData('org', { '@type': 'Organization', name: 'First' });
    setStructuredData('org', { '@type': 'Organization', name: 'Updated' });

    const scripts = document.querySelectorAll('script[data-jsonld="org"]');
    expect(scripts.length).toBe(1);

    const data = JSON.parse(scripts[0].textContent || '{}');
    expect(data.name).toBe('Updated');
  });

  it('can have multiple structured data blocks with different IDs', () => {
    setStructuredData('org', { '@type': 'Organization' });
    setStructuredData('product', { '@type': 'Product' });

    expect(document.querySelectorAll('script[type="application/ld+json"]').length).toBe(2);
  });
});

describe('Schema generators', () => {
  it('getOrganizationSchema returns valid schema', () => {
    const schema = getOrganizationSchema();
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe('GotRuf');
    expect(schema.url).toBe('https://gotruf.com');
  });

  it('getProductSchema returns valid schema with offers', () => {
    const schema = getProductSchema();
    expect(schema['@type']).toBe('Product');
    expect(schema.name).toBe('GotRuf Roof Report');

    const offers = schema.offers as Array<{ name: string; price: string }>;
    expect(offers).toHaveLength(2);
    expect(offers[0].name).toBe('Pay Per Report');
    expect(offers[0].price).toBe('9.99');
    expect(offers[1].name).toBe('Pro Plan');
    expect(offers[1].price).toBe('99.00');
  });

  it('getFAQSchema builds FAQ structured data from Q&A pairs', () => {
    const faqs = [
      { question: 'How much does it cost?', answer: '$9.99 per report.' },
      { question: 'Is there a free trial?', answer: 'First report is free.' },
    ];

    const schema = getFAQSchema(faqs);
    expect(schema['@type']).toBe('FAQPage');

    const entities = schema.mainEntity as Array<{
      '@type': string;
      name: string;
      acceptedAnswer: { text: string };
    }>;
    expect(entities).toHaveLength(2);
    expect(entities[0]['@type']).toBe('Question');
    expect(entities[0].name).toBe('How much does it cost?');
    expect(entities[0].acceptedAnswer.text).toBe('$9.99 per report.');
    expect(entities[1].name).toBe('Is there a free trial?');
  });

  it('getFAQSchema handles empty FAQ list', () => {
    const schema = getFAQSchema([]);
    const entities = schema.mainEntity as unknown[];
    expect(entities).toHaveLength(0);
  });
});
