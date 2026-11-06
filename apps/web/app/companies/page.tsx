import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Companies' };

export default function Page() {
  return (
    <ComingSoon title="Companies">
      See whether a company is ramping or freezing, which teams grow, and what it builds with. Company trends need daily
      company history from krill, which is being built.
    </ComingSoon>
  );
}
