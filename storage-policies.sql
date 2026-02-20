-- ============================================================
-- STORAGE BUCKET POLICIES
-- Run these in Supabase SQL Editor after creating buckets
-- ============================================================

-- ============================================================
-- SERVICE-IMAGES BUCKET POLICIES
-- ============================================================

-- Public Read Policy (anyone can view images)
CREATE POLICY "Public Access - service-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-images');

-- Admin Upload Policy (only admins can upload)
CREATE POLICY "Admins can upload - service-images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'service-images' AND
  public.is_admin()
);

-- Admin Update Policy (only admins can update)
CREATE POLICY "Admins can update - service-images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'service-images' AND
  public.is_admin()
);

-- Admin Delete Policy (only admins can delete)
CREATE POLICY "Admins can delete - service-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'service-images' AND
  public.is_admin()
);

-- ============================================================
-- SERVICE-VIDEOS BUCKET POLICIES
-- ============================================================

-- Public Read Policy (anyone can view videos)
CREATE POLICY "Public Access - service-videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-videos');

-- Admin Upload Policy (only admins can upload)
CREATE POLICY "Admins can upload - service-videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'service-videos' AND
  public.is_admin()
);

-- Admin Update Policy (only admins can update)
CREATE POLICY "Admins can update - service-videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'service-videos' AND
  public.is_admin()
);

-- Admin Delete Policy (only admins can delete)
CREATE POLICY "Admins can delete - service-videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'service-videos' AND
  public.is_admin()
);

-- ============================================================
-- PROMOTION-IMAGES BUCKET POLICIES
-- ============================================================

-- Public Read Policy (anyone can view promotion images)
CREATE POLICY "Public Access - promotion-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotion-images');

-- Admin Upload Policy (only admins can upload)
CREATE POLICY "Admins can upload - promotion-images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'promotion-images' AND
  public.is_admin()
);

-- Admin Update Policy (only admins can update)
CREATE POLICY "Admins can update - promotion-images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'promotion-images' AND
  public.is_admin()
);

-- Admin Delete Policy (only admins can delete)
CREATE POLICY "Admins can delete - promotion-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'promotion-images' AND
  public.is_admin()
);
