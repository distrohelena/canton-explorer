import { Injectable } from '@nestjs/common';

type HashingSdkModule = {
  CantonHashingClient: new () => {
    computePublicKeyFingerprint(publicKey: Uint8Array, format?: string): string;
  };
  ExternalPartyCryptoKeyFormat: {
    raw: string;
    derX509SubjectPublicKeyInfo: string;
  };
};

export type NamespaceKeyEncoding = 'auto' | 'hex' | 'base64' | 'pem';
export type NamespaceKeyFormat = 'raw' | 'derX509SubjectPublicKeyInfo';
export type NamespaceKeyType = 'auto' | 'ed25519' | 'x25519' | 'secp256k1' | 'other';

@Injectable()
export class NamespaceFingerprintService {
  private sdkModulePromise?: Promise<HashingSdkModule>;

  async computeFromInput(input: {
    publicKey: string;
    encoding?: string;
    keyFormat?: string;
    keyType?: string;
  }): Promise<string> {
    const normalizedPublicKey = input.publicKey.trim();
    if (!normalizedPublicKey) {
      throw new Error('Public key is required');
    }

    const encoding = this.normalizeEncoding(input.encoding);
    const keyFormat = this.normalizeKeyFormat(input.keyFormat);
    this.normalizeKeyType(input.keyType);

    const bytes = this.parsePublicKey(normalizedPublicKey, encoding);
    const sdk = await this.loadSdk();
    const hashing = new sdk.CantonHashingClient();

    const fingerprint = hashing.computePublicKeyFingerprint(
      bytes,
      keyFormat === 'derX509SubjectPublicKeyInfo'
        ? sdk.ExternalPartyCryptoKeyFormat.derX509SubjectPublicKeyInfo
        : sdk.ExternalPartyCryptoKeyFormat.raw,
    );

    if (!fingerprint) {
      throw new Error('Failed to compute namespace fingerprint');
    }

    return fingerprint;
  }

  private async loadSdk(): Promise<HashingSdkModule> {
    if (!this.sdkModulePromise) {
      const sdkModulePath = '@distrohelena/canton-typescript-sdk';
      this.sdkModulePromise = import(sdkModulePath) as Promise<HashingSdkModule>;
    }

    return this.sdkModulePromise;
  }

  private normalizeEncoding(value: string | undefined): NamespaceKeyEncoding {
    switch (value) {
      case 'hex':
      case 'base64':
      case 'pem':
        return value;
      default:
        return 'auto';
    }
  }

  private normalizeKeyFormat(value: string | undefined): NamespaceKeyFormat {
    switch (value) {
      case 'derX509SubjectPublicKeyInfo':
        return value;
      default:
        return 'raw';
    }
  }

  private normalizeKeyType(value: string | undefined): NamespaceKeyType {
    switch (value) {
      case 'ed25519':
      case 'x25519':
      case 'secp256k1':
      case 'other':
        return value;
      default:
        return 'auto';
    }
  }

  private parsePublicKey(value: string, encoding: NamespaceKeyEncoding): Uint8Array {
    switch (encoding) {
      case 'hex':
        return this.parseHex(value);
      case 'base64':
        return this.parseBase64(value);
      case 'pem':
        return this.parsePem(value);
      case 'auto':
      default:
        return this.parseAuto(value);
    }
  }

  private parseAuto(value: string): Uint8Array {
    if (value.includes('-----BEGIN')) {
      return this.parsePem(value);
    }

    if (this.looksLikeHex(value)) {
      return this.parseHex(value);
    }

    return this.parseBase64(value);
  }

  private parseHex(value: string): Uint8Array {
    const normalized = value.replace(/0x/gi, '').replace(/[\s:,-]+/g, '');
    if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length === 0 || normalized.length % 2 !== 0) {
      throw new Error('Invalid hex public key');
    }

    return Uint8Array.from(Buffer.from(normalized, 'hex'));
  }

  private parseBase64(value: string): Uint8Array {
    const normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    if (!/^[A-Za-z0-9+/=]+$/.test(padded)) {
      throw new Error('Invalid base64 public key');
    }

    const buffer = Buffer.from(padded, 'base64');
    if (buffer.length === 0) {
      throw new Error('Invalid base64 public key');
    }

    return Uint8Array.from(buffer);
  }

  private parsePem(value: string): Uint8Array {
    const matches = value.match(/-----BEGIN [^-]+-----([\s\S]+?)-----END [^-]+-----/);
    if (!matches?.[1]) {
      throw new Error('Invalid PEM public key');
    }

    return this.parseBase64(matches[1]);
  }

  private looksLikeHex(value: string): boolean {
    const normalized = value.replace(/0x/gi, '').replace(/[\s:,-]+/g, '');
    return normalized.length > 0 && normalized.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(normalized);
  }
}
