import { render, screen, fireEvent } from '@testing-library/react';
import { FormStepper } from './FormStepper';

const steps = [
  { id: '1', label: 'Step 1' },
  { id: '2', label: 'Step 2' },
  { id: '3', label: 'Step 3' },
];

const mockOnStepChange = vi.fn();

describe('FormStepper', () => {
  it('renders the steps and marks the current step as active', () => {
    render(<FormStepper steps={steps} currentStep={1} onStepChange={mockOnStepChange} />);

    expect(screen.getByText('Step 1').closest('li')).toHaveClass('form-stepper__item--completed');
    expect(screen.getByText('Step 2').closest('li')).toHaveClass('form-stepper__item--active');
    expect(screen.getByText('Step 3').closest('li')).not.toHaveClass('form-stepper__item--active');
    expect(screen.getByText('Step 3').closest('li')).not.toHaveClass('form-stepper__item--completed');
  });

  it('calls onStepChange when a step is clicked', () => {
    render(<FormStepper steps={steps} currentStep={1} onStepChange={mockOnStepChange} />);

    fireEvent.click(screen.getByText('Step 1'));
    expect(mockOnStepChange).toHaveBeenCalledWith(0);
  });

  it('disables future steps', () => {
    render(<FormStepper steps={steps} currentStep={0} onStepChange={mockOnStepChange} />);

    expect(screen.getByText('Step 2').closest('button')).toBeDisabled();
    expect(screen.getByText('Step 3').closest('button')).toBeDisabled();
  });
});
