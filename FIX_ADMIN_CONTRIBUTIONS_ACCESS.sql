-- FIX: Allow admin to view ALL member contributions when viewing member details
-- Issue: Multiple conflicting policies and user_roles entries causing admin to not see contributions

-- First, ensure the admin user has the admin role in user_roles table
-- You'll need to replace 'YOUR_ADMIN_USER_ID' with the actual admin user's UUID
-- Get admin user ID: SELECT id FROM auth.users WHERE email = 'admin@email.com';

-- Then, fix the contribution policies to prioritize has_role() check:

-- 1. Drop conflicting office bearer policy if it exists
DROP POLICY IF EXISTS "Office bearers can view contributions" ON public.contributions;

-- 2. Create clear admin policy
CREATE POLICY "Admin view all contributions" ON public.contributions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create admin full access policy
CREATE POLICY "Admin can manage contributions" ON public.contributions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Members can view their own
CREATE POLICY "Members view own contributions" ON public.contributions
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

-- 5. Office bearers can view all (if they have the role)
CREATE POLICY "Office bearers can view contributions" ON public.contributions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'chairperson')
    OR public.has_role(auth.uid(), 'secretary')
    OR public.has_role(auth.uid(), 'vice_chairperson')
    OR public.has_role(auth.uid(), 'vice_secretary')
    OR public.has_role(auth.uid(), 'patron')
    OR public.has_role(auth.uid(), 'treasurer')
  );

-- Verify policies
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'contributions' ORDER BY policyname;
