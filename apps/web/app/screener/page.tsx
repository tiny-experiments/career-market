import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Screener' };

export default function Page() {
  return (
    <ComingSoon title="Screener">
      Filter the market by region, country, work mode, seniority, profession, skill, salary and posting age, with the
      matching companies and jobs underneath.
    </ComingSoon>
  );
}
