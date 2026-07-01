import { z } from 'zod';

const nodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  role: z.literal('participant'),
  ledgerLabel: z.string().min(1).optional(),
  pqs: z.object({
    connectionUriEnv: z.string().min(1),
  }),
  grpc: z
    .object({
      target: z.string().min(1),
      useTls: z.boolean().default(false),
      connectTimeoutMs: z.number().int().positive().default(5000),
    })
    .optional(),
  polling: z
    .object({
      intervalMs: z.number().int().positive().default(15000),
      staleAfterMs: z.number().int().positive().default(45000),
    })
    .optional(),
});

const configSchema = z.object({
  nodes: z.array(nodeSchema).min(1),
});

export type NodeConfigFile = z.infer<typeof configSchema>;
export type NodeConfig = z.infer<typeof nodeSchema>;

export function parseNodeConfigFile(input: unknown): NodeConfigFile {
  return configSchema.parse(input);
}
