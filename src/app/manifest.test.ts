import manifest from '@/app/manifest';

describe('web app manifest', () => {
  it('opens on dashboard with flexible orientation', () => {
    const result = manifest();

    expect(result.start_url).toBe('/dashboard');
    expect(result.orientation).toBe('any');
    expect(result.display).toBe('standalone');
    expect(result.theme_color).toBe('#2563eb');
    expect(result.scope).toBe('/');
  });
});
