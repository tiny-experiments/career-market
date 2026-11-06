import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Skills' };

export default function Page() {
  return (
    <ComingSoon title="Skills">
      Demand for one skill: roles that name it over time, the professions and companies that want it, and the skills it
      is paired with.
    </ComingSoon>
  );
}
