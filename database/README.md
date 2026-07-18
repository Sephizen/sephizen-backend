# Database SQL

Run the SQL files in this directory in Supabase SQL editor.

## Files

- `policies.sql` - Row Level Security policies for user-owned rows.
- `credit_rpc.sql` - Atomic credit adjustment and assistant-reply transaction helpers.

## Notes

- `adjust_daily_credits(p_user_id, p_credits_delta, p_daily_limit)` keeps credit updates atomic and uses the backend-configured daily limit when provided.
- `record_chat_reply(...)` inserts the assistant message and updates the parent chat session in one transaction.
- After applying policy changes, make sure RLS is enabled on the existing tables.
