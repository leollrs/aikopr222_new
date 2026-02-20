-- ============================================================
-- ROLE RESOLUTION + ADMIN POLICY FIX
-- Run this once in Supabase SQL Editor for existing projects.
-- ============================================================

-- 1) Helper functions used by RLS and frontend RPC role lookup
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role = 'admin'
      FROM public.users
      WHERE id = auth.uid()
      LIMIT 1
    ),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2) Replace self-referential admin policies with function calls
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all services" ON public.services;
CREATE POLICY "Admins can manage all services" ON public.services
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all promotions" ON public.promotions;
CREATE POLICY "Admins can manage all promotions" ON public.promotions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
CREATE POLICY "Admins can view all appointments" ON public.appointments
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all appointments" ON public.appointments;
CREATE POLICY "Admins can manage all appointments" ON public.appointments
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.client_profiles;
CREATE POLICY "Admins can view all profiles" ON public.client_profiles
  FOR SELECT USING (public.is_admin());

-- 2b) Public promotions should be visible when active (regardless of date fields)
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;
CREATE POLICY "Anyone can view active promotions" ON public.promotions
  FOR SELECT USING (active = TRUE);

-- 3) Optional sanity checks (run while logged in as the affected user)
-- SELECT auth.uid(), public.get_my_role(), public.is_admin();
