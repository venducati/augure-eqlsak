import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const input = process.argv[2] || 'eqlwiki-commands.html';
const html = readFileSync(input, 'utf8');
const decode = (value) => value
  .replace(/<br\s*\/?\s*>/gi, ' ')
  .replace(/<li[^>]*>/gi, ' · ')
  .replace(/<[^>]+>/g, '')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
  .replaceAll('&#160;', ' ').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  .replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
const commands = [];
const commandMatches = [...html.matchAll(/<dl><dt>[\s\S]*?<code>(\/[\s\S]*?)<\/code><\/dt>/g)];
for (const [index, match] of commandMatches.entries()) {
  const syntax = decode(match[1]);
  const nextIndex = commandMatches[index + 1]?.index ?? html.length;
  const remainder = html.slice((match.index ?? 0) + match[0].length, nextIndex);
  const definition = remainder.match(/<dd>([\s\S]*?)<\/dd>/)?.[1];
  const description = decode(syntax.startsWith('/useitem ') ? remainder : (definition ?? ''));
  if (syntax.startsWith('/') && !commands.some((entry) => entry.syntax === syntax)) {
    commands.push({ syntax, description });
  }
}
mkdirSync('data', { recursive: true });
writeFileSync('data/eqlwiki-commands.json', `${JSON.stringify(commands, null, 2)}\n`);
console.log(`Extracted ${commands.length} command entries with descriptions.`);
