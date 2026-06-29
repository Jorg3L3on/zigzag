import { isJobType, JOB_HANDLERS } from '@/lib/jobs/handlers';

describe('job handlers registry', () => {
  it('registers the company_export handler', () => {
    expect(typeof JOB_HANDLERS.company_export).toBe('function');
  });

  it('isJobType narrows known/unknown types', () => {
    expect(isJobType('company_export')).toBe(true);
    expect(isJobType('does_not_exist')).toBe(false);
  });
});
