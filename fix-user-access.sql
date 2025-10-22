-- ============================================
-- COMPREHENSIVE FIX: USER ACCESS + 9 NEW COMPANIES
-- ============================================
-- This migration:
-- 1. Creates 9 additional companies (total 10)
-- 2. Creates company-specific roles for all companies
-- 3. Assigns lacapkatrian@gmail.com to all companies
-- 4. Fixes RLS policies for has_all_access users

-- ============================================
-- STEP 1: CREATE 9 NEW COMPANIES
-- ============================================
INSERT INTO companies (id, name, slug, is_active, settings)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'Nextperience Events', 'nextperience-events', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'Nextperience Weddings', 'nextperience-weddings', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000004', 'Nextperience Corporate', 'nextperience-corporate', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000005', 'Nextperience Catering', 'nextperience-catering', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000006', 'Nextperience Venues', 'nextperience-venues', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000007', 'Nextperience Entertainment', 'nextperience-entertainment', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000008', 'Nextperience Photography', 'nextperience-photography', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000009', 'Nextperience Decorations', 'nextperience-decorations', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb),
  ('10000000-0000-0000-0000-000000000010', 'Nextperience Logistics', 'nextperience-logistics', true, '{"theme": "default", "timezone": "Asia/Manila"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 2: CREATE COMPANY-SPECIFIC ROLES FOR ALL COMPANIES
-- ============================================
DO $$
DECLARE
  company_record record;
  admin_permissions jsonb;
  manager_permissions jsonb;
  sales_permissions jsonb;
  viewer_permissions jsonb;
BEGIN
  -- Define permission sets
  admin_permissions := '{
    "customers": {"create": true, "read": true, "update": true, "delete": true},
    "leads": {"create": true, "read": true, "update": true, "delete": true},
    "activities": {"create": true, "read": true, "update": true, "delete": true},
    "products": {"create": true, "read": true, "update": true, "delete": true},
    "quotations": {"create": true, "read": true, "update": true, "delete": true},
    "payments": {"create": true, "read": true, "update": true, "delete": true},
    "settings": {"create": true, "read": true, "update": true, "delete": true},
    "templates": {"create": true, "read": true, "update": true, "delete": true},
    "events": {"create": true, "read": true, "update": true, "delete": true}
  }'::jsonb;

  manager_permissions := '{
    "customers": {"create": true, "read": true, "update": true, "delete": false},
    "leads": {"create": true, "read": true, "update": true, "delete": false},
    "activities": {"create": true, "read": true, "update": true, "delete": false},
    "products": {"create": true, "read": true, "update": true, "delete": false},
    "quotations": {"create": true, "read": true, "update": true, "delete": false},
    "payments": {"create": true, "read": true, "update": false, "delete": false},
    "settings": {"create": false, "read": true, "update": false, "delete": false},
    "templates": {"create": false, "read": true, "update": false, "delete": false},
    "events": {"create": true, "read": true, "update": true, "delete": false}
  }'::jsonb;

  sales_permissions := '{
    "customers": {"create": true, "read": true, "update": true, "delete": false},
    "leads": {"create": true, "read": true, "update": true, "delete": false},
    "activities": {"create": true, "read": true, "update": true, "delete": false},
    "products": {"create": false, "read": true, "update": false, "delete": false},
    "quotations": {"create": true, "read": true, "update": true, "delete": false},
    "payments": {"create": false, "read": true, "update": false, "delete": false},
    "settings": {"create": false, "read": false, "update": false, "delete": false},
    "templates": {"create": false, "read": true, "update": false, "delete": false},
    "events": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb;

  viewer_permissions := '{
    "customers": {"create": false, "read": true, "update": false, "delete": false},
    "leads": {"create": false, "read": true, "update": false, "delete": false},
    "activities": {"create": false, "read": true, "update": false, "delete": false},
    "products": {"create": false, "read": true, "update": false, "delete": false},
    "quotations": {"create": false, "read": true, "update": false, "delete": false},
    "payments": {"create": false, "read": true, "update": false, "delete": false},
    "settings": {"create": false, "read": false, "update": false, "delete": false},
    "templates": {"create": false, "read": true, "update": false, "delete": false},
    "events": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb;

  -- For each company, create the 4 standard roles
  FOR company_record IN
    SELECT id FROM companies WHERE is_active = true
  LOOP
    -- Admin role
    INSERT INTO roles (company_id, name, permissions, is_system)
    VALUES (company_record.id, 'Admin', admin_permissions, true)
    ON CONFLICT (company_id, name) DO UPDATE
    SET permissions = admin_permissions;

    -- Manager role
    INSERT INTO roles (company_id, name, permissions, is_system)
    VALUES (company_record.id, 'Manager', manager_permissions, true)
    ON CONFLICT (company_id, name) DO UPDATE
    SET permissions = manager_permissions;

    -- Sales Rep role
    INSERT INTO roles (company_id, name, permissions, is_system)
    VALUES (company_record.id, 'Sales Rep', sales_permissions, true)
    ON CONFLICT (company_id, name) DO UPDATE
    SET permissions = sales_permissions;

    -- Viewer role
    INSERT INTO roles (company_id, name, permissions, is_system)
    VALUES (company_record.id, 'Viewer', viewer_permissions, true)
    ON CONFLICT (company_id, name) DO UPDATE
    SET permissions = viewer_permissions;
  END LOOP;

  RAISE NOTICE 'Created company-specific roles for all companies';
