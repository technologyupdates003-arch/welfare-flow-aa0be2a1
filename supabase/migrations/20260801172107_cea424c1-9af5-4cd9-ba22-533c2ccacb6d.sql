CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_access_logs_created_at_desc ON public.member_access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at_desc ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_presence_online_last_seen ON public.user_presence (is_online, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON public.user_presence (last_seen DESC);