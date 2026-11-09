import { jobSlug, isJobId } from '@cm/core/job';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ClosedJobView } from '@/components/job/ClosedJobView';
import { JobView } from '@/components/job/JobView';
import { getJob } from '@/lib/jobApi';
import { jobHref } from '@/lib/links';
import '../../job.css';

type Params = Promise<{ id: string; slug?: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  if (!isJobId(id)) return { title: 'Job not found' };
  const res = await getJob(id);
  if (res.kind === 'open') {
    const { job } = res.payload;
    return {
      title: `${job.title} at ${job.company.name}`,
      description: `${job.title} at ${job.company.name}: details, pay, how long it has been open and how it compares with the market. Apply on the employer's site.`,
    };
  }
  if (res.kind === 'closed') return { title: 'This role has closed' };
  return { title: 'Job not found' };
}

export default async function JobPage({ params }: { params: Params }) {
  const { id, slug } = await params;
  if (!isJobId(id)) notFound();
  const res = await getJob(id);
  if (res.kind === 'missing') notFound();
  if (res.kind === 'error') return <JobUnavailable />;
  if (res.kind === 'closed') return <ClosedJobView job={res.payload} />;

  // One address per posting: the id decides the page, the slug is for reading.
  const { job } = res.payload;
  if (slug?.length !== 1 || slug[0] !== jobSlug(job.title)) permanentRedirect(jobHref(job.id, job.title));
  return <JobView payload={res.payload} />;
}

function JobUnavailable() {
  return (
    <section className="card unavailable" aria-labelledby="unavailable-title">
      <h1 id="unavailable-title">This role is not available right now</h1>
      <p className="muted">Career Market could not reach its data. Try again in a few minutes.</p>
    </section>
  );
}
