// Función para formatear CLP (Peso Chileno)
export const formatCLP = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '$0';
  }
  
  // Formatear con separador de miles y símbolo $
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
};

// Función para formatear CLP sin el símbolo de currency (solo el número)
export const formatCLPNumber = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '0';
  }
  
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
};

// Función para parsear CLP de string a número
export const parseCLP = (clpString: string): number => {
  // Remover símbolos y espacios, reemplazar comas por puntos si es necesario
  const cleanString = clpString.replace(/[$.\s]/g, '').replace(',', '.');
  return parseFloat(cleanString) || 0;
};

// Función para validar que un monto sea válido en CLP
export const isValidCLPAmount = (amount: number): boolean => {
  return !isNaN(amount) && amount >= 0 && amount <= 999999999;
};

// Función para obtener el símbolo de CLP
export const getCLPSymbol = (): string => {
  return '$';
};

// Función para formatear porcentaje chileno
export const formatPercentage = (percentage: number): string => {
  return `${percentage}%`;
};