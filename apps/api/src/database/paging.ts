import { z } from 'zod';
export const pagingShape = {
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
};
export interface PageRequest {
  page: number;
  pageSize: number;
}
export interface Page<T> extends PageRequest {
  items: T[];
  total: number;
}
