import { render, screen } from '@testing-library/react';
import OAuthConsentForm from '@/components/oauth/OAuthConsentForm';

const consentParams = {
  client_id: 'client-1',
  redirect_uri: 'https://evil.example.net/cb',
  code_challenge: 'x'.repeat(43),
  code_challenge_method: 'S256' as const,
};

const renderForm = (props: { verified: boolean; requestedScope?: string }) =>
  render(
    <OAuthConsentForm
      clientName="ChatGPT"
      clientUri={null}
      redirectHost="evil.example.net"
      verified={props.verified}
      requestedScope={props.requestedScope ?? 'read write'}
      consentParams={consentParams}
      companies={[{ id: 4, name: 'ClimaTotal Demo' }]}
    />,
  );

describe('OAuthConsentForm trust cues', () => {
  it('flags an unverified client and shows where the code goes', () => {
    renderForm({ verified: false });

    expect(screen.getByTestId('oauth-client-unverified')).toHaveTextContent(
      'Cliente no verificado',
    );
    expect(screen.queryByTestId('oauth-client-verified')).toBeNull();
    expect(screen.getByTestId('oauth-redirect-host')).toHaveTextContent('evil.example.net');
  });

  it('shows the Verificado badge only for trusted CIMD clients', () => {
    renderForm({ verified: true });
    expect(screen.getByTestId('oauth-client-verified')).toHaveTextContent('Verificado');
    expect(screen.queryByTestId('oauth-client-unverified')).toBeNull();
  });

  it('starts with write unchecked even when the client asks for it', () => {
    renderForm({ verified: true, requestedScope: 'read write' });
    expect(screen.getByRole('checkbox', { name: /Permitir escritura/ })).not.toBeChecked();
    expect(
      screen.getByText(/Si cambias tu contraseña o se desactiva tu cuenta/),
    ).toBeInTheDocument();
  });
});
