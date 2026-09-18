// Where she can sell. None of these sites let an outside app post for you, so the app gets
// everything ready (photos saved, words on the clipboard) and opens the site's own "sell" page.
// On a phone with the site's app installed, these links usually open the app itself.

const q = (text) => encodeURIComponent(text || '');

export const PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    short: 'Facebook',
    abbr: 'FB',
    local: true,
    post: 'https://www.facebook.com/marketplace/create/item',
    search: (t) => `https://www.facebook.com/marketplace/search/?query=${q(t)}`,
    howTo: 'In the Facebook app: Marketplace, then Sell, then Items.',
    // Marketplace's own condition choices.
    conditions: { new: 'New', likenew: 'Used - Like New', good: 'Used - Good', fair: 'Used - Fair', parts: 'Used - Fair' },
  },
  {
    id: 'offerup',
    name: 'OfferUp',
    short: 'OfferUp',
    abbr: 'OU',
    local: true,
    post: 'https://offerup.com/post',
    search: (t) => `https://offerup.com/search?q=${q(t)}`,
    howTo: 'In the OfferUp app, tap Post at the bottom.',
  },
  {
    id: 'craigslist',
    name: 'Craigslist',
    short: 'Craigslist',
    abbr: 'CL',
    local: true,
    titleMax: 70,
    post: 'https://post.craigslist.org/',
    search: (t) => `https://www.craigslist.org/search/sss?query=${q(t)}`,
    howTo: 'Pick "for sale by owner", then the closest category.',
  },
  {
    id: 'nextdoor',
    name: 'Nextdoor',
    short: 'Nextdoor',
    abbr: 'ND',
    local: true,
    post: 'https://nextdoor.com/for_sale_and_free/',
    howTo: 'Tap Post, then "Sell or give away an item".',
  },
  {
    id: 'mercari',
    name: 'Mercari',
    short: 'Mercari',
    abbr: 'ME',
    local: false,
    titleMax: 80,
    post: 'https://www.mercari.com/sell/',
    search: (t) => `https://www.mercari.com/search/?keyword=${q(t)}`,
    howTo: 'Mercari is ship-only, so weigh it and pick a shipping option.',
  },
  {
    id: 'ebay',
    name: 'eBay',
    short: 'eBay',
    abbr: 'eB',
    local: false,
    titleMax: 80,
    post: 'https://www.ebay.com/sl/sell',
    search: (t) => `https://www.ebay.com/sch/i.html?_nkw=${q(t)}&LH_Sold=1&LH_Complete=1`,
    howTo: 'eBay may suggest a matching product; pick it if it fits.',
  },
  {
    id: 'poshmark',
    name: 'Poshmark',
    short: 'Poshmark',
    abbr: 'PM',
    local: false,
    titleMax: 80,
    post: 'https://poshmark.com/create-listing',
    howTo: 'Best for clothes, shoes, bags and home decor.',
  },
];

export const DEFAULT_PLATFORMS = ['facebook', 'offerup', 'craigslist', 'nextdoor', 'mercari', 'ebay'];

// Where a sale can happen besides the sites above.
export const IN_PERSON = { id: 'person', name: 'In person / other', short: 'In person', abbr: '••', local: true };

export const platform = (id) => PLATFORMS.find((p) => p.id === id) || (id === IN_PERSON.id ? IN_PERSON : null);

export const platformName = (id) => platform(id)?.short || 'Other';

// "What do these usually sell for?" links. eBay's is sold listings only, which is the most honest guide.
export const PRICE_CHECKS = [
  { id: 'ebay', label: 'eBay sold', url: (t) => `https://www.ebay.com/sch/i.html?_nkw=${q(t)}&LH_Sold=1&LH_Complete=1` },
  { id: 'facebook', label: 'Marketplace', url: (t) => `https://www.facebook.com/marketplace/search/?query=${q(t)}` },
  { id: 'offerup', label: 'OfferUp', url: (t) => `https://offerup.com/search?q=${q(t)}` },
  { id: 'vinted', label: 'Vinted', url: (t) => `https://www.vinted.com/catalog?search_text=${q(t)}` },
  { id: 'google', label: 'Google', url: (t) => `https://www.google.com/search?q=${q(`${t} price`)}` },
];
