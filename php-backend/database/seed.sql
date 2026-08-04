-- KHCWW seed data. Run AFTER schema.sql in phpMyAdmin.
-- Default super admin: phone 0700000000  /  password Member2026
SET @uid = '11111111-1111-4111-8111-111111111111';
SET @mid = '22222222-2222-4222-8222-222222222222';

INSERT IGNORE INTO auth_users (id, email, phone, encrypted_password, raw_user_meta_data)
VALUES (@uid, '254700000000@welfare.local', '+254700000000',
        '$2y$10$e0NR2z7YQ9Yk0Jm3n1sZ0uQ8Kz5R7l0d1cV0nUq2sT3wX4yZ5aB6C',
        '{"name":"Laban Panda Khisa"}');

INSERT IGNORE INTO user_roles (id, user_id, role, is_active)
VALUES ('33333333-3333-4333-8333-333333333333', @uid, 'super_admin', 1),
       ('33333333-3333-4333-8333-333333333334', @uid, 'admin', 1);

INSERT IGNORE INTO members (id, user_id, name, phone, is_active, status)
VALUES (@mid, @uid, 'Laban Panda Khisa', '+254700000000', 1, 'active');

INSERT IGNORE INTO welfare_settings (id, name) VALUES ('44444444-4444-4444-8444-444444444444', 'KHCW Welfare Group');
INSERT IGNORE INTO organization_settings (id, organization_name) VALUES ('55555555-5555-4555-8555-555555555555', 'KHCWW');
INSERT IGNORE INTO registration_config (id) VALUES ('66666666-6666-4666-8666-666666666666');
INSERT IGNORE INTO penalty_wallet (id) VALUES ('77777777-7777-4777-8777-777777777777');
INSERT IGNORE INTO donation_wallet (id) VALUES ('88888888-8888-4888-8888-888888888888');
INSERT IGNORE INTO operational_wallet (id) VALUES ('99999999-9999-4999-8999-999999999999');

-- IMPORTANT: the seeded password hash above is a placeholder.
-- Generate a real one on the server and update it:
--   php -r "echo password_hash('Member2026', PASSWORD_BCRYPT);"
--   UPDATE auth_users SET encrypted_password = '<paste hash>' WHERE email = '254700000000@welfare.local';