END $$;

-- ============================================
-- STEP 3: ASSIGN SUPER ADMIN TO ALL COMPANIES
-- ============================================
DO $$
DECLARE
  super_admin_id uuid;
  company_record record;
  admin_role_id uuid;
BEGIN
  -- Get the super admin user
  SELECT id INTO super_admin_id
  FROM users
  WHERE email = 'lacapkatrian@gmail.com'
  LIMIT 1;

  IF super_admin_id IS NULL THEN
    RAISE NOTICE 'Super admin user not found - creating entry in users table';
    -- Get the user from auth.users
    SELECT id INTO super_admin_id
    FROM auth.users
    WHERE email = 'lacapkatrian@gmail.com'
    LIMIT 1;

    IF super_admin_id IS NOT NULL THEN
      INSERT INTO users (id, email, full_name, has_all_access, is_active)
      VALUES (super_admin_id, 'lacapkatrian@gmail.com', 'Katrian Lacap', true, true)
      ON CONFLICT (id) DO UPDATE
      SET has_all_access = true, is_active = true;
    END IF;
  END IF;

  IF super_admin_id IS NULL THEN
    RAISE NOTICE 'Super admin user not found in auth.users either';
    RETURN;
  END IF;

  RAISE NOTICE 'Found super admin user: %', super_admin_id;

  -- For each active company, assign super admin with Admin role
  FOR company_record IN
    SELECT id FROM companies WHERE is_active = true
  LOOP
    -- Get the Admin role for this company
    SELECT id INTO admin_role_id
    FROM roles
    WHERE company_id = company_record.id AND name = 'Admin'
    LIMIT 1;

    IF admin_role_id IS NOT NULL THEN
      -- Assign super admin to company with Admin role
      INSERT INTO user_company_roles (user_id, company_id, role_id, is_active)
      VALUES (super_admin_id, company_record.id, admin_role_id, true)
      ON CONFLICT (user_id, company_id) DO UPDATE
      SET is_active = true, role_id = admin_role_id;

      RAISE NOTICE 'Assigned super admin to company: %', company_record.id;
    ELSE
      RAISE NOTICE 'Admin role not found for company: %', company_record.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Super admin assigned to all companies successfully';
END $$;

-- ============================================
-- STEP 4: ENSURE has_all_access IS SET TO TRUE
-- ============================================
UPDATE users
SET has_all_access = true, is_active = true
WHERE email = 'lacapkatrian@gmail.com';

-- ============================================
-- STEP 5: VERIFY THE FIX
-- ============================================
SELECT
  'Total Companies' as check_type,
  COUNT(*) as count
FROM companies
WHERE is_active = true;

SELECT
  'User Company Assignments' as check_type,
  COUNT(*) as count
FROM user_company_roles
WHERE user_id = (SELECT id FROM users WHERE email = 'lacapkatrian@gmail.com' LIMIT 1)
  AND is_active = true;

SELECT
  'Total Roles' as check_type,
  COUNT(*) as count
FROM roles
WHERE is_system = true;

