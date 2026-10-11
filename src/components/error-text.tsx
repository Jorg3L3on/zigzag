import { splitErrorCode } from '@/lib/error-code-display';

/** The message in plain Spanish; its support code on a second, smaller line. */
export const ErrorText = ({ message }: { message: string }) => {
  const { message: text, code } = splitErrorCode(message);
  return (
    <>
      <span>{text}</span>
      {code ? (
        <span className="mt-0.5 block text-sm font-normal opacity-80" data-testid="error-code">
          Código: {code}
        </span>
      ) : null}
    </>
  );
};
