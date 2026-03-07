import { z } from 'zod';

export const walletAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address');

export const contractAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address');

export const solanaAddressSchema = z
  .string()
  .trim()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address');

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .max(254);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1, 'Search query is required').max(200, 'Search query too long'),
});

export const tokenSearchSchema = z.object({
  query: z.string().trim().min(1).max(200),
  chain: z.enum(['ethereum', 'solana', 'bsc', 'polygon', 'arbitrum', 'base', 'all']).default('all'),
});

export const predictionSchema = z.object({
  tokenAddress: z.string().trim().min(1),
  direction: z.enum(['up', 'down']),
  targetPrice: z.coerce.number().positive('Target price must be positive'),
  timeframe: z.enum(['1h', '4h', '12h', '24h', '7d', '30d']),
});

export const portfolioSchema = z.object({
  walletAddress: walletAddressSchema,
  chain: z.enum(['ethereum', 'solana', 'bsc', 'polygon', 'arbitrum', 'base']).optional(),
});

export const caLookupSchema = z.object({
  address: z.string().trim().min(1, 'Address is required').max(100),
});

export const gameScoreSchema = z.object({
  score: z.coerce.number().int().min(0),
  level: z.coerce.number().int().min(1),
});

export const builderSubmissionSchema = z.object({
  projectName: z.string().trim().min(1).max(100),
  description: z.string().trim().min(10).max(2000),
  website: z.string().url().optional().or(z.literal('')),
  category: z.string().trim().min(1).max(50),
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const message = result.error.issues.map((i) => i.message).join(', ');
  return { success: false, error: message };
}
