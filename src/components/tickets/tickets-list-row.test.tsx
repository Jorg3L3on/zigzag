import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Ticket } from '@/actions/tickets';
import { TicketsListRow } from '@/components/tickets/tickets-list-row';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const ticket: Ticket = {
  id: BigInt(7),
  client_id: 1,
  client_name: 'Cliente Beta',
  client_tel: '5550000000',
  email: null,
  document: null,
  ticket_date: new Date('2026-05-01T12:00:00Z'),
  total: 120,
  paid: 0,
  finished: false,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: null,
  deleted_at: null,
  company_id: 1,
};

const columns: ColumnDef<Ticket>[] = [
  { accessorKey: 'client_name', header: 'Cliente' },
];

const RowHarness = ({
  canWrite = true,
  finished = false,
}: {
  canWrite?: boolean;
  finished?: boolean;
}) => {
  const table = useReactTable({
    data: [{ ...ticket, finished }],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const row = table.getRowModel().rows[0]!;

  return <table><tbody><TicketsListRow row={row} canWrite={canWrite} /></tbody></table>;
};

describe('TicketsListRow', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('navigates to edit on click when the ticket is a draft and user can write', async () => {
    const user = userEvent.setup();
    render(<RowHarness />);

    await user.click(screen.getByRole('row'));
    expect(mockPush).toHaveBeenCalledWith('/tickets/7/edit');
  });

  it('navigates to detail when the ticket is finished', async () => {
    const user = userEvent.setup();
    render(<RowHarness finished />);

    await user.click(screen.getByRole('row'));
    expect(mockPush).toHaveBeenCalledWith('/tickets/7');
  });

  it('navigates on Enter key', async () => {
    render(<RowHarness />);

    screen.getByRole('row').focus();
    await userEvent.keyboard('{Enter}');
    expect(mockPush).toHaveBeenCalledWith('/tickets/7/edit');
  });
});
