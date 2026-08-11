import {
  formatOfflineSnapshotBanner,
  getOfflineSnapshotKey,
} from '@/lib/offline-snapshot';

describe('offline snapshots', () => {
  it('uses versioned company-scoped keys', () => {
    expect(getOfflineSnapshotKey('tickets', 7)).toBe('tickets:v1:company:7');
    expect(getOfflineSnapshotKey('clients', null)).toBe('clients:v1:company:none');
  });

  it('formats the offline banner with the required copy', () => {
    expect(
      formatOfflineSnapshotBanner('not-a-date'),
    ).toBe('Sin conexión — datos de una copia anterior');
  });
});
