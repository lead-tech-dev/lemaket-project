import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="No results" description="Try a different search" />);
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try a different search')).toBeInTheDocument();
  });

  it('renders an icon', () => {
    render(<EmptyState title="No results" icon={<span>Icon</span>} />);
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });

  it('renders an action button', () => {
    render(<EmptyState title="No results" action={<button>Click me</button>} />);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<EmptyState title="No results"><div>Child content</div></EmptyState>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });
});
