import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a skeleton element with default styles', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild;
    expect(skeleton).toHaveClass('skeleton', 'skeleton--text');
    expect(skeleton).toHaveStyle({ width: '100%', height: '1em' });
  });

  it('renders a circular skeleton', () => {
    const { container } = render(<Skeleton variant="circle" />);
    const skeleton = container.firstChild;
    expect(skeleton).toHaveClass('skeleton--circle');
    expect(skeleton).toHaveStyle({ borderRadius: '50%' });
  });

  it('renders a rectangular skeleton', () => {
    const { container } = render(<Skeleton variant="rect" width={100} height={50} />);
    const skeleton = container.firstChild;
    expect(skeleton).toHaveClass('skeleton--rect');
    expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
  });

  it('applies rounded style', () => {
    const { container } = render(<Skeleton rounded />);
    const skeleton = container.firstChild;
    expect(skeleton).toHaveStyle({ borderRadius: '999px' });
  });
});
