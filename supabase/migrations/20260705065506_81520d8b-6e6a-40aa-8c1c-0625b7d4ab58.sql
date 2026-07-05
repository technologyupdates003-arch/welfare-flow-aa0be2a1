CREATE OR REPLACE FUNCTION public.notify_beneficiary_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_name TEXT;
  m_user UUID;
  admin_rec RECORD;
BEGIN
  SELECT name, user_id INTO m_name, m_user FROM public.members WHERE id = NEW.member_id;

  IF TG_OP = 'INSERT' THEN
    -- Notify all admins / super admins of the new request
    FOR admin_rec IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','super_admin')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        admin_rec.user_id,
        'New beneficiary request',
        COALESCE(m_name,'A member') || ' submitted a beneficiary ' || NEW.request_type || ' request for review.',
        'beneficiary_request'
      );
    END LOOP;

  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('approved','rejected') AND m_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      m_user,
      'Beneficiary request ' || NEW.status,
      'Your beneficiary ' || NEW.request_type || ' request has been ' || NEW.status ||
        CASE WHEN NEW.admin_notes IS NOT NULL AND NEW.admin_notes <> '' THEN '. Note: ' || NEW.admin_notes ELSE '.' END,
      'beneficiary_' || NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_beneficiary_request ON public.beneficiary_requests;
CREATE TRIGGER trg_notify_beneficiary_request
  AFTER INSERT OR UPDATE ON public.beneficiary_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_beneficiary_request();
