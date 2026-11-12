import { render, screen } from '@testing-library/react';
import { ErrorText } from '@/components/error-text';

describe('ErrorText', () => {
  it('shows the message and logs the support code without printing it (ZIG-24)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<ErrorText message="Revisa tu internet. Código: GN002" />);
    expect(screen.getByText('Revisa tu internet.')).toBeInTheDocument();
    expect(screen.queryByText(/Código:/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-code')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith('support error code', 'GN002');
    warn.mockRestore();
  });
});
