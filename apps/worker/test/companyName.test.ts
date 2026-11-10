import { describe, expect, it } from 'vitest';
import { cleanCareerTitle, cleanSiteName, companyDisplay, isCodeName, isTenantCode, siteNameFor } from '@cm/core/companyName';

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
    ['Pearson Candidate Experience Site', 'Pearson'],
    ['Cheniere Candidate Experience External Site', 'Cheniere'],
    ['the Myriad Genetics Candidate site', 'Myriad Genetics'],
    ['BDO USA Experienced Career Site', 'BDO USA'],
    ['Bank Negara Malaysia - Professional Career Site', 'Bank Negara Malaysia'],
    ['BCBSM Career Section', 'BCBSM'],
    ['Co-op External Career Section', 'Co-op'],
    ['Midmark Corporation Career Opportunities', 'Midmark Corporation'],
    ['Legrand Group Opportunities - Join us', 'Legrand Group'],
    ['DENSO Career Connection', 'DENSO'],
    ['Rice University Minimal Template External Career Site', 'Rice University'],
    ['Jobs at Acosta', 'Acosta'],
    ['Jobs @ Carmeuse', 'Carmeuse'],
    ['Working at Signature Aviation', 'Signature Aviation'],
    ['Job Listings at Liquidity Services Inc.', 'Liquidity Services'],
    ['Job Opportunities | MCB Group', 'MCB Group'],
    ['Trabaja en Interbank', 'Interbank'],
    ['Lavora con Noi - Gruppo Credem', 'Gruppo Credem'],
    ['Explore RH Careers', 'RH'],
    ['Bank of England Job Board -', 'Bank of England'],
    ['FAB |', 'FAB'],
    ['Texas Woman’s University | TWU', 'Texas Woman’s University'],
    ['Omnicell (temp)', 'Omnicell'],
    ['Blackmore_Career_Site_New', 'Blackmore'],
    ['NemoursCareerSite', 'Nemours'],
    ['Chartwell Career Site English', 'Chartwell'],
    ['daa All Open Jobs', 'daa'],
  ])('%s -> %s', (raw, expected) => {
    expect(cleanSiteName(raw)).toBe(expected);
  });

  it.each([
    ['Candidate Experience site'],
    ['Global Career Site'],
    ['Join'],
    ['Site kandidaatervaring'],
    ['fa-eqzh-saasfaprod1'],
    ['Careers'],
    ['Page not found'],
    ['All Jobs'],
    ['Candidate Experience Site - Campus'],
    ['Experienced Professionals'],
    ['Student'],
    ['Home Page'],
    ['Talent Acquisition'],
    ['Career Site - Mexico'],
    ['Career Site Configuration Documentation'],
    ['Vision Jobs'],
    ['Business Operations and Legal'],
    ['Hill Minimal 112022'],
  ])(
    'names no one: %s',
    (raw) => {
      expect(cleanSiteName(raw)).toBeNull();
    },
  );
});


describe('isTenantCode', () => {
  it.each([
    ['fa-eqzh-saasfaprod1', []],
    ['Fa Evxn Saasfaukgovprod1', []],
    ['Eexs', ['eexs.fa.us2.oraclecloud.com']],
    ['Hcwx (CX_3001)', ['hcwx.fa.us2.oraclecloud.com']],
    ['ibqbjb-dev1', ['ibqbjb-dev1.fa.ocs.oraclecloud.com']],
    ['ibnjjb.fa.ocs.oraclecloud.com', ['ibnjjb.fa.ocs.oraclecloud.com']],
    ['Eoff', ['eoff.fa.em1.ukg.oraclecloud.com']],
  ])('%s is a tenant code', (raw, hosts) => {
    expect(isTenantCode(raw, hosts)).toBe(true);
  });

  it.each([
    ['Masimo', ['egcu.fa.us6.oraclecloud.com']],
    ['Baylor Careers', ['ejof.fa.us2.oraclecloud.com']],
    ['Eexs', []],
  ])('%s is not a tenant code', (raw, hosts) => {
    expect(isTenantCode(raw, hosts)).toBe(false);
  });
});

describe('siteNameFor', () => {
  it('lets a site name a tenant code', () => {
    expect(siteNameFor('Hcwp', ['hcwp.fa.us2.oraclecloud.com'], 'Coherent Corp. US')).toBe('Coherent Corp. US');
    expect(siteNameFor('Fa Ewgu Saasfaprod1', ['fa-ewgu-saasfaprod1.fa.ocs.oraclecloud.com'], 'Chubb')).toBe('Chubb');
    expect(siteNameFor('Fa Ewgu Saasfaprod1', [], null)).toBeNull();
  });

  it('lets a site only respell any other name', () => {
    expect(siteNameFor('Kpmg', ['ekpm.fa.us2.oraclecloud.com'], 'KPMG')).toBe('KPMG');
    expect(siteNameFor('Ford Global Career Site', ['efds.fa.us2.oraclecloud.com'], 'Ford')).toBe('Ford');
    expect(siteNameFor('RAKBANK', ['x.fa.em2.oraclecloud.com'], 'Rak Bank')).toBe('Rak Bank');
    expect(siteNameFor('Masimo', ['egcu.fa.us6.oraclecloud.com'], 'Student Employment')).toBeNull();
    expect(siteNameFor('Baylor Careers', ['ejof.fa.us2.oraclecloud.com'], 'Student Employment')).toBeNull();
  });
});
