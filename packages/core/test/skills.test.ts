import { describe, expect, it } from 'vitest';
import { isNonTechnicalSkill, isTileSkill, NON_TECHNICAL_SKILLS } from '../src/codes.ts';

describe('non-technical skills', () => {
  it('names GDPR and the other compliance items', () => {
    for (const id of ['sec:gdpr', 'sec:soc2', 'sec:iso-27001', 'sec:nist-csf', 'sec:hipaa']) {
      expect(NON_TECHNICAL_SKILLS.has(id)).toBe(true);
      expect(isNonTechnicalSkill(id)).toBe(true);
    }
  });

  it('keeps them out of every skill list', () => {
    expect(isTileSkill('sec:gdpr')).toBe(false);
    expect(isTileSkill('sec:soc2')).toBe(false);
  });

  it('leaves technical security skills alone', () => {
    for (const id of ['sec:iam', 'sec:encryption', 'sec:oauth', 'sec:siem']) {
      expect(isNonTechnicalSkill(id)).toBe(false);
      expect(isTileSkill(id)).toBe(true);
    }
  });
});
