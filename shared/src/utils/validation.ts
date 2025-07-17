// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// UK phone number validation
export const isValidUKPhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\s/g, '');
  const ukPhoneRegex = /^(\+44|0)[1-9]\d{9,10}$/;
  return ukPhoneRegex.test(cleanPhone);
};

// Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
export const isValidPassword = (password: string): boolean => {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password);
};

// Postcode validation (UK)
export const isValidUKPostcode = (postcode: string): boolean => {
  const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;
  return postcodeRegex.test(postcode);
};

// Amount validation (positive number with up to 2 decimal places)
export const isValidAmount = (amount: number): boolean => {
  if (amount < 0) return false;
  
  // Check decimal places by converting to string to avoid floating-point precision issues
  const amountStr = amount.toString();
  const decimalIndex = amountStr.indexOf('.');
  
  // If no decimal point, it's valid
  if (decimalIndex === -1) return true;
  
  // Check if there are more than 2 decimal places
  const decimalPlaces = amountStr.length - decimalIndex - 1;
  return decimalPlaces <= 2;
};

// Order number validation - matches format: ORD-YYMMDD-XXXXXXXXX
export const isValidOrderNumber = (orderNumber: string): boolean => {
  const orderRegex = /^ORD-\d{6}-\d{9}$/;
  return orderRegex.test(orderNumber);
};

// Restaurant ID validation (UUID v4)
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Time format validation (HH:MM)
export const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
};

// Table number validation
export const isValidTableNumber = (tableNumber: string): boolean => {
  return /^[A-Z0-9]+$/i.test(tableNumber) && tableNumber.length <= 10;
};