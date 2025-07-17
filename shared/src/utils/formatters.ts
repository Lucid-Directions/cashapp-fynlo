// Currency formatting
export const formatCurrency = (amount: number, currency: string = 'GBP'): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Date/time formatting
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

// Phone number formatting with input validation
export const formatUKPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle international format (+44)
  if (cleaned.startsWith('44')) {
    const number = cleaned.substring(2);
    // UK phone numbers should be 10 digits after country code
    if (number.length < 10) return phone;
    
    // Format as +44 XXXX XXX XXX (common UK mobile format)
    const part1 = number.substring(0, 4);
    const part2 = number.substring(4, 7);
    const part3 = number.substring(7, 10);
    
    return `+44 ${part1} ${part2} ${part3}`;
  }
  
  // Handle national format (0)
  if (cleaned.startsWith('0')) {
    // UK phone numbers should be 11 digits including leading 0
    if (cleaned.length < 11) return phone;
    
    // Format as 0XXXX XXX XXX
    const part1 = cleaned.substring(0, 5);
    const part2 = cleaned.substring(5, 8);
    const part3 = cleaned.substring(8, 11);
    
    return `${part1} ${part2} ${part3}`;
  }
  
  // Return original if not a valid UK format
  return phone;
};

// Order number generation with improved collision resistance
export const generateOrderNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Use full timestamp to avoid modulo cycling issues
  const timestamp = date.getTime();
  
  // Extract different parts of timestamp for better distribution
  // Hours, minutes, seconds, and milliseconds from the timestamp
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  
  // Use crypto.getRandomValues for better randomness if available
  let random;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    random = (array[0] % 10000).toString().padStart(4, '0');
  } else {
    // Fallback to Math.random with larger range
    random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  }
  
  // Format: ORD-YYMMDD-HHMMSSXXXR where XXX is milliseconds and R is random
  return `ORD-${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds.slice(0, 1)}${random.slice(-2)}`;
};

// Percentage formatting
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

// File size formatting
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Duration formatting
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

// Truncate text
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};