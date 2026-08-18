import {
  isActionFailure,
  isActionSuccess,
  type ActionFailure,
  type ActionSuccess,
} from '@/lib/action-result';
import { presentActionError } from '@/lib/network-awareness';

describe('action-result', () => {
  it('narrows success results', () => {
    const result: ActionSuccess<{ id: number }> = {
      success: true,
      data: { id: 1 },
    };
    expect(isActionSuccess(result)).toBe(true);
    expect(isActionFailure(result)).toBe(false);
  });

  it('narrows failure results', () => {
    const result: ActionFailure = {
      success: false,
      error: 'Fallo. Código: TC002',
      errorCode: 'TC002',
      errorTitle: 'Ticket no encontrado',
      errorType: 'validation',
    };
    expect(isActionFailure(result)).toBe(true);
    expect(isActionSuccess(result)).toBe(false);
  });
});

describe('presentActionError', () => {
  it('uses catalog metadata from action failures', () => {
    const content = presentActionError(
      {
        success: false,
        error: 'No se pudo restaurar. Código: CL006',
        errorCode: 'CL006',
        errorTitle: 'Cliente no encontrado',
        errorType: 'validation',
      },
      'No se pudo restaurar el registro',
    );

    expect(content.title).toBe('Cliente no encontrado');
    expect(content.description).toContain('CL006');
  });
});
