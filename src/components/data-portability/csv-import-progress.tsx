'use client';

type CsvImportProgressProps = {
  processedItems: number;
  totalItems: number;
  label?: string;
};

export const CsvImportProgress = ({
  processedItems,
  totalItems,
  label = 'Importando servicios…',
}: CsvImportProgressProps) => {
  const safeTotal = Math.max(totalItems, 1);
  const value = Math.min(100, Math.round((processedItems / safeTotal) * 100));

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {processedItems}/{totalItems}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};
