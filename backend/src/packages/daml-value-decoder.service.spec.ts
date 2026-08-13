import { DamlValueDecoderService } from './daml-value-decoder.service';
import type { PackageTypeNode } from '../domain/node.types';

describe('DamlValueDecoderService', () => {
  it('attaches the resolved template schema to decoded contract data', async () => {
    const templateType: PackageTypeNode = {
      kind: 'record',
      label: 'Main:Asset',
      fields: [
        {
          name: 'memo',
          type: {
            kind: 'builtin',
            label: 'Optional',
            arguments: [{ kind: 'builtin', label: 'Text' }],
          },
        },
      ],
    };
    const packageRegistry = {
      resolveTemplate: jest.fn().mockResolvedValue({
        ok: true,
        definition: {
          dataType: {},
          packageRef: {},
        },
      }),
      buildTemplateTypeNode: jest.fn().mockReturnValue(templateType),
    };
    const decoder = new DamlValueDecoderService(packageRegistry as never);
    const decodedState = {
      status: 'decoded' as const,
      value: { kind: 'record' as const, fields: [] },
    };
    jest
      .spyOn(decoder as never, 'decodeRawValue' as never)
      .mockReturnValue(decodedState as never);

    const createArgument = Buffer.from([0x0a, 0x00]);
    const contractPayload = Buffer.concat([
      Buffer.from([0x22, createArgument.length]),
      createArgument,
    ]);
    const contractInstance = Buffer.concat([
      Buffer.from([0x12, contractPayload.length]),
      contractPayload,
    ]);

    await expect(
      decoder.decodeContractInstance({
        packageId: 'package-id',
        templateId: 'Main:Asset',
        contractInstance,
      }),
    ).resolves.toEqual({
      ...decodedState,
      type: templateType,
    });
  });
});
