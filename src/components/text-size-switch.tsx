'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  applyTextSize,
  readTextSize,
  saveTextSize,
  type TextSize,
} from '@/lib/text-size';

/** "Texto grande" row in Más (ZIG-I18-15): 18px root font, kept on this device. */
export const TextSizeSwitch = () => {
  const id = React.useId();
  const [size, setSize] = React.useState<TextSize>('normal');

  React.useEffect(() => {
    setSize(readTextSize());
  }, []);

  const onChange = (checked: boolean) => {
    const next: TextSize = checked ? 'large' : 'normal';
    setSize(next);
    applyTextSize(next);
    saveTextSize(next);
  };

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-1 group-data-[collapsible=icon]:hidden">
      <Label htmlFor={id} className="flex-1 py-2 text-base font-medium">
        Texto grande
      </Label>
      <Switch
        id={id}
        checked={size === 'large'}
        onCheckedChange={onChange}
      />
    </div>
  );
};
