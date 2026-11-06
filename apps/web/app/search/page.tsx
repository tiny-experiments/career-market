import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Search' };

export default function Page() {
  return (
    <ComingSoon title="Search">
      Search across professions, companies, skills and roles arrives with the profession, company and skill pages.
    </ComingSoon>
  );
}
