CREATE OR REPLACE FUNCTION public.get_member_login_activity(
  _search text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  member_id uuid,
  user_id uuid,
  name text,
  phone text,
  email text,
  is_active boolean,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT m.id AS member_id,
           m.user_id,
           m.name,
           m.phone,
           u.email::text AS email,
           m.is_active,
           u.last_sign_in_at,
           u.created_at
    FROM public.members m
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE _search IS NULL OR _search = ''
       OR m.name ILIKE '%' || _search || '%'
       OR m.phone ILIKE '%' || _search || '%'
  ), counted AS (
    SELECT COUNT(*) AS c FROM base
  )
  SELECT b.member_id, b.user_id, b.name, b.phone, b.email, b.is_active,
         b.last_sign_in_at, b.created_at, counted.c
  FROM base b CROSS JOIN counted
  ORDER BY b.last_sign_in_at DESC NULLS LAST, b.name ASC
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_login_activity(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_login_activity(text, integer, integer) TO authenticated;