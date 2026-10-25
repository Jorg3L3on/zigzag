import { Button } from '@/components/ui/button';
import { FILTER_SELECTED_CLASS } from '@/components/list-filter/filter-styles';
import { cn } from '@/lib/utils';

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
    <p className="text-caption font-medium text-muted-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const pressed = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            className={cn('min-h-11 rounded-xl', pressed && FILTER_SELECTED_CLASS)}
            onClick={() => onChange(option.value)}
            aria-label={getOptionAriaLabel(label, option.label)}
            aria-pressed={pressed}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  </div>
);
