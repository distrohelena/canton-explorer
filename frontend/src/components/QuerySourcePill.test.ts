import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import QuerySourcePill from './QuerySourcePill.vue';

describe('QuerySourcePill', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a PQS label with source hover text', () => {
    render(QuerySourcePill, {
      props: {
        source: 'pqs',
      },
    });

    const pill = screen.getByText('PQS');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('title', 'Data sourced from PQS');
  });

  it('renders a gRPC fallback label with hover text', () => {
    render(QuerySourcePill, {
      props: {
        source: 'grpc',
        fallback: true,
      },
    });

    const pill = screen.getByText('gRPC');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('title', 'fallback mode');
  });

  it('renders a gRPC label with source hover text when not in fallback mode', () => {
    render(QuerySourcePill, {
      props: {
        source: 'grpc',
      },
    });

    const pill = screen.getByText('gRPC');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('title', 'Data sourced from gRPC');
  });
});
