export interface MetaTagConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export function updateMetaTags(config: MetaTagConfig) {
  const baseUrl = 'https://lunabloom-spa-websit-lxfp.bolt.host';
  const defaultImage = `${baseUrl}/share-preview.jpg`;

  document.title = config.title;

  updateMetaTag('name', 'description', config.description);

  updateMetaTag('property', 'og:title', config.title);
  updateMetaTag('property', 'og:description', config.description);
  updateMetaTag('property', 'og:image', config.image || defaultImage);
  updateMetaTag('property', 'og:url', config.url || baseUrl);

  updateMetaTag('name', 'twitter:title', config.title);
  updateMetaTag('name', 'twitter:description', config.description);
  updateMetaTag('name', 'twitter:image', config.image || defaultImage);
}

function updateMetaTag(
  attribute: 'name' | 'property',
  value: string,
  content: string
) {
  let element = document.querySelector(`meta[${attribute}="${value}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

export const pageMetaTags = {
  booking: {
    title: 'Book Your Spa Session - LunaBloom Spa',
    description: 'Reserve your luxury spa experience at LunaBloom. Choose from our signature treatments including aromatherapy, facials, and relaxation massages.',
  },
  about: {
    title: 'About Us - LunaBloom Spa',
    description: 'Discover the story behind LunaBloom Spa. Our mission is to provide a serene sanctuary where guests can escape, unwind, and rejuvenate.',
  },
};
