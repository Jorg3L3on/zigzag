import {
  formatOfflineSnapshotBanner,
  getOfflineSnapshotKey,
  isCurrentOfflineSnapshot,
  OFFLINE_SNAPSHOT_SCHEMA_VERSION,
} from '@/lib/offline-snapshot';

describe('offline snapshots', () => {
  it('uses versioned company-scoped keys', () => {
    expect(getOfflineSnapshotKey('tickets', 7)).toBe('tickets:v2:company:7');
    expect(getOfflineSnapshotKey('clients', null)).toBe('clients:v2:company:none');
    expect(getOfflineSnapshotKey('composer-services', 7)).toBe(
      'composer-services:v2:company:7',
    );
    expect(getOfflineSnapshotKey('composer-clients', 8)).not.toBe(
      getOfflineSnapshotKey('composer-clients', 7),
    );
  });

  it('discards a snapshot written by another schema version', () => {
    expect(isCurrentOfflineSnapshot({ schemaVersion: OFFLINE_SNAPSHOT_SCHEMA_VERSION })).toBe(
      true,
    );
    expect(isCurrentOfflineSnapshot({ schemaVersion: 1 })).toBe(false);
    expect(isCurrentOfflineSnapshot(null)).toBe(false);
  });

  it('formats the offline banner with the required copy', () => {
    expect(
      formatOfflineSnapshotBanner('not-a-date'),
    ).toBe('Sin conexión — datos de una copia anterior');
  });
});
