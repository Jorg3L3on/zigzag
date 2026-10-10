/**
 * Ticket and presupuesto snapshots keep the client's name in a varchar(100)
 * column and print it on every document, so a client name stops at 100
 * characters (ZIG-I12). Names saved before this stay as they are.
 */
export const CLIENT_NAME_MAX_LENGTH = 100;
