export type CsvImportCounts = {
  inserted: number;
  skipped: number;
  failed: number;
};

export type CsvImportReportRow = {
  rowNumber: number;
  status: 'skip' | 'error';
  reason: string;
  name?: string;
};

export type CsvImportCommitSummary = CsvImportCounts & {
  errors: string[];
  reportRows: CsvImportReportRow[];
  stopped?: boolean;
  stopReason?: string;
};

export const emptyCsvImportCommitSummary = (): CsvImportCommitSummary => ({
  inserted: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  reportRows: [],
});

export const mergeCsvImportCommitSummaries = (
  parts: CsvImportCommitSummary[],
): CsvImportCommitSummary =>
  parts.reduce<CsvImportCommitSummary>(
    (acc, part) => ({
      inserted: acc.inserted + part.inserted,
      skipped: acc.skipped + part.skipped,
      failed: acc.failed + part.failed,
      errors: [...acc.errors, ...part.errors],
      reportRows: [...acc.reportRows, ...part.reportRows],
      stopped: acc.stopped || part.stopped,
      stopReason: acc.stopReason ?? part.stopReason,
    }),
    emptyCsvImportCommitSummary(),
  );
