import { jobSlug } from '@cm/core/job';

/** Where pages link to each other. One place, so a route that changes is a one-line fix. */
export const jobHref = (id: string, title: string) => `/job/${id}/${jobSlug(title)}`;
export const companyHref = (companyId: string) => `/companies/${encodeURIComponent(companyId)}`;
export const professionHref = (code: string) => `/professions/${code.toLowerCase()}`;
