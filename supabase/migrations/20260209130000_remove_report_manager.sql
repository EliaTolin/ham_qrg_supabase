-- Give bridge_manager the reports.manage permission
INSERT INTO public.role_permissions (role, permission)
VALUES ('bridge_manager', 'reports.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- Remove all permissions for report_manager
DELETE FROM public.role_permissions WHERE role = 'report_manager';

-- Migrate any existing report_manager users to bridge_manager
UPDATE public.user_roles SET role = 'bridge_manager' WHERE role = 'report_manager';
