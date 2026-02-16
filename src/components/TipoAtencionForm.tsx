import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { TipoAtencion } from '../types/database';
import { tiposAtencionService } from '../utils/supabase';
import { useSucursal } from '@/contexts/SucursalContext';

interface TipoAtencionFormProps {
  tipo?: TipoAtencion;
  onSuccess: () => void;
  onCancel: () => void;
}

interface TipoAtencionFormData {
  nombre: string;
  valor_base: number;
  descripcion: string;
  activo: boolean;
}

export default function TipoAtencionForm({ tipo, onSuccess, onCancel }: TipoAtencionFormProps) {
  const { currentSucursal } = useSucursal()
  const { register, handleSubmit, formState: { errors } } = useForm<TipoAtencionFormData>({
    defaultValues: tipo ? {
      nombre: tipo.nombre,
      valor_base: tipo.valor_base,
      descripcion: tipo.descripcion,
      activo: tipo.activo
    } : {
      nombre: '',
      valor_base: 0,
      descripcion: '',
      activo: true
    }
  });

  const onSubmit = async (data: TipoAtencionFormData) => {
    // Asegurar que el valor base sea un número válido
    const dataToSend = {
      ...data,
      valor_base: Number(data.valor_base)
    };
    
    console.log('Enviando datos:', dataToSend);

    try {
      if (tipo) {
        await tiposAtencionService.update(tipo.id, dataToSend);
        toast.success('Tipo de atención actualizado exitosamente');
      } else {
        await tiposAtencionService.create({
          ...dataToSend,
          sucursal_id: currentSucursal?.id
        });
        toast.success('Tipo de atención creado exitosamente');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error detallado al guardar:', error);
      const errorMessage = error?.message || error?.error_description || 'Error desconocido';
      toast.error(`Error al guardar: ${errorMessage}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {tipo ? 'Editar Tipo de Atención' : 'Nuevo Tipo de Atención'}
        </h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Tipo *
            </label>
            <input
              type="text"
              {...register('nombre', { required: 'El nombre es requerido' })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Consulta General, Control, etc."
            />
            {errors.nombre && (
              <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Base ($) *
            </label>
            <input
              type="number"
              step="0.01"
              {...register('valor_base', { 
                valueAsNumber: true,
                required: 'El valor base es requerido',
                min: { value: 0, message: 'El valor debe ser mayor a 0' }
              })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
            {errors.valor_base && (
              <p className="text-red-500 text-sm mt-1">{errors.valor_base.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              {...register('descripcion')}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descripción del tipo de atención..."
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              {...register('activo')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Tipo de atención activo
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
              {tipo ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}