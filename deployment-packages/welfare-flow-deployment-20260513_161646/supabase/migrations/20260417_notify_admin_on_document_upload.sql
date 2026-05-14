-- Notify admins when member uploads a document

-- Function to create notification for admins
CREATE OR REPLACE FUNCTION notify_admins_on_document_upload()
RETURNS TRIGGER AS $$
DECLARE
    admin_user RECORD;
    member_name TEXT;
BEGIN
    -- Get the member's name
    SELECT name INTO member_name
    FROM members
    WHERE user_id = NEW.uploaded_by;
    
    -- Create notification for each admin
    FOR admin_user IN 
        SELECT DISTINCT user_id 
        FROM user_roles 
        WHERE role = 'admin'
    LOOP
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            is_read,
            created_at
        )
        VALUES (
            admin_user.user_id,
            'New Document Uploaded',
            COALESCE(member_name, 'A member') || ' uploaded a new document: ' || NEW.file_name,
            'info',
            false,
            NOW()
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_admins_on_document_upload ON documents;
CREATE TRIGGER trigger_notify_admins_on_document_upload
    AFTER INSERT ON documents
    FOR EACH ROW
    EXECUTE FUNCTION notify_admins_on_document_upload();

-- Verify trigger was created
SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_admins_on_document_upload';
