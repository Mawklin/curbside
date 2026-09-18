// Optional one-tap listing writer using Google Gemini's free tier with her own key.
// The photos go straight from her phone to Google; nothing passes through anyone else.
import { AI_SYSTEM, parseAiReply, sellerNotes } from './listing.js';

// Best free model first. Each has its own free daily allowance, so when one is used up (429),
// busy (5xx) or retired (404), the next usually still works.
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
export const CANCELLED = 'CANCELLED';

class FriendlyError extends Error {}

function problem(status, data) {
  const e = data?.error || {};
  const detail = `${e.status || ''} ${e.message || ''} ${JSON.stringify(e.details || '')}`;
  if (/API_KEY_INVALID|API key not valid|API key expired/i.test(detail)) return "Google didn't accept the AI key. Check it in Settings.";
  if (/location is not supported|not available in your country/i.test(detail)) return "Google's free AI isn't available where you are.";
  if (status === 403) return "That key isn't allowed to use Gemini. Make a new one at aistudio.google.com/apikey.";
  if (status === 429) return "You've hit Google's free limit for now. Wait a minute and try again.";
  if (status >= 500) return 'Google\'s AI is busy right now. Try again in a moment.';
  return e.message || `Google's AI returned an error (${status}).`;
}

// images: [{ mime, data }] with data as base64.
export async function suggestListing({ apiKey, images, item, signal }) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop);
  const timer = setTimeout(stop, 60000);
  let lastProblem = null;
  try {
    for (const model of GEMINI_MODELS) {
      let lowThinking = true;
      for (let attempt = 0; attempt < 2; attempt++) {
        const body = {
          systemInstruction: { parts: [{ text: AI_SYSTEM }] },
          contents: [{
            role: 'user',
            parts: [
              ...images.map((img) => ({ inlineData: { mimeType: img.mime, data: img.data } })),
              { text: `Write the listing for the item in ${images.length > 1 ? 'these photos' : 'this photo'}.${sellerNotes(item)}` },
            ],
          }],
          generationConfig: { responseMimeType: 'application/json' },
        };
        if (lowThinking) body.generationConfig.thinkingConfig = { thinkingLevel: 'low' };
        const res = await fetch(`${GEMINI_API}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.ok) {
          const candidate = data?.candidates?.[0];
          const text = (candidate?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
          const suggestion = parseAiReply(text);
          if (suggestion) return suggestion;
          if (data?.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
            throw new FriendlyError("Google's AI wouldn't describe this one. Try a different photo.");
          }
          lastProblem = "The AI's answer came back garbled. Try again.";
          break;
        }
        // A model that doesn't take the thinking setting: ask again without it.
        if (res.status === 400 && lowThinking && /thinking/i.test(data?.error?.message || '')) {
          lowThinking = false;
          continue;
        }
        lastProblem = problem(res.status, data);
        // A bad key won't be fixed by trying another model.
        if ([400, 401, 403].includes(res.status)) throw new FriendlyError(lastProblem);
        break;
      }
    }
    throw new FriendlyError(lastProblem || "The AI couldn't write this one. Try again.");
  } catch (err) {
    if (err instanceof FriendlyError) throw err;
    if (signal?.aborted) throw new Error(CANCELLED);
    if (err?.name === 'AbortError') throw new Error('The AI took too long. Try again.');
    throw new Error('No connection. Try again when you have signal.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

// Pulls a key out of whatever she pasted (a whole message, a key with spaces, etc.).
export function findKey(text) {
  const m = String(text || '').match(/AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_.-]{20,}/);
  return m ? m[0] : String(text || '').trim();
}
