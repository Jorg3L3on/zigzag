import { collapseActivity } from '@/lib/collapse-activity';

type Entry = { id: number; title: string; actorName: string | null };

const titleOf = (entry: Entry) => entry.title;

describe('collapseActivity (desktop Actividad cards)', () => {
  it('folds consecutive events that read the same and keeps the latest one', () => {
    const items = collapseActivity<Entry>(
      [
        { id: 5, title: 'Servicios editados', actorName: 'Ana' },
        { id: 4, title: 'Servicios editados', actorName: 'Ana' },
        { id: 3, title: 'Cobro registrado $100.00', actorName: 'Ana' },
        { id: 2, title: 'Servicios editados', actorName: 'Ana' },
        { id: 1, title: 'Ticket creado', actorName: 'Ana' },
      ],
      titleOf,
    );
    expect(items.map((item) => [item.title, item.count, item.entry.id])).toEqual([
      ['Servicios editados', 2, 5],
      ['Cobro registrado $100.00', 1, 3],
      ['Servicios editados', 1, 2],
      ['Ticket creado', 1, 1],
    ]);
  });

  it('keeps different amounts and different people apart', () => {
    const items = collapseActivity<Entry>(
      [
        { id: 4, title: 'Servicios editados', actorName: 'Ana' },
        { id: 3, title: 'Servicios editados', actorName: 'Luis' },
        { id: 2, title: 'Cobro registrado $100.00', actorName: 'Luis' },
        { id: 1, title: 'Cobro registrado $200.00', actorName: 'Luis' },
      ],
      titleOf,
    );
    expect(items.map((item) => item.count)).toEqual([1, 1, 1, 1]);
  });
});
