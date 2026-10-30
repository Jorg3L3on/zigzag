'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bankDiffersFromClabe, bankFromClabe } from '@/lib/clabe-banks';
import { isValidClabe } from '@/lib/company-payment-info';

/**
 * Under the CLABE field (ZIG-36): the bank its first three digits belong to,
 * "Usar <banco>" when Banco is empty, and an amber note when Banco looks
 * different. A hint only; saving is never blocked.
 */
export function ClabeBankHint({
  clabe,
  bank,
  onUseBank,
}: {
  clabe: string | null | undefined;
  bank: string | null | undefined;
  onUseBank: (name: string) => void;
}) {
  const clabeBank = bankFromClabe(clabe);
  if (!clabeBank) return null;

  const bankIsEmpty = !(bank ?? '').trim();

  return (
    <div className="space-y-2" data-testid="clabe-bank-hint">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {isValidClabe(clabe) ? (
          <span className="inline-flex items-center gap-1">
            <Check aria-hidden className="size-4 text-blue-600 dark:text-blue-400" />
            {clabeBank}
          </span>
        ) : (
          <span>Banco: {clabeBank}</span>
        )}
        {bankIsEmpty ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUseBank(clabeBank)}
            data-testid="clabe-bank-use"
          >
            Usar {clabeBank}
          </Button>
        ) : null}
      </div>
      {!bankIsEmpty && bankDiffersFromClabe(bank, clabe) ? (
        <p
          role="note"
          data-testid="clabe-bank-mismatch"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Esta CLABE parece de {clabeBank}. Revisa el banco o la CLABE.
        </p>
      ) : null}
    </div>
  );
}
