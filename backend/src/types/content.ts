/**
 * Backend content data models and validation schemas
 */

import { z } from 'zod';

/**
 * Core content interfaces
 */

export interface Sentence {
  id: string;
  text: string;
  category: string;
}

export interface Acronym {
  id: string;
  term: string;
  meaning: string;
}

/**
 * Configuration interfaces
 */

export interface ContentConfig {
  sentences: Sentence[];
  acronyms: Acronym[];
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: boolean;
    configMaps: boolean;
  };
}

/**
 * Validation schemas using Zod
 */

export const SentenceSchema = z.object({
  id: z.string().min(1, 'Sentence ID is required'),
  text: z.string().min(1, 'Sentence text is required').max(500, 'Sentence text too long'),
  category: z.string().min(1, 'Category is required').max(100, 'Category name too long')
});

export const AcronymSchema = z.object({
  id: z.string().min(1, 'Acronym ID is required'),
  term: z.string().min(1, 'Acronym term is required').max(50, 'Acronym term too long'),
  meaning: z.string().min(1, 'Acronym meaning is required').max(500, 'Acronym meaning too long')
});

export const ContentConfigSchema = z.object({
  sentences: z.array(SentenceSchema),
  acronyms: z.array(AcronymSchema)
});

export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  services: z.object({
    database: z.boolean(),
    configMaps: z.boolean()
  })
});

/**
 * API request/response schemas
 */

export const SentencesQuerySchema = z.object({
  category: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

export const AcronymsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

/**
 * Type inference from schemas
 */

export type SentenceInput = z.infer<typeof SentenceSchema>;
export type AcronymInput = z.infer<typeof AcronymSchema>;
export type ContentConfigInput = z.infer<typeof ContentConfigSchema>;
export type HealthStatusInput = z.infer<typeof HealthStatusSchema>;
export type SentencesQuery = z.infer<typeof SentencesQuerySchema>;
export type AcronymsQuery = z.infer<typeof AcronymsQuerySchema>;