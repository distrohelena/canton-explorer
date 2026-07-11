import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import DebuggerScopePanel from './DebuggerScopePanel.vue';

describe('DebuggerScopePanel', () => {
  it('renders grouped scope variables by frame', () => {
    render(DebuggerScopePanel, {
      props: {
        scopes: [
          {
            frameId: 'frame-1',
            name: 'Archive',
            variables: [
              {
                name: 'owner',
                kind: 'text',
                value: 'Alice',
              },
            ],
          },
        ],
      },
    });

    expect(screen.getByText('In-Scope Variables')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
