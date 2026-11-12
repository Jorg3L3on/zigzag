import { fireEvent, render, screen, within } from '@testing-library/react';
import { getNextGuide, getWrittenGuide, guideHref } from '@/components/ayuda/guide-registry';
import { GuidePage } from '@/components/ayuda/guide-page';

const PART_2 = [
  ['guardar-un-cliente', 'Guardar un cliente', 'Clientes y servicios'],
  ['armar-mi-lista-de-precios', 'Armar mi lista de precios', 'Clientes y servicios'],
  ['programar-un-mantenimiento', 'Programar un mantenimiento', 'Clientes y servicios'],
  ['instalar-zigzag-en-mi-telefono', 'Instalar ZigZag en mi teléfono', 'Teléfono'],
  ['trabajar-sin-senal', 'Trabajar sin señal', 'Teléfono'],
  ['poner-el-texto-grande', 'Poner el texto grande', 'Teléfono'],
  ['invitar-a-mi-equipo', 'Invitar a mi equipo', 'Equipo'],
  ['elegir-que-ve-cada-quien', 'Elegir qué ve cada quien', 'Equipo'],
] as const;

const renderGuide = (slug: string) =>
  render(<GuidePage guide={getWrittenGuide(slug)!} whatsappHref={null} />);

describe('guide pages, part 2 (ZIG-I40-4)', () => {
  it.each(PART_2)('%s renders its title, numbered steps and the next link', (slug, title, topic) => {
    renderGuide(slug);
    const guide = getWrittenGuide(slug)!;
    const count = guide.content.steps.length;
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(`${topic} · ${count} pasos`)).toBeInTheDocument();
    const steps = screen.getAllByTestId('ayuda-step');
    expect(steps).toHaveLength(count);
    steps.forEach((step, index) => {
      expect(within(step).getByRole('heading', { level: 2 }).textContent).toBe(
        `Paso ${index + 1}: ${guide.content.steps[index].title}`,
      );
    });
    const next = getNextGuide(slug);
    if (next) {
      expect(screen.getByRole('link', { name: `Sigue: ${next.title}` })).toHaveAttribute(
        'href',
        guideHref(next.slug),
      );
    }
  });

  it('Cada chips on the reminder read back the next date', () => {
    renderGuide('programar-un-mantenimiento');
    const group = screen.getAllByRole('group', { name: 'Cada' })[0];
    const preview = screen.getAllByTestId('ayuda-reminder-next')[0];
    expect(within(group).getByRole('button', { name: '6 meses' })).toHaveAttribute('aria-pressed', 'true');
    expect(preview).toHaveTextContent('Próximo recordatorio: miércoles 12 de mayo de 2027');
    fireEvent.click(within(group).getByRole('button', { name: '12 meses' }));
    expect(within(group).getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'true');
    expect(preview).toHaveTextContent('Próximo recordatorio: viernes 12 de noviembre de 2027');
  });

  it('Texto grande switches the sample size', () => {
    renderGuide('poner-el-texto-grande');
    const [toggle] = screen.getAllByRole('switch', { name: 'Texto grande' });
    const [sample] = screen.getAllByTestId('ayuda-text-size-sample');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(sample).toHaveAttribute('data-size', 'normal');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(sample).toHaveAttribute('data-size', 'large');
  });

  it('the permissions grid follows the app rule: Editar ticks Ver, unticking Ver unticks Editar', () => {
    renderGuide('elegir-que-ve-cada-quien');
    const verServicios = screen.getByRole('checkbox', { name: 'Ver Servicios' });
    const editarServicios = screen.getByRole('checkbox', { name: 'Editar Servicios' });
    // Técnico template: sees services, does not edit them.
    expect(verServicios).toBeChecked();
    expect(editarServicios).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Editar Equipo' }));
    expect(screen.getByRole('checkbox', { name: 'Ver Equipo' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ver Equipo' }));
    expect(screen.getByRole('checkbox', { name: 'Editar Equipo' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Administrar Mi empresa' })).not.toBeChecked();
  });
});
