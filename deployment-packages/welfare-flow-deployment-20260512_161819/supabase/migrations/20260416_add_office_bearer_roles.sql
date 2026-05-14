-- Add new roles to the app_role enum (must be done in separate transactions)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'chairperson';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vice_chairperson';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vice_secretary';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'patron';