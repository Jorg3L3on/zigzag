/**
 * Agent connection scopes. `payments` (ZIG-I23-7) is its own opt-in, never
 * implied by `write`. A leaf module so OAuth config, grants and the resolver
 * share it without an import cycle.
 */
export const AGENT_SCOPES = ['read', 'write', 'payments'] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const isAgentScope = (value: string): value is AgentScope =>
  (AGENT_SCOPES as readonly string[]).includes(value);
