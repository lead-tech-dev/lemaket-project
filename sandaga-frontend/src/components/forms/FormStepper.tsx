type FormStepperStep = {
  id: string
  label: string
  description?: string
}

type FormStepperProps = {
  steps: FormStepperStep[]
  currentStep: number
  onStepChange?: (index: number) => void
}

export function FormStepper({ steps, currentStep, onStepChange }: FormStepperProps) {
  return (
    <ol className="form-stepper">
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = index < currentStep
        const className = [
          'form-stepper__item',
          isActive ? 'form-stepper__item--active' : '',
          isCompleted ? 'form-stepper__item--completed' : ''
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <li key={step.id} className={className}>
            <button
              type="button"
              className="form-stepper__button"
              onClick={() => onStepChange?.(index)}
              disabled={index > currentStep}
            >
              <span className="form-stepper__index">{index + 1}</span>
              <span className="form-stepper__meta">
                <span className="form-stepper__label">{step.label}</span>
                {step.description ? (
                  <small className="form-stepper__description">{step.description}</small>
                ) : null}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
