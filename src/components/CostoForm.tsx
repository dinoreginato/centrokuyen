import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSucursal } from '@/contexts/SucursalContext';
import { Costo } from '@/types/database';
import { costosService } from '@/utils/supabase';

interface CostoFormProps {
  costo?: Costo;
  onSuccess: () => void;
  onCancel: () => void;
}

interface CostoFormData {
  tipo: 'fijo' | 'variable';
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
  recurrente: boolean;
}

const CATEGORIAS_FIJAS = [
  'Alquiler',
  'Servicios básicos',
  'Seguros',
  'Mantenimiento',
  'Equipamiento',
  'Software',
  'Salarios',
  'Otros fijos'
];

const CATEGORIAS_VARIABLES = [
  'Materiales médicos',
  'Medicamentos',
  'Gastos de oficina',
  'Marketing',
  'Transporte',
  'Capacitación',
  'Eventos',
  'Otros variables'
];

export default function CostoForm({ costo, onSuccess, onCancel }: CostoFormProps) {
  const { currentSucursal } = useSucursal();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CostoFormData>({
    defaultValues: costo ? {
      tipo: costo.tipo,
      categoria: costo.categoria,
      descripcion: costo.descripcion,
      monto: costo.monto,
      fecha: costo.fecha,
      recurrente: costo.recurrente
    } : {
      tipo: 'fijo',
      categoria: '',
      descripcion: '',
      monto: 0,
      fecha: new Date().toISOString().split('T')[0],
      recurrente: false
    }
  });

  const tipoSeleccionado = watch('tipo');

  const onSubmit = async (data: CostoFormData) => {
    if (!currentSucursal) {
      toast.error('No hay sucursal activa seleccionada');
      return;
    }

    try {
      const dataToSave = { ...data, sucursal_id: currentSucursal.id };
      
      if (costo) {
        await costosService.update(costo.id, dataToSave);
        toast.success('Costo actualizado exitosamente');
      } else {
        await costosService.create(dataToSave);
        toast.success('Costo creado exitosamente');
      }
      onSuccess();
    } catch (error) {
      toast.error('Error al guardar el costo');
      console.error('Error:', error);
    }
  };

  const categorias = tipoSeleccionado === 'fijo' ? CATEGORIAS_FIJAS : CATEGORIAS_VARIABLES;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {costo ? 'Editar Costo' : 'Nuevo Costo'}
        </h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Costo
            </label>
            <select
              {...register('tipo', { required: 'El tipo es requerido' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fijo">Costo Fijo</option>
              <option value="variable">Costo Variable</option>
            </select>
            {errors.tipo && (
              <p className="text-red-500 text-sm mt-1">{errors.tipo.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              {...register('categoria', { required: 'La categoría es requerida' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccione una categoría</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.categoria && (
              <p className="text-red-500 text-sm mt-1">{errors.categoria.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              {...register('descripcion', { required: 'La descripción es requerida' })}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descripción detallada del costo..."
            />
            {errors.descripcion && (
              <p className="text-red-500 text-sm mt-1">{errors.descripcion.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto ($)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('monto', { 
                required: 'El monto es requerido',
                min: { value: 0, message: 'El monto debe ser mayor a 0' }
              })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
            {errors.monto && (
              <p className="text-red-500 text-sm mt-1">{errors.monto.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              {...register('fecha', { required: 'La fecha es requerida' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.fecha && (
              <p className="text-red-500 text-sm mt-1">{errors.fecha.message}</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              {...register('recurrente')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Es un costo recurrente
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {costo ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}