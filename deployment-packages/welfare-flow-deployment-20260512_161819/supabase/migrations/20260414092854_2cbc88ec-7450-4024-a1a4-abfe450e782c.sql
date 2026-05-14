
-- Add cascade delete foreign keys so deleting a member cleans up related data
ALTER TABLE public.beneficiaries DROP CONSTRAINT IF EXISTS beneficiaries_member_id_fkey;
ALTER TABLE public.beneficiaries ADD CONSTRAINT beneficiaries_member_id_fkey 
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_member_id_fkey;
ALTER TABLE public.contributions ADD CONSTRAINT contributions_member_id_fkey 
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

ALTER TABLE public.penalties DROP CONSTRAINT IF EXISTS penalties_member_id_fkey;
ALTER TABLE public.penalties ADD CONSTRAINT penalties_member_id_fkey 
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_member_id_fkey;
ALTER TABLE public.documents ADD CONSTRAINT documents_member_id_fkey 
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
