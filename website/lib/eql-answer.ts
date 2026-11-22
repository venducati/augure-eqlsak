export type EvidenceLevel =
  | 'User-Verified EQL'
  | 'EQL-specific source'
  | 'Legacy EQ unverified';

export type AnswerEvidence = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  source: EvidenceLevel;
};

export type EvidenceAnswer = {
  lead: string;
  confidence: 'Verified' | 'Supported lead' | 'Unverified lead';
  caution: string;
  citations: AnswerEvidence[];
};

const evidenceWeight: Record<EvidenceLevel, number> = {
  'User-Verified EQL': 3,
  'EQL-specific source': 2,
  'Legacy EQ unverified': 1,
};

export function buildEvidenceAnswer(query: string, records: AnswerEvidence[]): EvidenceAnswer | null {
  const seen = new Set<string>();
  const citations = records
    .filter((record) => {
      const key = `${record.kind}:${record.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
  if (!citations.length) return null;

  const primary = citations[0];
  const primaryWeight = evidenceWeight[primary.source];
  const confidence = primaryWeight === 3 ? 'Verified' : primaryWeight === 2 ? 'Supported lead' : 'Unverified lead';
  const lead = `${primary.title}: ${primary.summary}`;
  const caution = primaryWeight === 3
    ? 'The lead answer comes from a record measured or confirmed directly in EQL. Review the numbered records before acting on any lower-confidence details.'
    : primaryWeight === 2
      ? 'This answer is supported by EQL-specific material, but it has not been confirmed in your own game session.'
      : `EQLSaK found only inherited EverQuest material for “${query.trim()}”. Treat it as a lead until it is checked in EQL.`;
  return { lead, confidence, caution, citations };
}
