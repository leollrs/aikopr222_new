# Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - Project name: `aikopr222-clinic`
   - Database password: (choose a strong password)
   - Region: Choose closest to your users
4. Wait for project to be created (~2 minutes)

## Step 2: Run Database Migration

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the entire contents of `supabase-setup.sql`
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Verify all tables were created by checking the **Table Editor** section

## Step 3: Set Up Storage Buckets

1. Go to **Storage** in the Supabase dashboard
2. Create the following buckets:

   **Bucket 1: `service-images`**
   - Public: Yes
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/png, image/webp

   **Bucket 2: `service-videos`**
   - Public: Yes
   - File size limit: 50MB
   - Allowed MIME types: video/mp4, video/webm

   **Bucket 3: `promotion-images`**
   - Public: Yes
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/png, image/webp

3. For each bucket, go to **Policies** and add:

   **Public Read Policy:**
   ```sql
   CREATE POLICY "Public Access" ON storage.objects
   FOR SELECT USING (bucket_id = 'service-images');
   ```
   (Repeat for each bucket, changing bucket_id)

   **Admin Upload Policy:**
   ```sql
   CREATE POLICY "Admins can upload" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'service-images' AND public.is_admin()
   );
   ```

   **Admin Update/Delete Policy:**
   ```sql
   CREATE POLICY "Admins can update" ON storage.objects
   FOR UPDATE USING (
     bucket_id = 'service-images' AND public.is_admin()
   );

   CREATE POLICY "Admins can delete" ON storage.objects
   FOR DELETE USING (
     bucket_id = 'service-images' AND public.is_admin()
   );
   ```
   (Repeat for each bucket)

## Step 4: Get API Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 5: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Step 6: Create Admin User

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Add User** → **Create new user**
3. Enter admin email and password
4. After user is created, go to **SQL Editor** and run:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-admin@email.com';
```

## Step 7: Test Connection

1. Run `npm install` in your project
2. Run `npm run dev`
3. Try logging in with your admin credentials
4. Check that you can access `/admin/dashboard`

## Troubleshooting

- **RLS errors**: Make sure you've run all the RLS policies from `supabase-setup.sql`
- **Storage upload fails**: Check bucket policies and file size limits
- **Auth not working**: Verify environment variables are correct and user exists in Supabase
