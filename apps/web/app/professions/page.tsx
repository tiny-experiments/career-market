import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Professions' };

export default function Page() {
  return (
    <ComingSoon title="Professions">
      Follow one profession the way you follow a stock: open roles over time, sub-professions, seniority mix, top
      countries, hiring companies and skills.
    </ComingSoon>
  );
}
