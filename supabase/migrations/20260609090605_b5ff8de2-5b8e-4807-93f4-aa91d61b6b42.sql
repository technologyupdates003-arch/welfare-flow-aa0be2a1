-- One-time cleanup: archive all news & events whose scheduled date (original) has already arrived/passed.
UPDATE public.news
SET status = 'archived'
WHERE status = 'active'
  AND scheduled_date IS NOT NULL
  AND scheduled_date <= now();

UPDATE public.events
SET status = 'archived'
WHERE status = 'active'
  AND scheduled_date IS NOT NULL
  AND scheduled_date <= now();