import { describe, expect, it } from 'vitest';
import { FAMILIES } from '../src/codes.ts';
import { familyByCode, professionHref, professionLongName, specialtyLabel } from '../src/professions.ts';

describe('profession routes', () => {
  it('maps the lower-case ticker code in the URL back to the krill family', () => {
    expect(familyByCode('aiml')).toBe('ai-ml');
    expect(familyByCode('AIML')).toBe('ai-ml');
    expect(familyByCode('swe')).toBe('software');
    expect(familyByCode('nope')).toBeNull();
  });

  it('round-trips every family through its href', () => {
    for (const f of FAMILIES) {
      const code = professionHref(f.id).replace('/professions/', '');
      expect(familyByCode(code)).toBe(f.id);
    }
  });

  it('has a long name and readable specialty labels', () => {
    expect(professionLongName('ai-ml')).toBe('AI & Machine Learning');
    expect(specialtyLabel('applied-ai')).toBe('Applied AI');
    expect(specialtyLabel('data-engineering')).toBe('Data Engineering');
  });
});
