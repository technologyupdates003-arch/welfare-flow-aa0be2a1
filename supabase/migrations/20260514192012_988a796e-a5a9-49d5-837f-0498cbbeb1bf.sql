INSERT INTO public.user_roles (user_id, role)
VALUES ('51560aaf-743a-4527-9047-49ccddc76295', 'treasurer')
ON CONFLICT (user_id, role) DO NOTHING;