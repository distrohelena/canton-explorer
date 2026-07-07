import { z } from 'zod';

const nodeBaseSchema = {
  id: z.string().min(1),
  label: z.string().min(1),
  role: z.literal('participant'),
  ledgerLabel: z.string().min(1).optional(),
  pqs: z.object({
    connectionUriEnv: z.string().min(1),
  }),
  polling: z
    .object({
      intervalMs: z.number().int().positive().default(15000),
      staleAfterMs: z.number().int().positive().default(45000),
    })
    .optional(),
};

const grpcAuthSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('shared_secret_jwt'),
        user: z.string().min(1),
        audience: z.string().min(1),
        secret: z.string().min(1),
      })
      .strict(),
  ])
  .optional();

const grpcSchema = z.object({
  ledgerTarget: z.string().min(1),
  ledgerAdminTarget: z.string().min(1),
  participantAdminTarget: z.string().min(1),
  useTls: z.boolean().default(false),
  connectTimeoutMs: z.number().int().positive().default(5000),
  auth: grpcAuthSchema,
});

const nodeSchema = z.discriminatedUnion('mode', [
  z
    .object({
      ...nodeBaseSchema,
      mode: z.literal('pqs_only'),
    })
    .strict(),
  z
    .object({
      ...nodeBaseSchema,
      mode: z.literal('pqs_with_grpc'),
      grpc: grpcSchema,
    })
    .strict(),
]);

const configSchema = z.object({
  nodes: z.array(nodeSchema).min(1),
});

export type NodeConfigFile = z.infer<typeof configSchema>;
export type NodeConfig = z.infer<typeof nodeSchema>;

export function parseNodeConfigFile(input: unknown): NodeConfigFile {
  return configSchema.parse(input);
}
