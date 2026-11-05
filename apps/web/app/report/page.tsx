import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: 'Weekly report' };

export default function Page() {
  return (
    <ComingSoon title="Weekly report">
      A rule-written summary of the week in tech hiring, published every Monday from the same read model as the market
      notes.
    </ComingSoon>
  );
}
