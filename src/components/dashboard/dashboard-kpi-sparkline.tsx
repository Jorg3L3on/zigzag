type DashboardKpiSparklineProps = {
  values: number[];
  label: string;
};

export const DashboardKpiSparkline = ({
  values,
  label,
}: DashboardKpiSparklineProps) => {
  const width = 120;
  const height = 32;

  if (values.length === 0) {
    return (
      <div
        className="mt-auto h-8 w-full"
        role="img"
        aria-label={label}
      />
    );
  }

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x =
      values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-auto h-8 w-full text-primary"
      role="img"
      aria-label={label}
    >
      <polygon
        points={`0,${height} ${points.join(' ')} ${width},${height}`}
        className="fill-primary/20"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};
