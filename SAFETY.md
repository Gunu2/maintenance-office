# Safety Guardrails

- Never hardcode or paste API keys; use environment variables or MCP configuration.
- Ask for confirmation before deleting files or running destructive terminal commands.
- Draft, don't auto-send, any external message or purchase order.
- Diagnostic and audit logic is read-only on historical data; writes are limited to work orders and status updates.
- Any generated maintenance procedure must include lockout/tagout (LOTO) and PPE steps before being marked ready.
