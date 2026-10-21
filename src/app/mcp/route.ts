// ChatGPT and other clients may use origin + /mcp (RFC 9728 path-aware discovery).
// Same handler as /api/mcp; tokens minted for either resource normalise to /api/mcp.
export { DELETE, GET, OPTIONS, POST } from '@/app/api/mcp/route';
