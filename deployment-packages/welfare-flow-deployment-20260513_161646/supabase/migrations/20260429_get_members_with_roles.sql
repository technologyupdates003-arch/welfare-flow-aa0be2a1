-- Create a function to get members with roles
CREATE OR REPLACE FUNCTION get_members_with_roles()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  is_active BOOLEAN,
  user_id UUID,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id,
    m.name,
    m.phone,
    m.is_active,
    m.user_id,
    m.created_at
  FROM members m
  INNER JOIN user_roles ur ON m.user_id = ur.user_id
  WHERE m.is_active = true
  ORDER BY m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_members_with_roles() TO authenticated;
