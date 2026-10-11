import { splitErrorCode } from '@/lib/error-code-display';

describe('splitErrorCode', () => {
  it('moves the trailing code out of the sentence', () => {
    expect(
      splitErrorCode('Correo o contraseña incorrectos. Código: AU001'),
    ).toEqual({ message: 'Correo o contraseña incorrectos.', code: 'AU001' });
  });

  it('leaves messages without a code alone', () => {
    expect(splitErrorCode('Todo bien')).toEqual({ message: 'Todo bien', code: null });
  });
});
