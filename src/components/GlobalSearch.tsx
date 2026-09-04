import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Search, Stethoscope, UserRound, X } from 'lucide-react'
import { Atencion, Paciente, Profesional } from '@/types/database'
import { atencionesService, pacientesService, profesionalesService } from '@/utils/supabase'
import { useSucursal } from '@/contexts/SucursalContext'
import { useAuth } from '@/contexts/AuthContext'
import { hasPermission } from '@/utils/permissions'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'

const MAX_RESULTS_PER_GROUP = 5

const GlobalSearch = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentCentro, currentSucursal } = useSucursal()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [atenciones, setAtenciones] = useState<Atencion[]>([])

  const canSearchProfesionales = hasPermission(user, 'manageProfesionales')

  useEffect(() => {
    setOpen(false)
    setQuery('')
    setPacientes([])
    setProfesionales([])
    setAtenciones([])
  }, [currentCentro?.id, currentSucursal?.id])

  useEffect(() => {
    if (!open || !currentSucursal) return
    if (pacientes.length > 0 || profesionales.length > 0 || atenciones.length > 0) return

    const loadSearchData = async () => {
      try {
        setLoading(true)
        const [pacientesData, profesionalesData, atencionesData] = await Promise.all([
          pacientesService.getAll(currentSucursal?.id, currentCentro?.id),
          canSearchProfesionales ? profesionalesService.getAll(currentSucursal?.id, currentCentro?.id) : Promise.resolve([]),
          atencionesService.getAll(currentSucursal?.id, currentCentro?.id)
        ])

        setPacientes(pacientesData)
        setProfesionales(profesionalesData)
        setAtenciones(
          atencionesData.filter((item) =>
            user?.rol === 'profesional' && user.profesional_id
              ? item.profesional_id === user.profesional_id
              : true
          )
        )
      } finally {
        setLoading(false)
      }
    }

    void loadSearchData()
  }, [
    atenciones.length,
    canSearchProfesionales,
    currentCentro?.id,
    currentSucursal,
    open,
    pacientes.length,
    profesionales.length,
    user?.profesional_id,
    user?.rol
  ])

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredPacientes = useMemo(() => {
    if (!normalizedQuery) return []
    return pacientes
      .filter((item) =>
        item.nombre.toLowerCase().includes(normalizedQuery) ||
        item.rut.toLowerCase().includes(normalizedQuery) ||
        (item.telefono || '').toLowerCase().includes(normalizedQuery)
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
  }, [normalizedQuery, pacientes])

  const filteredProfesionales = useMemo(() => {
    if (!normalizedQuery || !canSearchProfesionales) return []
    return profesionales
      .filter((item) =>
        item.nombre.toLowerCase().includes(normalizedQuery) ||
        item.especialidad.toLowerCase().includes(normalizedQuery) ||
        (item.email || '').toLowerCase().includes(normalizedQuery)
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
  }, [canSearchProfesionales, normalizedQuery, profesionales])

  const filteredAtenciones = useMemo(() => {
    if (!normalizedQuery) return []
    return atenciones
      .filter((item) =>
        (item.paciente?.nombre || '').toLowerCase().includes(normalizedQuery) ||
        (item.profesional?.nombre || '').toLowerCase().includes(normalizedQuery) ||
        (item.tipos_atencion?.nombre || item.tipo_atencion || '').toLowerCase().includes(normalizedQuery) ||
        item.fecha.includes(normalizedQuery)
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
  }, [atenciones, normalizedQuery])

  const hasResults = filteredPacientes.length > 0 || filteredProfesionales.length > 0 || filteredAtenciones.length > 0

  const handleNavigate = (path: string) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div className="relative w-full xl:w-[340px]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-sm text-gray-500 transition-colors hover:bg-white hover:text-gray-700"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Buscar paciente, profesional o cita</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-slate-900/30 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por paciente, RUT, profesional, tipo de atención o fecha..."
                className="flex-1 border-0 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {loading ? (
                <PageLoader compact label="Preparando resultados..." />
              ) : !normalizedQuery ? (
                <EmptyState
                  icon={Search}
                  title="Busca en toda la operación"
                  description="Encuentra rápidamente pacientes, profesionales y citas dentro del centro y la sucursal activa."
                />
              ) : !hasResults ? (
                <EmptyState
                  icon={Search}
                  title="Sin coincidencias"
                  description="Prueba con otro nombre, RUT, teléfono, especialidad o fecha para encontrar resultados."
                />
              ) : (
                <div className="space-y-6">
                  {filteredPacientes.length > 0 && (
                    <section>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Pacientes</h3>
                      <div className="space-y-2">
                        {filteredPacientes.map((paciente) => (
                          <button
                            key={paciente.id}
                            type="button"
                            onClick={() => handleNavigate(`/pacientes/${paciente.id}`)}
                            className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-green-200 hover:bg-green-50/40"
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-green-100 p-2 text-green-700">
                                <UserRound className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{paciente.nombre}</p>
                                <p className="text-sm text-gray-500">RUT {paciente.rut} · {paciente.telefono || 'Sin teléfono'}</p>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-400">Abrir</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {filteredProfesionales.length > 0 && (
                    <section>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Profesionales</h3>
                      <div className="space-y-2">
                        {filteredProfesionales.map((profesional) => (
                          <button
                            key={profesional.id}
                            type="button"
                            onClick={() => handleNavigate(`/profesionales/${profesional.id}`)}
                            className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-200 hover:bg-blue-50/40"
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-blue-100 p-2 text-blue-700">
                                <Stethoscope className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{profesional.nombre}</p>
                                <p className="text-sm text-gray-500">{profesional.especialidad}</p>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-400">Abrir</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {filteredAtenciones.length > 0 && (
                    <section>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Citas</h3>
                      <div className="space-y-2">
                        {filteredAtenciones.map((atencion) => (
                          <Link
                            key={atencion.id}
                            to={`/agenda/${atencion.id}`}
                            onClick={() => {
                              setOpen(false)
                              setQuery('')
                            }}
                            className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-purple-200 hover:bg-purple-50/40"
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-purple-100 p-2 text-purple-700">
                                <CalendarDays className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{atencion.paciente?.nombre || 'Cita sin paciente'}</p>
                                <p className="text-sm text-gray-500">
                                  {atencion.profesional?.nombre || 'Sin profesional'} · {format(new Date(`${atencion.fecha}T00:00:00`), "dd 'de' MMMM", { locale: es })} · {atencion.hora.substring(0, 5)}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-400">{atencion.tipos_atencion?.nombre || atencion.tipo_atencion}</span>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalSearch
