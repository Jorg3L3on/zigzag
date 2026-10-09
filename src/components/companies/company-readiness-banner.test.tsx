import { fireEvent, render, screen } from '@testing-library/react';
import {
  CompanyReadinessBanner,
  readinessHeadline,
} from '@/components/companies/company-readiness-banner';
import type { CompanyReadinessAssessment } from '@/lib/company-readiness';

const assessment = (
  overrides: Partial<CompanyReadinessAssessment>,
): CompanyReadinessAssessment => ({
  lifecycle: 'ACTIVE',
  profileReady: true,
  productionReady: true,
  missing: [],
  missingLabels: [],
  ...overrides,
});

describe('CompanyReadinessBanner', () => {
  it('summarizes readiness in one line', () => {
    expect(readinessHeadline(assessment({}))).toBe('Lista para operar');
    expect(
      readinessHeadline(
        assessment({ productionReady: false, missingLabels: ['Calle', 'RFC', 'Ciudad', 'CP'] }),
      ),
    ).toBe('Falta: Calle, RFC y 2 más');
    expect(
      readinessHeadline(assessment({ productionReady: false, missingLabels: ['RFC'] })),
    ).toBe('Falta: RFC');
  });

  it('expands to the full readiness detail', () => {
    render(
      <CompanyReadinessBanner
        assessment={assessment({ productionReady: false, missingLabels: ['RFC'] })}
      />,
    );

    const toggle = screen.getByRole('button', { name: /Falta: RFC/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Requisitos pendientes')).not.toBeVisible();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Requisitos pendientes')).toBeVisible();
  });
});
