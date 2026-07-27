import {
  QuerySource,
  type CantonManager,
  type ContractFindManyArgs,
  type ContractGroupByArgs,
  type JsonProjection,
} from '@distrohelena/canton-typescript-sdk';

const contractQuery = {
  where: { active: true },
  include: { createdTransaction: true },
  orderBy: [{ createdAt: 'desc' }],
} satisfies ContractFindManyArgs;

const contractGroup = {
  by: ['createdAt'],
  aggregate: { count: true },
} satisfies ContractGroupByArgs;

const payloadProjection = {
  path: ['owner'],
  as: 'text',
} satisfies JsonProjection;

export type SdkPqsApiGuard = {
  manager: CantonManager;
  source: QuerySource;
  contractQuery: typeof contractQuery;
  contractGroup: typeof contractGroup;
  payloadProjection: typeof payloadProjection;
};
