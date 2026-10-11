import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** ZIG-I18-1: the collect-payment flow uses notebook words, never banking ones. */
describe('collect-payment copy', () => {
  const files = [
    'ticket-list-collect-payment-dialog.tsx',
    'ticket-row-actions.tsx',
    'detail/ticket-detail-quick-actions.tsx',
    'detail/ticket-detail-primary-actions.tsx',
  ];

  it.each(files)('%s has no abono/abonar/saldar/Registrar pago strings', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf8');
    const strings = source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    expect(strings).not.toMatch(/abon(o|ar)|saldar|Registrar pago/i);
  });
});
