const CHOICE_HASH_PREFIX = '#choice-';
const CHOICE_ANCHOR_PREFIX = 'choice-';

export function choiceHash(choiceName: string): string | null {
  if (typeof choiceName !== 'string' || choiceName.length === 0) {
    return null;
  }

  return `${CHOICE_HASH_PREFIX}${choiceName}`;
}

export function choiceAnchorId(choiceName: string): string | null {
  if (typeof choiceName !== 'string' || choiceName.length === 0) {
    return null;
  }

  try {
    return `${CHOICE_ANCHOR_PREFIX}${encodeURIComponent(choiceName)}`;
  } catch {
    return null;
  }
}

export function choiceNameFromHash(hash?: string): string | null {
  if (typeof hash !== 'string' || !hash.startsWith(CHOICE_HASH_PREFIX)) {
    return null;
  }

  const choiceName = hash.slice(CHOICE_HASH_PREFIX.length);
  if (choiceName.length === 0) {
    return null;
  }

  // Vue Router supplies a decoded hash. Preserve the remainder as-is so literal
  // percent characters in choice names remain addressable.
  return choiceName;
}
