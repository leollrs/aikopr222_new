import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { formatUsd, getDiscountedPrice, toNumber } from '../../lib/pricing'

export default function AdminPromotions() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState(null)

  const queryClient = useQueryClient()

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    },
  })
  const { data: services = [] } = useQuery({
    queryKey: ['admin-services-basic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, active, price')
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    },
  })

  const servicesById = services.reduce((acc, service) => {
    acc[service.id] = service
    return acc
  }, {})

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['promotions'])
      toast.success('Promoción eliminada')
    },
    onError: (error) => {
      toast.error('Error al eliminar promoción')
      console.error(error)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }) => {
      const { error } = await supabase
        .from('promotions')
        .update({ active })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['promotions'])
      toast.success('Estado de promoción actualizado')
    },
    onError: (error) => {
      toast.error('Error al actualizar promoción')
      console.error(error)
    },
  })

  const activePromotions = promotions.filter((p) => p.active)
  const pastPromotions = promotions.filter((p) => !p.active || new Date(p.end_date) < new Date())

  const handleEdit = (promotion) => {
    setEditingPromotion(promotion)
    setIsModalOpen(true)
  }

  const handleNew = () => {
    setEditingPromotion(null)
    setIsModalOpen(true)
  }

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de eliminar esta promoción?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleToggleActive = (id, currentActive) => {
    toggleActiveMutation.mutate({ id, active: !currentActive })
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-8 sm:py-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-ink-dark mb-2">Gestión de Promociones</h1>
            <p className="text-ink-light">Administra las promociones y ofertas especiales</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link
              to="/admin/dashboard"
              className="px-6 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors text-center"
            >
              Volver
            </Link>
            <button
              onClick={handleNew}
              className="btnPrimary px-6 py-2 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all justify-center"
            >
              + Nueva Promoción
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-ink-light">Cargando promociones...</p>
          </div>
        ) : (
          <>
            {/* Active Promotions */}
            <div className="mb-12">
              <h2 className="font-serif text-xl sm:text-2xl text-ink-dark mb-6">Promociones Activas</h2>
              {activePromotions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-md">
                  <p className="text-ink-light">No hay promociones activas.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {activePromotions.map((promotion) => (
                    <PromotionCard
                      key={promotion.id}
                      promotion={promotion}
                      service={servicesById[promotion.service_id]}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Past Promotions */}
            {pastPromotions.length > 0 && (
              <div>
                <h2 className="font-serif text-xl sm:text-2xl text-ink-dark mb-6">Promociones Pasadas</h2>
                <div className="grid gap-4">
                  {pastPromotions.map((promotion) => (
                    <PromotionCard
                      key={promotion.id}
                      promotion={promotion}
                      service={servicesById[promotion.service_id]}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {isModalOpen && (
          <PromotionModal
            promotion={editingPromotion}
            services={services}
            onClose={() => {
              setIsModalOpen(false)
              setEditingPromotion(null)
            }}
            onSuccess={() => {
              setIsModalOpen(false)
              setEditingPromotion(null)
              queryClient.invalidateQueries(['promotions'])
            }}
          />
        )}
      </div>
    </div>
  )
}

function PromotionCard({ promotion, service, onEdit, onDelete, onToggleActive }) {
  const isActive = promotion.active && new Date(promotion.end_date) >= new Date()
  const discountText = promotion.discount_percent
    ? `${promotion.discount_percent}% OFF`
    : `$${promotion.discount_amount} OFF`
  const basePrice = toNumber(service?.price)
  const discountedPrice = getDiscountedPrice(
    basePrice,
    promotion.discount_percent,
    promotion.discount_amount
  )
  const hasDiscountedPrice =
    basePrice !== null && discountedPrice !== null && discountedPrice < basePrice

  return (
    <div className="bg-white rounded-lg p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h3 className="font-serif text-xl text-ink-dark">{promotion.title}</h3>
            {isActive && (
              <span className="px-2 py-1 bg-success text-white text-xs uppercase rounded">
                Activa
              </span>
            )}
            <span className="px-2 py-1 luxuryBadge text-xs uppercase rounded">
              {discountText}
            </span>
          </div>
          <p className="text-ink-light text-sm mb-4">{promotion.description}</p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-ink-light">
            <span>Servicio: {service?.name || 'No asignado'}</span>
            {hasDiscountedPrice && (
              <span className="flex items-center gap-2">
                <span className="line-through">{formatUsd(basePrice)}</span>
                <span className="text-gold font-semibold">{formatUsd(discountedPrice)}</span>
              </span>
            )}
            <span>
              {new Date(promotion.start_date).toLocaleDateString('es-ES')} -{' '}
              {new Date(promotion.end_date).toLocaleDateString('es-ES')}
            </span>
          </div>
        </div>
        {promotion.banner_image_url && (
          <img
            src={promotion.banner_image_url}
            alt={promotion.title}
            className="w-full xl:w-32 h-40 xl:h-32 object-cover rounded-md"
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2 w-full xl:w-auto">
          <button
            onClick={() => onEdit(promotion)}
            className="px-4 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => onToggleActive(promotion.id, promotion.active)}
            className={`px-4 py-2 border rounded-md text-sm font-semibold uppercase tracking-wider transition-colors ${
              promotion.active
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-border-md hover:border-gold hover:text-gold'
            }`}
          >
            {promotion.active ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={() => onDelete(promotion.id)}
            className="px-4 py-2 border border-error/30 text-error rounded-md text-sm font-semibold uppercase tracking-wider hover:bg-error/10 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

function PromotionModal({ promotion, services, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    service_id: promotion?.service_id || '',
    title: promotion?.title || '',
    description: promotion?.description || '',
    discount_percent: promotion?.discount_percent || '',
    discount_amount: promotion?.discount_amount || '',
    start_date: promotion?.start_date || '',
    end_date: promotion?.end_date || '',
    active: promotion?.active ?? true,
  })
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(promotion?.banner_image_url || null)
  const [uploading, setUploading] = useState(false)

  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (promotion) {
        const { error } = await supabase
          .from('promotions')
          .update(data)
          .eq('id', promotion.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('promotions').insert([data])
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(promotion ? 'Promoción actualizada' : 'Promoción creada')
      queryClient.invalidateQueries(['promotions'])
      queryClient.invalidateQueries(['hero-promotions'])
      onSuccess()
    },
    onError: (error) => {
      if (error?.message?.includes('service_id')) {
        toast.error('Falta migración SQL de promociones. Ejecuta supabase-promotion-service-link.sql')
      } else {
        toast.error('Error al guardar promoción')
      }
      console.error(error)
    },
  })

  const handleBannerChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setBannerFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setBannerPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadBanner = async () => {
    if (!bannerFile) return formData.banner_image_url

    setUploading(true)
    try {
      const fileExt = bannerFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `promotions/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('promotion-images')
        .upload(filePath, bannerFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('promotion-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading banner:', error)
      toast.error('Error al subir imagen')
      throw error
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.service_id) {
      toast.error('Debes seleccionar un servicio para esta promoción')
      return
    }

    if (!formData.discount_percent && !formData.discount_amount) {
      toast.error('Debes especificar un descuento (porcentaje o cantidad)')
      return
    }

    setUploading(true)
    try {
      let bannerUrl = formData.banner_image_url
      if (bannerFile) {
        bannerUrl = await uploadBanner()
      }

      const dataToSave = {
        service_id: formData.service_id,
        title: formData.title,
        description: formData.description,
        discount_percent: formData.discount_percent ? parseFloat(formData.discount_percent) : null,
        discount_amount: formData.discount_amount ? parseFloat(formData.discount_amount) : null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        active: formData.active,
        banner_image_url: bannerUrl,
      }

      await saveMutation.mutateAsync(dataToSave)
    } catch (error) {
      // Error already handled in mutation
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[94vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
          <h2 className="font-serif text-xl sm:text-2xl text-ink-dark">
            {promotion ? 'Editar Promoción' : 'Nueva Promoción'}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Servicio *</label>
            <select
              value={formData.service_id}
              onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="">Selecciona un servicio</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} {service.active ? '' : '(Inactivo)'}
                </option>
              ))}
            </select>
            {services.length === 0 && (
              <p className="text-sm text-error mt-2">
                No hay servicios disponibles. Crea un servicio antes de crear promociones.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Título *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Descripción *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Descuento (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.discount_percent}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    discount_percent: e.target.value,
                    discount_amount: '', // Clear other field
                  })
                }}
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Descuento ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.discount_amount}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    discount_amount: e.target.value,
                    discount_percent: '', // Clear other field
                  })
                }}
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Fecha de Inicio *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Fecha de Fin *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
                min={formData.start_date}
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Imagen del Banner</label>
            {bannerPreview && (
              <img
                src={bannerPreview}
                alt="Banner preview"
                className="w-full h-48 object-cover rounded-md mb-2"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 text-gold focus:ring-gold"
              />
              <span className="text-sm text-ink">Promoción activa</span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-ink hover:text-ink transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading || services.length === 0}
              className="flex-1 btnPrimary py-3 px-6 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {uploading ? 'Guardando...' : promotion ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
