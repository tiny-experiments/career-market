import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql, type Sql } from '@cm/core/db';
import { migrate } from '@cm/core/migrate';
import { applyCompanyNames } from '../src/logos/names.ts';

class Rollback extends Error {}

describe.skipIf(!process.env.TEST_DATABASE_URL)('applyCompanyNames (dedicated test database)', () => {
  let sql: Sql;
  beforeAll(async () => {
    sql = createSql(process.env.TEST_DATABASE_URL!);
    await migrate(sql);
  });
  afterAll(async () => {
    await sql.end();
  });

  it('names companies and copies the name to every table that holds it', async () => {
    const seen = { company: [] as unknown[], ref: '', search: { label: '', keywords: '' } };
    await sql
      .begin(async (tx) => {
        await tx`insert into company (company_id,slug,name,domain,open,rank,updated_on) values
          ('names_ey','ey-names','Careers at EY: search jobs','ey.com',5,900001,'2026-11-09'),
          ('names_code','code-names','Hctz',null,5,900002,'2026-11-09'),
          ('names_eeho','eeho-names','Eeho',null,5,900003,'2026-11-09'),
          ('names_eofe','eofe-names','eofe',null,5,900004,'2026-11-09')`;
        // A hand-checked name, and a site whose logo is only a placeholder (so not published to company.domain).
        await tx`insert into company_name_override (company_id,name,note) values ('names_eeho','Oracle','Eeho')`;
        await tx`insert into company_domain (company_id,domain,source,logo) values ('names_eofe','bny.com','manual','monogram')`;
        await tx`insert into company_ref (company_id,name,fetched_on) values ('names_ey','Careers at EY: search jobs','2026-11-09')`;
        await tx`insert into search_entry (as_of,kind,id,slug,label,open,domain,keywords) values
          ('2026-11-09','company','names_ey','ey-names','Careers at EY: search jobs',5,'ey.com','careers at')`;
        await applyCompanyNames(tx as unknown as Sql);
        seen.company = [...(await tx`select company_id, name, display_name, named from company where company_id like 'names_%' order by company_id`)];
        const [ref] = await tx<{ name: string }[]>`select name from company_ref where company_id = 'names_ey'`;
        seen.ref = ref?.name ?? '';
        const [entry] = await tx<{ label: string; keywords: string }[]>`select label, keywords from search_entry where id = 'names_ey'`;
        seen.search = entry ?? seen.search;
        throw new Rollback();
      })
      .catch((err: unknown) => {
        if (!(err instanceof Rollback)) throw err;
      });
    expect(seen.company).toEqual([
      { company_id: 'names_code', name: 'Hctz', display_name: 'Hctz', named: false },
      { company_id: 'names_eeho', name: 'Eeho', display_name: 'Oracle', named: true },
      { company_id: 'names_eofe', name: 'eofe', display_name: 'BNY', named: true },
      { company_id: 'names_ey', name: 'Careers at EY: search jobs', display_name: 'EY', named: true },
    ]);
    expect(seen.ref).toBe('EY');
    expect(seen.search).toEqual({ label: 'EY', keywords: 'careers at ey' });
  });
});
