import { expect, it } from 'vitest';
import { resolveDamlFunctionVariableRanges } from './daml-hover-resolution';

it('resolves a current function parameter and every non-field reference', () => {
  const source = [
    'module Example where',
    '',
    'executeBaseDepositLike vaultIdentity vaultParty assetInstrumentId shareTokenCid virtualAssets virtualShares name symbol args = do',
    '  validateBaseOperationPositiveAmount args.operation args.amount',
    '  pure ()',
    '',
    'anotherFunction args = pure args',
  ].join('\n');

  expect(resolveDamlFunctionVariableRanges(source, 4, ['args'])).toEqual([
    {
      name: 'args',
      range: { startLine: 3, startColumn: 121, endLine: 3, endColumn: 125 },
    },
    {
      name: 'args',
      range: { startLine: 4, startColumn: 39, endLine: 4, endColumn: 43 },
    },
    {
      name: 'args',
      range: { startLine: 4, startColumn: 54, endLine: 4, endColumn: 58 },
    },
  ]);
});

it('omits a parameter after a nested binding could shadow it', () => {
  const source = [
    'execute args = do',
    '  validate args.operation',
    '  let args = "shadowed"',
    '  validate args.operation',
  ].join('\n');

  expect(resolveDamlFunctionVariableRanges(source, 2, ['args'])).toEqual([
    {
      name: 'args',
      range: { startLine: 1, startColumn: 9, endLine: 1, endColumn: 13 },
    },
    {
      name: 'args',
      range: { startLine: 2, startColumn: 12, endLine: 2, endColumn: 16 },
    },
  ]);
});
