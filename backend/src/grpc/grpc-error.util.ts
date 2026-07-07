export interface GrpcErrorDescription {
  message: string;
  code: string | null;
  details: string | null;
  tid: string | null;
}

export function describeGrpcError(error: unknown): GrpcErrorDescription {
  const message = error instanceof Error ? error.message : String(error);
  const candidate = error as {
    code?: unknown;
    details?: unknown;
  } | null;
  const details =
    typeof candidate?.details === 'string' && candidate.details.length > 0
      ? candidate.details
      : message || null;
  const tidSource = details ?? message;

  return {
    message,
    code: normalizeCode(candidate?.code),
    details,
    tid: extractTid(tidSource),
  };
}

function normalizeCode(code: unknown): string | null {
  if (typeof code === 'number' || typeof code === 'string') {
    return String(code);
  }

  return null;
}

function extractTid(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\btid\s+([A-Za-z0-9-]+)/i);
  return match?.[1] ?? null;
}
