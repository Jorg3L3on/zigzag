import { Button } from '@/components/ui/button';

export type ButtonFilterOption<T extends string> = {
  value: T;
  label: string;
};

type ButtonFilterGroupProps<T extends string> = {
  label: string;
  options: Array<ButtonFilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
  layout: 'desktop' | 'sheet';
  getOptionAriaLabel?: (label: string, optionLabel: string) => string;
};

export const ButtonFilterGroup = <T extends string>({
  label,
  options,
  value,
  onChange,
  layout,
  getOptionAriaLabel = (_groupLabel, optionLabel) => optionLabel,
}: ButtonFilterGroupProps<T>) => (
  <div className={layout === 'sheet' ? 'space-y-2' : 'flex flex-col gap-2'}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? 'default' : 'outline'}
          className="min-h-11 rounded-xl"
          onClick={() => onChange(option.value)}
          aria-label={getOptionAriaLabel(label, option.label)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </div>
);
