CREATE OR REPLACE VIEW public.member_executive_roles
WITH (security_invoker = true) AS
SELECT
  ur.id                AS id,
  m.id                 AS member_id,
  ur.role::text        AS role_name,
  m.is_active          AS is_active,
  m.name               AS member_name,
  ur.user_id           AS user_id,
  m.created_at         AS created_at,
  m.updated_at         AS updated_at
FROM public.user_roles ur
JOIN public.members m ON m.user_id = ur.user_id
WHERE ur.role::text IN (
  'chairperson','vice_chairperson','secretary','vice_secretary','treasurer','patron','executive'
);

GRANT SELECT ON public.member_executive_roles TO authenticated;
GRANT SELECT ON public.member_executive_roles TO anon;
GRANT SELECT ON public.member_executive_roles TO service_role;
