import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function ClientProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    },
    enabled: !!user?.id,
  })

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
      })
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (profile) {
        const { error } = await supabase
          .from('client_profiles')
          .update(data)
          .eq('id', profile.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('client_profiles')
          .insert([{ ...data, user_id: user.id }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Perfil actualizado')
      queryClient.invalidateQueries(['client-profile'])
    },
    onError: (error) => {
      toast.error('Error al guardar perfil')
      console.error(error)
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="container py-12">
          <p className="text-ink-light">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-serif text-ink-dark mb-2">Mi Perfil</h1>
            <p className="text-ink-light">Administra tu información personal</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/client/dashboard"
              className="px-6 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors"
            >
              Mi Cuenta
            </Link>
            <Link
              to="/"
              className="px-6 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors"
            >
              Inicio
            </Link>
          </div>
        </div>

        <div className="max-w-2xl">
          <div className="bg-white rounded-lg p-6 shadow-md mb-6">
            <h2 className="font-serif text-xl text-ink-dark mb-4">Información de Contacto</h2>
            <div className="space-y-2 mb-4">
              <p className="text-ink-light text-sm">Email</p>
              <p className="text-ink font-semibold">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="font-serif text-xl text-ink-dark mb-6">Información Personal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">Teléfono *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">Dirección</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6 pt-6 border-t border-border">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 btnPrimary py-3 px-6 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
