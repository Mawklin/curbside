// Ready-made answers to the questions buyers always send, filled in from the item.
// Most useful first for the item's current status.
import { money, pickupLabel } from './util.js';

const CONDITION_SAYS = {
  new: "it's brand new",
  likenew: "it's in like-new condition",
  good: "it's in good condition",
  fair: "it's in fair condition, with some wear",
  parts: 'it needs some work',
};

export function quickReplies(item, settings = {}, now = Date.now()) {
  const out = [];
  const add = (id, label, text) => out.push({ id, label, text });
  const area = settings.pickupArea?.trim();
  const hasPrice = item.price !== null && item.price !== undefined && item.price !== '';
  const details = [
    item.size?.trim() && `it measures ${item.size.trim()}`,
    CONDITION_SAYS[item.condition],
  ].filter(Boolean);
  const detailsText = details.length ? `${details.join(', and ')}.`.replace(/^./, (c) => c.toUpperCase()) : '';

  if (item.status === 'sold') {
    add('sold', "It's sold", 'Sorry, it already sold. Thanks for asking!');
    return out;
  }
  if (item.status === 'pending') {
    const p = item.pending || {};
    if (p.when) add('confirm', 'Confirm pickup', `See you ${pickupLabel(p.when, now)}! Message me when you're on your way.`);
    add('pending', "It's pending", "Someone's picking it up, but I'll message you if that falls through.");
  }
  if (['tolist', 'listed'].includes(item.status)) {
    add('available', 'Still available', "Hi! Yes, it's still available. When would you like to pick it up?");
  }
  add('pickup', 'Pickup info', area
    ? `Pickup is near ${area}. I'll send the exact address once we pick a time.`
    : "It's pickup only. I'll send the address once we pick a time.");
  if (detailsText) add('details', 'Size & condition', detailsText);
  if (item.floor) add('lowest', 'Lowest price', `The lowest I can do is ${money(item.floor)}.`);
  if (hasPrice) add('firm', 'Price is firm', `The price is firm at ${money(item.price)}, thanks for understanding!`);
  add('first', 'First come', "I don't hold items, but it's yours if you can pick it up first. Just let me know when you're coming.");
  return out;
}
