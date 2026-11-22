// A small, deterministic search index. It runs on the player's device and never
// turns a matching legacy record into a verified EQL claim.
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'can', 'do', 'does', 'for', 'from', 'get',
  'have', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'the', 'to',
  'what', 'where', 'which', 'who', 'with', 'you', 'find', 'show', 'tell',
  'about', 'please', 'everquest', 'legends', 'eql',
]);

export function searchTokens(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g)?.filter((word) => !STOP_WORDS.has(word)) || [])];
}

export function searchScore(query: string, title: string, context = ''): number {
  const tokens = searchTokens(query);
  if (!tokens.length) return 0;
  const titleWords = searchTokens(title);
  const contextWords = searchTokens(context);
  const fullTitle = title.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const phrase = tokens.join(' ');
  let score = fullTitle === phrase ? 30 : fullTitle.includes(phrase) ? 14 : 0;
  let matches = 0;
  for (const token of tokens) {
    if (titleWords.includes(token)) { score += 8; matches++; }
    else if (titleWords.some((word) => word.startsWith(token))) { score += 5; matches++; }
    else if (contextWords.includes(token)) { score += 3; matches++; }
    else if (contextWords.some((word) => word.startsWith(token))) { score += 1; matches++; }
  }
  return matches ? score + matches / tokens.length : 0;
}
