export function formatModificationPrice(price: number): string {
  if (price === 0) return '';
  
  // Fix: Don't show negative sign for negative prices
  const absPrice = Math.abs(price);
  const roundedPrice = Math.round(absPrice * 100) / 100;
  const sign = price > 0 ? '+' : '';
  
  return `${sign}$${roundedPrice.toFixed(2)}`;
}

export function calculateModificationTotal(modifications: any[]): number {
  if (!modifications || modifications.length === 0) return 0;
  
  return modifications.reduce((total, mod) => {
    const price = mod.price || 0;
    const quantity = mod.quantity || 1;
    return total + (price * quantity);
  }, 0);
}

export function validateModifications(modifications: any[]): boolean {
  if (!modifications) return false;
  
  return modifications.every(mod => {
    return mod.id && 
           typeof mod.price === 'number' &&
           (!mod.quantity || typeof mod.quantity === 'number');
  });
}
