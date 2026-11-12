'use client';

import { useEffect } from 'react';

import { splitErrorCode } from '@/lib/error-code-display';
import { logSupportCode } from '@/lib/support-code-log';

/** Plain Spanish. The support code is logged and never shown (ZIG-24). */
export const ErrorText = ({ message }: { message: string }) => {
  const { message: text, code } = splitErrorCode(message);

  useEffect(() => {
    logSupportCode(code);
  }, [code]);

  return <span>{text}</span>;
};
