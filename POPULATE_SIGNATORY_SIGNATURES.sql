-- Populate signatory_signatures with office bearer names and mock signatures
-- This ensures receipts show prefilled names and signatures

-- First, get office bearers and insert their signatures
INSERT INTO signatory_signatures (user_id, signatory_role, full_name, signature_url, created_at)
SELECT 
  ob.user_id,
  ob.office_bearer_role,
  m.name as full_name,
  obs.signature_url,
  NOW()
FROM office_bearers ob
LEFT JOIN members m ON ob.user_id = m.user_id
LEFT JOIN office_bearer_signatures obs ON ob.user_id = obs.user_id AND ob.office_bearer_role = obs.office_bearer_role
WHERE ob.office_bearer_role IN ('chairperson', 'secretary', 'treasurer')
ON CONFLICT (user_id, signatory_role) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  signature_url = COALESCE(EXCLUDED.signature_url, signatory_signatures.signature_url);

-- Also insert role-based entries (for cases where specific user isn't assigned)
INSERT INTO signatory_signatures (signatory_role, full_name, created_at)
SELECT DISTINCT 
  'chairperson',
  'Chairperson',
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM signatory_signatures WHERE signatory_role = 'chairperson')
UNION ALL
SELECT 
  'secretary',
  'Secretary',
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM signatory_signatures WHERE signatory_role = 'secretary')
UNION ALL
SELECT 
  'treasurer',
  'Treasurer',
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM signatory_signatures WHERE signatory_role = 'treasurer')
ON CONFLICT DO NOTHING;

-- Verify data was inserted
SELECT 'Signatory Signatures' as type, COUNT(*) as count FROM signatory_signatures;

-- Show what was inserted
SELECT signatory_role, full_name, signature_url FROM signatory_signatures ORDER BY signatory_role;
