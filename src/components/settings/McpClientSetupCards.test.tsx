import { fireEvent, render, screen, within } from '@testing-library/react';
import { McpClientSetupCards } from '@/components/settings/McpClientSetupCards';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const URL = 'https://zigzag.example/api/mcp';
const noWhoami = { chatgpt: null, grok: null, claude: null, cursor: null };

describe('McpClientSetupCards', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });

  it('renders ChatGPT, Grok, Claude and Cursor with steps and a copy button each', () => {
    render(<McpClientSetupCards mcpUrl={URL} whoami={noWhoami} />);

    for (const id of ['chatgpt', 'grok', 'claude', 'cursor']) {
      const card = screen.getByTestId(`mcp-client-card-${id}`);
      expect(within(card).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
      expect(within(card).getByRole('button')).toBeInTheDocument();
    }
    expect(screen.getByTestId('cursor-mcp-json')).toHaveTextContent('Bearer zigzag_…');
    expect(screen.getByTestId('mcp-client-probar-claude')).toHaveTextContent(
      'Aún no hay un whoami desde Claude',
    );
  });

  it('copies the connector URL', () => {
    render(<McpClientSetupCards mcpUrl={URL} whoami={noWhoami} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar URL para ChatGPT' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(URL);
  });

  it('shows the last whoami per client', () => {
    render(
      <McpClientSetupCards
        mcpUrl={URL}
        whoami={{
          ...noWhoami,
          chatgpt: { at: new Date(Date.now() - 5 * 60_000).toISOString(), connection: 'ChatGPT' },
        }}
      />,
    );
    expect(screen.getByTestId('mcp-client-probar-chatgpt')).toHaveTextContent(
      /último whoami hace 5 minutos · ChatGPT/,
    );
  });
});
