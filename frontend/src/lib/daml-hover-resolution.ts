export interface DamlHoverRange {
  name: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

interface FunctionDeclaration {
  startOffset: number;
  startLine: number;
  bodyEndOffset: number;
  bodyEndLine: number;
  parameterNames: Set<string>;
}

const identifierStart = /[A-Za-z_$]/u;
const identifierPart = /[A-Za-z0-9_'$]/u;

function findFunctionDeclarations(content: string): FunctionDeclaration[] {
  const lines = content.split(/\r?\n/u);
  const starts = lines.reduce<number[]>((offsets, _line, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + lines[index - 1].length + 1);
    return offsets;
  }, []);

  const declarations = lines.flatMap((line, index) => {
    const match = /^([a-z_][A-Za-z0-9_']*)(?:\s+(.+?))?\s*=/u.exec(line);

    if (!match) {
      return [];
    }

    const parameters = match[2] ?? '';
    const parameterNames = new Set(
      [...parameters.matchAll(/[A-Za-z_$][A-Za-z0-9_'$]*/gu)].map((parameter) => parameter[0]),
    );

    return [{
      startOffset: starts[index],
      startLine: index + 1,
      bodyEndOffset: content.length,
      bodyEndLine: lines.length,
      parameterNames,
    }];
  });

  return declarations.map((declaration, index) => {
    const nextDeclaration = declarations[index + 1];

    return nextDeclaration
      ? {
          ...declaration,
          bodyEndOffset: nextDeclaration.startOffset,
          bodyEndLine: nextDeclaration.startLine - 1,
        }
      : declaration;
  });
}

function toRange(content: string, startOffset: number, name: string): DamlHoverRange['range'] {
  const before = content.slice(0, startOffset);
  const lastLineBreak = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  const startLine = before.split(/\r?\n/u).length;
  const startColumn = startOffset - lastLineBreak;

  return {
    startLine,
    startColumn,
    endLine: startLine,
    endColumn: startColumn + name.length,
  };
}

function findIdentifierRanges(
  content: string,
  startOffset: number,
  endOffset: number,
  allowedNames: ReadonlySet<string>,
) {
  const ranges: DamlHoverRange[] = [];
  let index = startOffset;
  let blockCommentDepth = 0;

  while (index < endOffset) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (blockCommentDepth > 0) {
      if (character === '{' && nextCharacter === '-') {
        blockCommentDepth += 1;
        index += 2;
      } else if (character === '-' && nextCharacter === '}') {
        blockCommentDepth -= 1;
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }

    if (character === '-' && nextCharacter === '-') {
      const nextLineBreak = content.indexOf('\n', index + 2);
      index = nextLineBreak === -1 ? endOffset : nextLineBreak + 1;
      continue;
    }

    if (character === '{' && nextCharacter === '-') {
      blockCommentDepth = 1;
      index += 2;
      continue;
    }

    if (character === '"') {
      index += 1;
      while (index < endOffset && content[index] !== '"') {
        index += content[index] === '\\' ? 2 : 1;
      }
      index += 1;
      continue;
    }

    if (!identifierStart.test(character)) {
      index += 1;
      continue;
    }

    const identifierStartOffset = index;
    index += 1;
    while (index < endOffset && identifierPart.test(content[index])) {
      index += 1;
    }

    const name = content.slice(identifierStartOffset, index);
    const isField = identifierStartOffset > startOffset && content[identifierStartOffset - 1] === '.';

    if (!isField && allowedNames.has(name)) {
      ranges.push({ name, range: toRange(content, identifierStartOffset, name) });
    }
  }

  return ranges;
}

function findFirstUncertainScopeOffset(
  content: string,
  startOffset: number,
  endOffset: number,
  currentVariableNames: ReadonlySet<string>,
) {
  let lineStart = startOffset;

  while (lineStart < endOffset) {
    const lineEnd = content.indexOf('\n', lineStart);
    const boundedLineEnd = lineEnd === -1 ? endOffset : Math.min(lineEnd, endOffset);
    const line = content.slice(lineStart, boundedLineEnd);
    const letBinding = /^\s*let\s+([a-z_][A-Za-z0-9_']*)\b/u.exec(line);

    if (letBinding) {
      if (currentVariableNames.has(letBinding[1])) {
        return lineStart;
      }
    } else if (/^\s*let\b/u.test(line) || /^\s*(?:\\|case\b|[a-z_][A-Za-z0-9_']*\s*->)/u.test(line)) {
      return lineStart;
    }

    lineStart = boundedLineEnd + 1;
  }

  return endOffset;
}

export function resolveDamlFunctionVariableRanges(
  content: string,
  anchorLine: number,
  variableNames: Iterable<string>,
): DamlHoverRange[] {
  const declaration = findFunctionDeclarations(content).find(
    (candidate) => anchorLine >= candidate.startLine && anchorLine <= candidate.bodyEndLine,
  );

  if (!declaration) {
    return [];
  }

  const currentVariableNames = new Set(
    [...variableNames].filter((name) => declaration.parameterNames.has(name)),
  );
  const safeBodyEndOffset = findFirstUncertainScopeOffset(
    content,
    declaration.startOffset,
    declaration.bodyEndOffset,
    currentVariableNames,
  );

  return findIdentifierRanges(
    content,
    declaration.startOffset,
    safeBodyEndOffset,
    currentVariableNames,
  );
}
