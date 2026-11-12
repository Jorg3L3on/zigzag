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

  it('never lists the status as the owner\'s to-do; says who changes it (ZIG-I32)', () => {
    const setup = assessment({
      lifecycle: 'SETUP',
      productionReady: false,
      missing: ['lifecycle.active'],
      missingLabels: ['Estado operativo (Activa)'],
    });
    expect(readinessHeadline(setup)).toBe('Lista; la activa el equipo de ZigZag');
    expect(
      readinessHeadline({
        ...setup,
        missing: ['profile.phone', 'lifecycle.active'],
        missingLabels: ['Teléfono', 'Estado operativo (Activa)'],
      }),
    ).toBe('Falta: Teléfono');

    render(<CompanyReadinessBanner assessment={setup} />);
    fireEvent.click(screen.getByRole('button', { name: /la activa el equipo de ZigZag/ }));
    expect(screen.queryByText('Estado operativo (Activa)')).toBeNull();
    expect(screen.getByText(/Lo cambia el equipo de ZigZag\./)).toBeVisible();
  });
});
