-- ============================================================================
-- Add super_admin to app_role enum type
-- This must be run BEFORE the super admin role migration
-- ============================================================================

-- Step 1: Add super_admin to the app_role enum
ALTER TYPE app_role ADD VALUE 'super_admin' BEFORE 'admin';

-- Step 2: Verify the enum was updated
SELECT enum_range(NULL::app_role);

-- ============================================================================
-- DONE! super_admin is now a valid role
-- ============================================================================
