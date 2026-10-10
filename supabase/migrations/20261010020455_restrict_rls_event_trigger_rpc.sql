-- Supabase's DDL event trigger remains attached to ddl_command_end. Direct
-- PostgREST RPC execution is unnecessary and exposes a SECURITY DEFINER helper.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
