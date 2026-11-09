import { describe, expect, it } from 'vitest';
import { cleanCareerTitle, companyDisplay } from '@cm/core/companyName';

describe('cleanCareerTitle', () => {
  it.each([
    ['Working at L3Harris Technologies', 'L3Harris Technologies'],
    ['Careers at EY: search jobs', 'EY'],
    ['Search Jobs at TE Connectivity', 'TE Connectivity'],
    ['Emerson Career Site', 'Emerson'],
    ['BNY External Career Site', 'BNY'],
    ['Ford Global Career Site', 'Ford'],
    ['Pwc (Crm Experienced Careers Site)', 'Pwc'],
    ['Accenture', 'Accenture'],
    ['Bosch Group', 'Bosch Group'],
  ])('%s becomes %s', (raw, name) => {
    expect(cleanCareerTitle(raw)).toBe(name);
  });

  it('never leaves nothing', () => {
    expect(cleanCareerTitle('Careers')).toBe('Careers');
  });
});

describe('companyDisplay', () => {
  it.each([
    ['Ngc', 'northropgrumman.com', 'Northrop Grumman'],
    ['eofe', 'bny.com', 'BNY'],
    ['Gdit', 'gdit.com', 'GDIT'],
    ['Paloaltonetworks', 'paloaltonetworks.com', 'Palo Alto Networks'],
    ['Careers at EY: search jobs', 'ey.com', 'EY'],
  ])('prefers a known brand: %s at %s', (raw, domain, name) => {
    expect(companyDisplay(raw, domain)).toEqual({ name, named: true });
  });

  it.each([
    ['amazon', 'amazon.com', 'Amazon'],
    ['okta', 'okta.com', 'Okta'],
    ['hpe', 'hewlett.com', 'Hewlett'],
    ['unitytech', 'unity.com', 'Unity'],
    ['ibm', 'ibm.com', 'IBM'],
    ['AG', 'airbus.com', 'Airbus'],
  ])('names a bare code from its site: %s at %s', (raw, domain, name) => {
    expect(companyDisplay(raw, domain)).toEqual({ name, named: true });
  });

  it.each([
    ['NVIDIA', 'nvidia.com'],
    ['RTX', 'rtx.com'],
    ['ByteDance', 'bytedance.com'],
    ['Flextronics', 'foxconn.com'],
    ['Working at L3Harris Technologies', 'l3harris.com'],
  ])('keeps a real name: %s', (raw, domain) => {
    expect(companyDisplay(raw, domain).name).toBe(cleanCareerTitle(raw));
    expect(companyDisplay(raw, domain).named).toBe(true);
  });

  it.each([
    ['Eeho'],
    ['endeavoritsolution'],
    ['Hctz'],
    ['Fa Ewjt Saasfaprod1'],
    ['Careers Inc'],
  ])('keeps a code listed but unnamed without a site: %s', (raw) => {
    expect(companyDisplay(raw, null)).toEqual({ name: cleanCareerTitle(raw), named: false });
  });

  it('accepts a real multi-word name without a site', () => {
    expect(companyDisplay('Bluelight Consulting', null)).toEqual({ name: 'Bluelight Consulting', named: true });
  });

  it('never trusts a tenant code even with a site', () => {
    expect(companyDisplay('Fa Ewjt Saasfaprod1', 'acme.com')).toEqual({ name: 'Acme', named: true });
  });
});
