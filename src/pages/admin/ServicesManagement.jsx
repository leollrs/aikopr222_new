import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function AdminServices() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterActive, setFilterActive] = useState('all')

  const queryClient = useQueryClient()

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['admin-services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) throw error
      return data || []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('services')
        .update({ active: false })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services'])
      toast.success('Servicio desactivado')
    },
    onError: (error) => {
      toast.error('Error al desactivar servicio')
      console.error(error)
    },
  })
  const permanentDeleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services'])
      queryClient.invalidateQueries(['services'])
      queryClient.invalidateQueries(['promotions'])
      queryClient.invalidateQueries(['hero-promotions'])
      toast.success('Servicio eliminado')
    },
    onError: (error) => {
      toast.error('Error al eliminar servicio')
      console.error(error)
    },
  })

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, featured }) => {
      // If setting to featured, unfeature all others first
      if (featured) {
        await supabase
          .from('services')
          .update({ featured: false })
          .neq('id', id)
      }

      const { error } = await supabase
        .from('services')
        .update({ featured })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-services'])
      toast.success('Servicio destacado actualizado')
    },
    onError: (error) => {
      toast.error('Error al actualizar servicio destacado')
      console.error(error)
    },
  })

  const filteredServices = services.filter((service) => {
    if (filterCategory !== 'all' && service.category !== filterCategory) return false
    if (filterActive === 'active' && !service.active) return false
    if (filterActive === 'inactive' && service.active) return false
    return true
  })

  const handleEdit = (service) => {
    setEditingService(service)
    setIsModalOpen(true)
  }

  const handleNew = () => {
    setEditingService(null)
    setIsModalOpen(true)
  }

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de desactivar este servicio?')) {
      deleteMutation.mutate(id)
    }
  }

  const handlePermanentDelete = (id) => {
    if (
      confirm(
        'Esto eliminará el servicio de forma permanente. Las promociones vinculadas también pueden eliminarse. ¿Continuar?'
      )
    ) {
      permanentDeleteMutation.mutate(id)
    }
  }

  const handleToggleFeatured = (id, currentFeatured) => {
    toggleFeaturedMutation.mutate({ id, featured: !currentFeatured })
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container py-8 sm:py-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-ink-dark mb-2">Gestión de Servicios</h1>
            <p className="text-ink-light">Administra los servicios del negocio</p>
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
              + Nuevo Servicio
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 sm:p-6 mb-6 shadow-md">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Categoría</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <option value="all">Todas</option>
                <option value="estetica-avanzada">Estética Avanzada</option>
                <option value="domicilio">Exclusivos a Domicilio</option>
                <option value="depilacion">Depilación Láser</option>
                <option value="faciales">Faciales</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Estado</label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Services List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-ink-light">Cargando servicios...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-ink-light">No hay servicios que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-lg p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-serif text-xl text-ink-dark">{service.name}</h3>
                      {service.featured && (
                        <span className="px-2 py-1 luxuryBadge text-xs uppercase rounded">
                          Destacado
                        </span>
                      )}
                      {!service.active && (
                        <span className="px-2 py-1 bg-ink-light/20 text-ink-light text-xs uppercase rounded">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-ink-light text-sm mb-2">{service.description}</p>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
                      <span className="text-gold font-semibold">${service.price}</span>
                      {service.duration && <span className="text-ink-light">{service.duration}</span>}
                      <span className="text-ink-light capitalize">{service.category}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2 w-full xl:w-auto">
                    <button
                      onClick={() => handleEdit(service)}
                      className="px-4 py-2 border border-border-md rounded-md text-sm font-semibold uppercase tracking-wider hover:border-gold hover:text-gold transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleFeatured(service.id, service.featured)}
                      className={`px-4 py-2 border rounded-md text-sm font-semibold uppercase tracking-wider transition-colors ${
                        service.featured
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-border-md hover:border-gold hover:text-gold'
                      }`}
                    >
                      {service.featured ? 'Quitar Destacado' : 'Destacar'}
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="px-4 py-2 border border-error/30 text-error rounded-md text-sm font-semibold uppercase tracking-wider hover:bg-error/10 transition-colors"
                    >
                      Desactivar
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(service.id)}
                      className="px-4 py-2 bg-error text-white rounded-md text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <ServiceModal
            service={editingService}
            onClose={() => {
              setIsModalOpen(false)
              setEditingService(null)
            }}
            onSuccess={() => {
              setIsModalOpen(false)
              setEditingService(null)
              queryClient.invalidateQueries(['admin-services'])
            }}
          />
        )}
      </div>
    </div>
  )
}

function ServiceModal({ service, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: service?.name || '',
    category: service?.category || 'estetica-avanzada',
    description: service?.description || '',
    price: service?.price || '',
    duration: service?.duration || '',
    notes: service?.notes || '',
    active: service?.active ?? true,
    display_order: service?.display_order || 0,
    featured: service?.featured || false,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(service?.image_url || null)
  const [videoUrl, setVideoUrl] = useState(service?.video_url || '')
  const [uploading, setUploading] = useState(false)

  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (service) {
        const { error } = await supabase
          .from('services')
          .update(data)
          .eq('id', service.id)
        if (error) throw error
      } else {
        // If setting as featured, unfeature all others first
        if (data.featured) {
          await supabase
            .from('services')
            .update({ featured: false })
        }

        const { error } = await supabase
          .from('services')
          .insert([data])
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(service ? 'Servicio actualizado' : 'Servicio creado')
      queryClient.invalidateQueries(['admin-services'])
      queryClient.invalidateQueries(['services'])
      onSuccess()
    },
    onError: (error) => {
      toast.error('Error al guardar servicio')
      console.error(error)
    },
  })

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async () => {
    if (!imageFile) return formData.image_url

    setUploading(true)
    try {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `services/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(filePath, imageFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('service-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Error al subir imagen')
      throw error
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)

    try {
      let imageUrl = formData.image_url
      if (imageFile) {
        imageUrl = await uploadImage()
      }

      const dataToSave = {
        ...formData,
        price: parseFloat(formData.price),
        image_url: imageUrl,
        video_url: videoUrl || null,
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
        className="bg-white rounded-lg max-w-3xl w-full max-h-[94vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
          <h2 className="font-serif text-xl sm:text-2xl text-ink-dark">
            {service ? 'Editar Servicio' : 'Nuevo Servicio'}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-light hover:text-ink text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Nombre del Servicio *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Categoría *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <option value="estetica-avanzada">Estética Avanzada</option>
                <option value="domicilio">Exclusivos a Domicilio</option>
                <option value="depilacion">Depilación Láser</option>
                <option value="faciales">Faciales</option>
              </select>
            </div>
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

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Precio *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Duración</label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="45-60 min"
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Orden de Visualización</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Imagen</label>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-48 object-cover rounded-md mb-2"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">URL de Video</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 text-gold focus:ring-gold"
              />
              <span className="text-sm text-ink">Servicio activo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 text-gold focus:ring-gold"
              />
              <span className="text-sm text-ink">Servicio destacado (de la semana)</span>
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
              disabled={uploading}
              className="flex-1 btnPrimary py-3 px-6 rounded-full text-sm uppercase tracking-wider font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {uploading ? 'Guardando...' : service ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
