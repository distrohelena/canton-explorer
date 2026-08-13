import { describe, expect, it } from 'vitest';
import { choiceAnchorId, choiceHash, choiceNameFromHash } from './template-anchor';

describe('choice template anchors', () => {
  it('builds a logical hash for a choice name', () => {
    expect(choiceHash('Archive')).toBe('#choice-Archive');
  });

  it('builds a percent-encoded DOM ID for a choice name', () => {
    expect(choiceAnchorId('A Choice/With:Symbols')).toBe(
      'choice-A%20Choice%2FWith%3ASymbols',
    );
  });

  it('extracts a choice name from an already-decoded route hash', () => {
    expect(choiceNameFromHash('#choice-A Choice/With:Symbols')).toBe('A Choice/With:Symbols');
    expect(choiceNameFromHash('#choice-A%2FChoice')).toBe('A%2FChoice');
    expect(choiceNameFromHash('#choice-100%')).toBe('100%');
  });

  it('returns null for empty choice names', () => {
    expect(choiceHash('')).toBeNull();
    expect(choiceAnchorId('')).toBeNull();
    expect(choiceNameFromHash()).toBeNull();
    expect(choiceNameFromHash('#choice-')).toBeNull();
  });

  it('returns null for unexpected hashes', () => {
    expect(choiceNameFromHash('#other-Archive')).toBeNull();
    expect(choiceNameFromHash('choice-Archive')).toBeNull();
  });
});
