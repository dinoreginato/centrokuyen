interface PageLoaderProps {
  label?: string
  compact?: boolean
}

const PageLoader = ({ label = 'Cargando información...', compact = false }: PageLoaderProps) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${compact ? 'h-48' : 'h-64'}`}>
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-medical-blue/15 border-t-medical-blue" />
      <p className="text-sm font-medium text-gray-500">{label}</p>
    </div>
  )
}

export default PageLoader
