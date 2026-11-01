import { z } from 'zod';
const parsed = z
  .object({
    VITE_API_BASE_URL: z
      .string()
      .refine((value) => value.startsWith('/') || /^https?:\/\//.test(value))
      .default('/api/v1'),
    VITE_APP_NAME: z.string().default('SNK Onchain'),
  })
  .parse(import.meta.env);
export const env = { apiBaseUrl: parsed.VITE_API_BASE_URL, appName: parsed.VITE_APP_NAME };
