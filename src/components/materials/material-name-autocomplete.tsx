'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { searchMaterials } from '@/actions/services';
import { formatServiceCurrency } from '@/components/tickets/ticket-services-utils';
import { Input } from '@/components/ui/input';
import type { MaterialOption } from '@/lib/service-materials';
import { MATERIAL_NAME_MAX_LENGTH } from '@/lib/ticket-service-line-schema';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 300;

type MaterialNameAutocompleteProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  /** A catalog suggestion was chosen. */
  onPick: (option: MaterialOption) => void;
  companyId?: number | null;
  placeholder?: string;
  autoFocus?: boolean;
  /** Shown under the input when a search for the typed text finds nothing. */
  emptyText?: string;
  /** Shown instead when nothing is typed and the whole catalog is empty. */
  emptyCatalogText?: string;
  'aria-describedby'?: string;
};

/**
 * Name input with suggestions from the company Material catalog (ZIG-I10).
 * The input stays mounted while results reload (debounced 300 ms); the list
 * renders inline under it so it works inside bottom sheets. Combobox pattern:
 * arrows move, Enter picks, Escape closes.
 */
export const MaterialNameAutocomplete = ({
  id,
  value,
  onValueChange,
  onPick,
  companyId,
  placeholder = 'Ej. Gas R410A',
  autoFocus = false,
  emptyText,
  emptyCatalogText,
  'aria-describedby': describedBy,
}: MaterialNameAutocompleteProps) => {
  const listId = useId();
  const [options, setOptions] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const request = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchMaterials(value, companyId ?? null)
        .then((result) => {
          if (request !== requestRef.current) return;
          setOptions(result.success && result.data ? result.data : []);
          setActive(-1);
          setSearched(true);
        })
        .catch(() => {
          if (request === requestRef.current) setOptions([]);
        })
        .finally(() => {
          if (request === requestRef.current) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, companyId, open]);

  const pick = (option: MaterialOption) => {
    onPick(option);
    setOpen(false);
    setActive(-1);
  };

  const showList = open && options.length > 0;
  // The hint stays put on blur: hiding it shrank the sheet and made the first
  // tap on Nuevo miss (ZIG-I12).
  const emptyHint =
    searched && !loading && options.length === 0
      ? value.trim() === ''
        ? (emptyCatalogText ?? null)
        : (emptyText ?? null)
      : null;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            active >= 0 && options[active] ? `${listId}-${active}` : undefined
          }
          aria-describedby={describedBy}
          value={value}
          maxLength={MATERIAL_NAME_MAX_LENGTH}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((current) => Math.min(current + 1, options.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter' && open && active >= 0 && options[active]) {
              event.preventDefault();
              pick(options[active]);
            } else if (event.key === 'Escape' && open) {
              event.stopPropagation();
              setOpen(false);
            }
          }}
          className="h-12 rounded-xl pr-10 text-base md:h-10 md:text-sm"
        />
        {loading && open ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Materiales de tu catálogo"
        hidden={!showList}
        className="max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-sm"
      >
        {options.map((option, index) => (
          <li
            key={option.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // Keep focus in the input so blur does not close the list first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(option)}
            className={cn(
              'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
              index === active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )}
          >
            <span className="min-w-0 truncate font-medium">{option.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatServiceCurrency(option.price)}
              {option.unit ? ` / ${option.unit}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {emptyText || emptyCatalogText ? (
        <p
          className="min-h-4 text-xs leading-4 text-muted-foreground"
          aria-live="polite"
          data-testid="material-autocomplete-empty"
        >
          {emptyHint}
        </p>
      ) : null}
    </div>
  );
};
