-- ============================================================
-- AIKOPR222 Clinic Database Setup
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('admin', 'client');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE appointment_location AS ENUM ('domicilio', 'local');

-- ============================================================
-- USERS TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('estetica-avanzada', 'domicilio', 'depilacion', 'faciales')),
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  duration TEXT,
  featured BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  video_url TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROMOTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  discount_percent NUMERIC(5, 2),
  discount_amount NUMERIC(10, 2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  banner_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (discount_percent IS NOT NULL AND discount_amount IS NULL) OR
    (discount_percent IS NULL AND discount_amount IS NOT NULL)
  )
);

-- ============================================================
-- APPOINTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable for guest bookings
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  appointment_date TIMESTAMPTZ NOT NULL,
  status appointment_status DEFAULT 'pending',
  location appointment_location NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENT PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_services_featured ON services(featured);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_service ON promotions(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helpers to avoid recursive policy checks on "users"
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

-- USERS POLICIES
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (public.is_admin());

-- SERVICES POLICIES
CREATE POLICY "Anyone can view active services" ON services
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Admins can manage all services" ON services
  FOR ALL USING (public.is_admin());

-- PROMOTIONS POLICIES
CREATE POLICY "Anyone can view active promotions" ON promotions
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Admins can manage all promotions" ON promotions
  FOR ALL USING (public.is_admin());

-- APPOINTMENTS POLICIES
CREATE POLICY "Clients can view own appointments" ON appointments
  FOR SELECT USING (client_id = auth.uid() OR client_id IS NULL);

CREATE POLICY "Clients can create own appointments" ON appointments
  FOR INSERT WITH CHECK (client_id = auth.uid() OR client_id IS NULL);

CREATE POLICY "Clients can update own appointments" ON appointments
  FOR UPDATE USING (client_id = auth.uid());

CREATE POLICY "Anyone can create guest appointments" ON appointments
  FOR INSERT WITH CHECK (client_id IS NULL);

CREATE POLICY "Admins can view all appointments" ON appointments
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage all appointments" ON appointments
  FOR ALL USING (public.is_admin());

-- CLIENT PROFILES POLICIES
CREATE POLICY "Clients can view own profile" ON client_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Clients can update own profile" ON client_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Clients can insert own profile" ON client_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON client_profiles
  FOR SELECT USING (public.is_admin());

-- ============================================================
-- FUNCTION: Create user record on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================
-- Insert sample services (uncomment to use)
/*
INSERT INTO services (name, category, description, price, duration, featured, display_order) VALUES
('CO₂ Láser Fraccionado', 'estetica-avanzada', 'Piel más lisa, poros más finos y apariencia rejuvenecida', 230.00, '45–60 min', TRUE, 1),
('RF Fraccionada con Microagujas - Rostro', 'domicilio', 'Rostro, cuello y escote. Ideal si buscas renovar la textura de tu piel', 149.00, '60 min', FALSE, 2),
('HIFU — Rostro', 'domicilio', 'Ultrasonido focalizado de alta intensidad para un lifting facial no invasivo', 120.00, '45 min', FALSE, 3),
('Depilación Láser - Axilas', 'depilacion', 'Reducción progresiva del vello con tecnología láser diodo', 45.00, '30 min', FALSE, 4),
('Limpieza Facial', 'faciales', 'Limpieza profunda con extracción manual', 65.00, '60 min', FALSE, 5);
*/
