import assert from 'node:assert/strict';
import { buildEvidenceAnswer } from '../lib/eql-answer.ts';
const verified = { id:'1', kind:'Command', title:'/faction', summary:'Shows measured faction values.', source:'User-Verified EQL' };
const legacy = { id:'2', kind:'Map', title:'Blackburrow', summary:'Saved atlas location.', source:'Legacy EQ unverified' };
assert.equal(buildEvidenceAnswer('faction command', [verified])?.confidence, 'Verified');
assert.equal(buildEvidenceAnswer('where is blackburrow', [legacy, verified])?.confidence, 'Unverified lead');
assert.equal(buildEvidenceAnswer('duplicate', [verified, verified])?.citations.length, 1);
assert.equal(buildEvidenceAnswer('nothing', []), null);
console.log('EQL evidence-answer checks passed');
