export function encodeDamlLfArchive(packageId: string, archivePayload: Uint8Array): Buffer {
  const hashBytes = Buffer.from(packageId, 'utf8');
  const payloadLength = encodeVarint(archivePayload.length);
  const hashLength = encodeVarint(hashBytes.length);
  const totalLength =
    1 + payloadLength.length + archivePayload.length + 1 + hashLength.length + hashBytes.length;
  const archive = Buffer.allocUnsafe(totalLength);
  let offset = 0;

  archive[offset++] = 0x1a;
  payloadLength.copy(archive, offset);
  offset += payloadLength.length;
  Buffer.from(archivePayload).copy(archive, offset);
  offset += archivePayload.length;
  archive[offset++] = 0x22;
  hashLength.copy(archive, offset);
  offset += hashLength.length;
  hashBytes.copy(archive, offset);

  return archive;
}

export function extractDamlLfArchivePayloadOrThrow(archiveBytes: Uint8Array): Uint8Array {
  const bytes = Buffer.from(archiveBytes);
  let offset = 0;

  while (offset < bytes.length) {
    const tag = decodeVarint(bytes, offset);
    offset = tag.nextOffset;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0x07;

    if (fieldNumber === 3) {
      if (wireType !== 2) {
        throw new Error('daml lf archive payload field does not use length-delimited encoding');
      }

      const length = decodeVarint(bytes, offset);
      const start = length.nextOffset;
      const end = start + length.value;
      if (end > bytes.length) {
        throw new Error('daml lf archive payload field exceeds archive bounds');
      }

      return bytes.subarray(start, end);
    }

    offset = skipWireValue(bytes, offset, wireType);
  }

  throw new Error('daml lf archive does not contain a payload field');
}

function encodeVarint(value: number): Buffer {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid protobuf varint value: ${value}`);
  }

  const encoded: number[] = [];
  let remaining = value;

  while (remaining >= 0x80) {
    encoded.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }

  encoded.push(remaining);
  return Buffer.from(encoded);
}

function decodeVarint(
  bytes: Uint8Array,
  startOffset: number,
): {
  value: number;
  nextOffset: number;
} {
  let result = 0;
  let shift = 0;
  let offset = startOffset;

  while (offset < bytes.length) {
    const byte = bytes[offset];
    result |= (byte & 0x7f) << shift;
    offset += 1;

    if ((byte & 0x80) === 0) {
      return {
        value: result,
        nextOffset: offset,
      };
    }

    shift += 7;
    if (shift > 35) {
      throw new Error('protobuf varint is too large');
    }
  }

  throw new Error('unexpected end of input while decoding protobuf varint');
}

function skipWireValue(bytes: Uint8Array, startOffset: number, wireType: number): number {
  switch (wireType) {
    case 0:
      return decodeVarint(bytes, startOffset).nextOffset;
    case 1:
      return ensureBounds(bytes, startOffset, 8);
    case 2: {
      const length = decodeVarint(bytes, startOffset);
      return ensureBounds(bytes, length.nextOffset, length.value);
    }
    case 5:
      return ensureBounds(bytes, startOffset, 4);
    default:
      throw new Error(`unsupported protobuf wire type: ${wireType}`);
  }
}

function ensureBounds(bytes: Uint8Array, startOffset: number, length: number): number {
  const endOffset = startOffset + length;
  if (endOffset > bytes.length) {
    throw new Error('protobuf field exceeds archive bounds');
  }

  return endOffset;
}
