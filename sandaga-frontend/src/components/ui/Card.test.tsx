import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card><div>Child content</div></Card>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies the card class name', () => {
    const { container } = render(<Card />);
    expect(container.firstChild).toHaveClass('card');
  });

  it('applies additional class names', () => {
    const { container } = render(<Card className="extra-class" />);
    expect(container.firstChild).toHaveClass('card', 'extra-class');
  });
});
