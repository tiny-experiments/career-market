import { describe, expect, it } from 'vitest';
import { cleanCareerTitle, cleanSiteName, companyDisplay, isCodeName } from '@cm/core/companyName';

describe('cleanCareerTitle', () => {
  it.each([
    ['Working at L3Harris Technologies', 'L3Harris Technologies'],
    ['Careers at EY: search jobs', 'EY'],
    ['Search Jobs at TE Connectivity', 'TE Connectivity'],
    ['Careers | Farm Credit Services of America', 'Farm Credit Services of America'],
    ['Jobs: Acme Robotics', 'Acme Robotics'],
    ['Careers: Join the team at Western Power', 'Western Power'],
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

  it.each([['MultiCare'], ['EverAI']])('accepts a camel-case name without a site: %s', (raw) => {
    expect(companyDisplay(raw, null)).toEqual({ name: raw, named: true });
  });

  it('takes a hand-checked name over everything else', () => {
    expect(companyDisplay('Eeho', null, 'Oracle')).toEqual({ name: 'Oracle', named: true });
    expect(companyDisplay('Careers at EY: search jobs', 'ey.com', 'Ernst & Young')).toEqual({ name: 'Ernst & Young', named: true });
  });

  it('ignores a blank hand-checked name', () => {
    expect(companyDisplay('Eeho', null, '  ')).toEqual({ name: 'Eeho', named: false });
    expect(companyDisplay('Eeho', null, null)).toEqual({ name: 'Eeho', named: false });
  });

  it('never trusts a tenant code even with a site', () => {
    expect(companyDisplay('Fa Ewjt Saasfaprod1', 'acme.com')).toEqual({ name: 'Acme', named: true });
  });

  it('names a tenant code by its careers site, below a hand-checked name and a known site', () => {
    expect(companyDisplay('fa-eqzh-saasfaprod1', null, null, 'Avient')).toEqual({ name: 'Avient', named: true });
    expect(companyDisplay('Fa Ewgu Saasfaprod1', 'acme.com', null, 'Chubb')).toEqual({ name: 'Chubb', named: true });
    expect(companyDisplay('Eeho', null, null, 'Oracle Careers')).toEqual({ name: 'Oracle Careers', named: true });
    expect(companyDisplay('fa-eqzh-saasfaprod1', null, 'Avient Corporation', 'Avient')).toEqual({ name: 'Avient Corporation', named: true });
    expect(companyDisplay('Fa Ewgu Saasfaprod1', 'ey.com', null, 'Chubb')).toEqual({ name: 'EY', named: true });
    expect(companyDisplay('fa-eqzh-saasfaprod1', null, null, '  ')).toEqual({ name: 'fa-eqzh-saasfaprod1', named: false });
  });

  it('keeps a real name over a careers site name', () => {
    expect(companyDisplay('Bluelight Consulting', null, null, 'Something Else')).toEqual({ name: 'Bluelight Consulting', named: true });
    expect(isCodeName('Bluelight Consulting')).toBe(false);
    expect(isCodeName('Fa Ewgu Saasfaprod1')).toBe(true);
    expect(isCodeName('Eeho')).toBe(true);
  });
});

describe('cleanSiteName', () => {
  it.each([
    ['Avient', 'Avient'],
    ['Chubb External', 'Chubb'],
    ['EXL Talent Acquisition Team', 'EXL'],
    ['Linamar Career Site - New', 'Linamar'],
    ['Candidate Experience Site Polyglass', 'Polyglass'],
    ['Candidate Experience Site - Department of Internal Affairs', 'Department of Internal Affairs'],
    ['TPI Composites Holdings, LLC - Careers', 'TPI Composites Holdings'],
    ['Manhattan DA - Support Staff Openings', 'Manhattan DA'],
    ['Government of Saskatchewan - Career Portal', 'Government of Saskatchewan'],
    ['Mayo Career Site US', 'Mayo'],
    ['Structure Tone Careers - International', 'Structure Tone'],
    ['Verisk Careers | Verisk', 'Verisk'],
    ['New River Valley Community Services | Careers Center', 'New River Valley Community Services'],
    ['Crawford Job Listings - Global', 'Crawford'],
    ['Sitio de Oportunidades Empleo Grupo Coppel', 'Grupo Coppel'],
    ['UT Health San Antonio Staff Positions', 'UT Health San Antonio'],
    ['HKBU e-Recruitment System', 'HKBU'],
    ['ENBD Recruitment Team', 'ENBD'],
    ['Yanfeng Human Resources', 'Yanfeng'],
    ['Care One NEW', 'Care One'],
    ['Innergex_FR', 'Innergex'],
    ['First Solar (US)', 'First Solar'],
    ['Staples Inc.', 'Staples'],
    ['The Citco Group Limited', 'The Citco Group'],
    ['AMANA.', 'AMANA'],
    ["SVKM\\'s School, Dhule", "SVKM's School, Dhule"],
    ['The Lottery Corporation', 'The Lottery Corporation'],
    ['L.F. Driscoll  Careers', 'L.F. Driscoll'],
    ['St. Olaf', 'St. Olaf'],
  ])('%s -> %s', (raw, expected) => {
    expect(cleanSiteName(raw)).toBe(expected);
  });

  it.each([['Candidate Experience site'], ['Global Career Site'], ['Join'], ['Site kandidaatervaring'], ['fa-eqzh-saasfaprod1'], ['Careers']])(
    'names no one: %s',
    (raw) => {
      expect(cleanSiteName(raw)).toBeNull();
    },
  );
});

