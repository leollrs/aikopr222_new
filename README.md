# AIKOPR222 Clinic CMS

A modern React-based content management system for an aesthetic clinic, allowing the clinic owner to self-manage services, promotions, and appointments without developer intervention.

## Features

### Public Site
- Beautiful, responsive homepage with hero section
- Dynamic services display (fetched from Supabase)
- Service categories: Estética Avanzada, Domicilio, Depilación, Faciales
- Multi-step booking modal
- Testimonials carousel
- Contact section

### Admin Panel (`/admin/*`)
- **Dashboard**: Overview stats, featured service management
- **Services Management**: Full CRUD for services
  - Upload images/videos
  - Set featured service (service of the week)
  - Category management
  - Price and duration settings
- **Promotions Management**: Create and manage promotions
  - Discount percentages or fixed amounts
  - Date ranges
  - Banner image uploads

### Client Portal (`/client/*`)
- **Dashboard**: View upcoming appointments and stats
- **My Appointments**: Full appointment history with filtering
- **Profile**: Manage personal information

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Routing**: React Router
- **State Management**: TanStack Query
- **Forms**: React Hook Form + Zod
- **Notifications**: Sonner

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Follow the instructions in `SUPABASE_SETUP.md`
2. Create a Supabase project
3. Run the SQL migration from `supabase-setup.sql`
4. Set up storage buckets as described
5. Create an admin user

### 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
/
├── src/
│   ├── components/       # Reusable React components
│   │   ├── Header.jsx
│   │   ├── Hero.jsx
│   │   ├── Services.jsx
│   │   ├── BookingModal.jsx
│   │   └── ...
│   ├── pages/           # Page components
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── admin/       # Admin panel pages
│   │   └── client/      # Client portal pages
│   ├── context/         # React context providers
│   │   └── AuthContext.jsx
│   ├── lib/             # Utilities and configurations
│   │   ├── supabase.js
│   │   └── utils.js
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── supabase-setup.sql   # Database migration
├── SUPABASE_SETUP.md    # Supabase setup guide
└── package.json
```

## Usage Guide

### For Clinic Owner (Admin)

1. **Log in** at `/login` with your admin credentials
2. **Access admin panel** at `/admin/dashboard`
3. **Manage services**:
   - Go to "Gestión de Servicios"
   - Click "+ Nuevo Servicio" to add a service
   - Upload images, set prices, descriptions
   - Toggle "Servicio destacado" to set service of the week
4. **Manage promotions**:
   - Go to "Gestión de Promociones"
   - Create promotions with discounts and date ranges
   - Upload banner images

### For Clients

1. **Browse services** on the homepage
2. **Book appointments** using the booking modal
3. **Create account** or log in at `/login`
4. **View appointments** in the client portal
5. **Manage profile** information

## Database Schema

See `supabase-setup.sql` for the complete schema. Key tables:

- `users` - User accounts with roles (admin/client)
- `services` - Service catalog
- `promotions` - Active promotions
- `appointments` - Client appointments
- `client_profiles` - Extended client information

## Security

- Row Level Security (RLS) policies protect all data
- Admin routes require admin role
- Client routes require authentication
- File uploads validated by type and size
- Environment variables for sensitive keys

## Troubleshooting

### RLS Errors
- Ensure all RLS policies from `supabase-setup.sql` are applied
- Check user role in `users` table

### Image Upload Fails
- Verify storage bucket policies
- Check file size limits (5MB for images, 50MB for videos)
- Ensure bucket is set to public

### Auth Not Working
- Verify environment variables are correct
- Check Supabase project settings
- Ensure user exists in Supabase Auth

## Support

For issues or questions, refer to:
- Supabase documentation: https://supabase.com/docs
- React documentation: https://react.dev
- Tailwind CSS: https://tailwindcss.com/docs
