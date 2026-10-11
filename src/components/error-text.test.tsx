import { render, screen } from '@testing-library/react';
import { ErrorText } from '@/components/error-text';

describe('ErrorText', () => {
  it('renders the message and the code on separate lines, code smaller', () => {
    render(<ErrorText message="Revisa tu internet. Código: GN002" />);
    expect(screen.getByText('Revisa tu internet.')).toBeInTheDocument();
    const code = screen.getByTestId('error-code');
    expect(code).toHaveTextContent('Código: GN002');
    expect(code).toHaveClass('block', 'text-sm');
  });
});
