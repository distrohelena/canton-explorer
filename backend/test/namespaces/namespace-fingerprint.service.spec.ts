import { describe, expect, it } from '@jest/globals';
import { NamespaceFingerprintService } from '../../src/namespaces/namespace-fingerprint.service';

describe('NamespaceFingerprintService', () => {
  const service = new NamespaceFingerprintService();
  const rawEd25519PublicKey = Uint8Array.from([
    0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0x0c,
    0x0d, 0x0e, 0x0f, 0x10,
    0x11, 0x12, 0x13, 0x14,
    0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c,
    0x1d, 0x1e, 0x1f, 0x20,
  ]);
  const spkiWrappedEd25519PublicKey = Uint8Array.from([
    0x30, 0x2a,
    0x30, 0x05,
    0x06, 0x03, 0x2b, 0x65, 0x70,
    0x03, 0x21, 0x00,
    ...rawEd25519PublicKey,
  ]);

  it('computes a namespace fingerprint from raw hex input', async () => {
    await expect(
      service.computeFromInput({
        publicKey: Buffer.from(rawEd25519PublicKey).toString('hex'),
        encoding: 'hex',
        keyFormat: 'raw',
        keyType: 'ed25519',
      }),
    ).resolves.toBe('1220eefa66cb5656ab5dfa2f43dcbbb374c0599d6c6f2fae41987cca7a29b890a17a');
  });

  it('computes a namespace fingerprint from base64 input', async () => {
    await expect(
      service.computeFromInput({
        publicKey: Buffer.from(rawEd25519PublicKey).toString('base64'),
        encoding: 'base64',
        keyFormat: 'raw',
      }),
    ).resolves.toBe('1220eefa66cb5656ab5dfa2f43dcbbb374c0599d6c6f2fae41987cca7a29b890a17a');
  });

  it('computes a namespace fingerprint from PEM SPKI input', async () => {
    const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(spkiWrappedEd25519PublicKey).toString('base64')}\n-----END PUBLIC KEY-----`;

    await expect(
      service.computeFromInput({
        publicKey: pem,
        encoding: 'pem',
        keyFormat: 'derX509SubjectPublicKeyInfo',
        keyType: 'ed25519',
      }),
    ).resolves.toBe('1220eefa66cb5656ab5dfa2f43dcbbb374c0599d6c6f2fae41987cca7a29b890a17a');
  });
});
