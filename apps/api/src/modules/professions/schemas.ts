import {
  PROFESSION_REGIONS,
  type ProfessionRegionId,
} from '@cm/core/professions';
import { z } from 'zod';
export const indexQuerySchema = z.strictObject({
  region: z
    .enum(
      PROFESSION_REGIONS.map((region) => region.id) as [
        ProfessionRegionId,
        ...ProfessionRegionId[],
      ],
    )
    .optional(),
});
export const detailParamsSchema = z.strictObject({
  code: z.string().regex(/^[a-zA-Z0-9-]{1,40}$/),
});
