import { actorDisplayName } from '@/lib/audit-actor-display';
import { resolveActorNames } from '@/lib/audit-actor-names';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
  },
}));

import { db } from '@/lib/db';

describe('audit actor names', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats actor labels preferring the display name', () => {
    expect(actorDisplayName('10', 'Ana López')).toBe('Ana López');
    expect(actorDisplayName('10', '  ')).toBe('10');
    expect(actorDisplayName('10', null)).toBe('10');
    expect(actorDisplayName(null, null)).toBe('—');
  });

  it('resolves unique actor ids to user names', async () => {
    const where = jest.fn().mockResolvedValue([
      { id: 2n, name: 'Carlos' },
      { id: 10n, name: 'Ana' },
    ]);
    const from = jest.fn(() => ({ where }));
    (db.select as jest.Mock).mockReturnValue({ from });

    const names = await resolveActorNames(['2', '10', '2', null, '']);

    expect(names.get('2')).toBe('Carlos');
    expect(names.get('10')).toBe('Ana');
    expect(from).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it('returns an empty map when there are no actor ids', async () => {
    const names = await resolveActorNames([null, undefined, '']);
    expect(names.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });
});
