export const characterReportKinds = [
  'logs',
  'inventory',
  'spellbook',
  'factions',
  'achievements',
  'aa',
] as const;

export type CharacterReportKind = (typeof characterReportKinds)[number];
export type CharacterSyncTransport = 'file-import' | 'desktop-lan' | 'native-share';

export type CharacterSyncEntry = {
  kind: CharacterReportKind;
  fileName: string;
  exportedAt?: string;
  checksum?: string;
  provenance: 'User-Verified EQL' | 'EQL-specific source' | 'Legacy EQ unverified';
};

export type CharacterSyncEnvelope = {
  schema: 'eqlsak-character-sync-v1';
  character: string;
  server?: string;
  createdAt: string;
  transport: CharacterSyncTransport;
  entries: CharacterSyncEntry[];
};

export function isCharacterSyncEnvelope(value: unknown): value is CharacterSyncEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CharacterSyncEnvelope>;
  return candidate.schema === 'eqlsak-character-sync-v1' &&
    typeof candidate.character === 'string' && candidate.character.length > 0 && candidate.character.length <= 200 &&
    typeof candidate.createdAt === 'string' &&
    ['file-import', 'desktop-lan', 'native-share'].includes(candidate.transport || '') &&
    Array.isArray(candidate.entries) && candidate.entries.length <= 100 &&
    candidate.entries.every((entry) => entry &&
      characterReportKinds.includes(entry.kind) &&
      typeof entry.fileName === 'string' && entry.fileName.length > 0 && entry.fileName.length <= 500 &&
      ['User-Verified EQL', 'EQL-specific source', 'Legacy EQ unverified'].includes(entry.provenance));
}
