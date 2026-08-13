import { z } from 'zod';

export const DEFAULT_TOKEN_METADATA_CONFIG = {
  nameKeys: ['name'],
  symbolKeys: ['symbol'],
} as const;

export const DEFAULT_BRANDING_CONFIG = {
  applicationTitle: 'Canton Explorer',
  headerTitle: 'Canton Explorer',
} as const;

export const DEFAULT_FRONTEND_CONFIG = {
  basePath: '/',
} as const;

const nodeBaseSchema = {
  id: z.string().min(1),
  label: z.string().min(1),
  role: z.literal('participant'),
  ledgerLabel: z.string().min(1).optional(),
  pqs: z.object({
    connectionUriEnv: z.string().min(1),
    schema: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).default('public'),
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
        expiresInSeconds: z.number().int().positive().default(3600),
      })
      .strict(),
    z
      .object({
        kind: z.literal('self_signed_es256'),
        sub: z.string().min(1),
        aud: z.string().min(1),
        privateKeyEnv: z.string().min(1),
        expiresInSeconds: z.number().int().positive().default(3600),
      })
      .strict(),
    z
      .object({
        kind: z.literal('static_token'),
        tokenEnv: z.string().min(1).refine((value) => value.trim().length > 0),
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

const tokenMetadataSchema = z
  .object({
    nameKeys: z.array(z.string().min(1)).min(1).default([...DEFAULT_TOKEN_METADATA_CONFIG.nameKeys]),
    symbolKeys: z
      .array(z.string().min(1))
      .min(1)
      .default([...DEFAULT_TOKEN_METADATA_CONFIG.symbolKeys]),
  })
  .strict()
  .default({
    nameKeys: [...DEFAULT_TOKEN_METADATA_CONFIG.nameKeys],
    symbolKeys: [...DEFAULT_TOKEN_METADATA_CONFIG.symbolKeys],
  });

const debuggerConfigSchema = z
  .object({
    localDarDirectory: z.string().min(1).optional(),
  })
  .strict()
  .default({});

const brandingSchema = z
  .object({
    applicationTitle: z
      .string()
      .trim()
      .min(1)
      .default(DEFAULT_BRANDING_CONFIG.applicationTitle),
    headerTitle: z
      .string()
      .trim()
      .min(1)
      .default(DEFAULT_BRANDING_CONFIG.headerTitle),
  })
  .strict()
  .default({
    applicationTitle: DEFAULT_BRANDING_CONFIG.applicationTitle,
    headerTitle: DEFAULT_BRANDING_CONFIG.headerTitle,
  });

const frontendSchema = z
  .object({
    basePath: z
      .string()
      .trim()
      .min(1)
      .regex(/^\/(?!\/)[^?#]*$/, 'basePath must be a relative URL path')
      .transform((value) => (value.endsWith('/') ? value : `${value}/`)),
  })
  .strict()
  .default({
    basePath: DEFAULT_FRONTEND_CONFIG.basePath,
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
  branding: brandingSchema,
  frontend: frontendSchema,
  debugger: debuggerConfigSchema,
  tokenMetadata: tokenMetadataSchema.default({
    nameKeys: [...DEFAULT_TOKEN_METADATA_CONFIG.nameKeys],
    symbolKeys: [...DEFAULT_TOKEN_METADATA_CONFIG.symbolKeys],
  }),
  nodes: z.array(nodeSchema).min(1),
});

export type NodeConfigFile = z.infer<typeof configSchema>;
export type NodeConfig = z.infer<typeof nodeSchema>;
export type TokenMetadataConfig = z.infer<typeof tokenMetadataSchema>;
export type DebuggerConfig = z.infer<typeof debuggerConfigSchema>;
export type BrandingConfig = z.infer<typeof brandingSchema>;
export type FrontendConfig = z.infer<typeof frontendSchema>;

export function parseNodeConfigFile(input: unknown): NodeConfigFile {
  return configSchema.parse(input);
}
