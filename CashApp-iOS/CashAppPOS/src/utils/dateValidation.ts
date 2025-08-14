/**
 * Date validation and parsing utilities
 * Safely handles dates from backend that might be null, undefined, or invalid
 */

import { logger } from './logger';

/**
 * Safely parse a date from various input formats
 * @param dateInput - Can be Date, string, number, null, or undefined
 * @param fieldName - Name of the field for logging
 * @returns Date object or null if invalid/missing
 */
export function parseDate(
  dateInput: Date | string | number | null | undefined,
  fieldName: string = 'date'
): Date | null {
  if (!dateInput) {
    logger.debug(`${fieldName} is null or undefined`);
    return null;
  }

  try {
    let date: Date;

    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // Handle ISO strings and other formats
      date = new Date(dateInput);
    } else if (typeof dateInput === 'number') {
      // Unix timestamp
      date = new Date(dateInput);
    } else {
      logger.warn(`${fieldName} has unexpected type: ${typeof dateInput}`);
      return null;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      logger.warn(`${fieldName} is invalid date: ${dateInput}`);
      return null;
    }

    // Check for unrealistic dates (e.g., year 1970 or before)
    if (date.getFullYear() < 1970) {
      logger.warn(`${fieldName} has unrealistic year: ${date.getFullYear()}`);
      return null;
    }

    return date;
  } catch (error) {
    logger.error(`Error parsing ${fieldName}:`, error);
    return null;
  }
}

/**
 * Format a date safely with fallback
 * @param date - Date to format
 * @param fallback - String to return if date is invalid
 * @param locale - Locale for formatting (default 'en-GB')
 * @returns Formatted date string or fallback
 */
export function formatDateSafely(
  date: Date | null | undefined,
  fallback: string = 'N/A',
  locale: string = 'en-GB'
): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return fallback;
  }

  try {
    return date.toLocaleDateString(locale);
  } catch (error) {
    logger.error('Error formatting date:', error);
    return fallback;
  }
}

/**
 * Format date and time safely
 * @param date - Date to format
 * @param fallback - String to return if date is invalid
 * @param locale - Locale for formatting (default 'en-GB')
 * @returns Formatted date and time string or fallback
 */
export function formatDateTimeSafely(
  date: Date | null | undefined,
  fallback: string = 'N/A',
  locale: string = 'en-GB'
): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return fallback;
  }

  try {
    return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale)}`;
  } catch (error) {
    logger.error('Error formatting datetime:', error);
    return fallback;
  }
}

/**
 * Calculate relative time (e.g., "2 days ago")
 * @param date - Date to compare
 * @param fallback - String to return if date is invalid
 * @returns Relative time string or fallback
 */
export function getRelativeTime(
  date: Date | null | undefined,
  fallback: string = 'Never'
): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return fallback;
  }

  try {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch (error) {
    logger.error('Error calculating relative time:', error);
    return fallback;
  }
}

/**
 * Validate and transform employee data from backend
 * @param employee - Raw employee data from API
 * @returns Employee data with validated dates
 */
export function validateEmployeeData(employee: any): any {
  return {
    ...employee,
    hireDate: parseDate(employee.hireDate || employee.hire_date || employee.start_date || employee.created_at, 'hireDate'),
    lastReview: parseDate(employee.lastReview || employee.last_review, 'lastReview'),
    createdAt: parseDate(employee.created_at, 'createdAt'),
    updatedAt: parseDate(employee.updated_at, 'updatedAt'),
  };
}

/**
 * Validate and transform customer data from backend
 * @param customer - Raw customer data from API
 * @returns Customer data with validated dates
 */
export function validateCustomerData(customer: any): any {
  return {
    ...customer,
    joinedDate: parseDate(customer.joinedDate || customer.joined_date || customer.created_at, 'joinedDate'),
    lastVisit: parseDate(customer.lastVisit || customer.last_visit || customer.last_order_date, 'lastVisit'),
    birthDate: parseDate(customer.birthDate || customer.birth_date, 'birthDate'),
    createdAt: parseDate(customer.created_at, 'createdAt'),
    updatedAt: parseDate(customer.updated_at, 'updatedAt'),
  };
}

/**
 * Validate and transform order data from backend
 * @param order - Raw order data from API
 * @returns Order data with validated dates
 */
export function validateOrderData(order: any): any {
  return {
    ...order,
    date: parseDate(order.date || order.created_at, 'orderDate'),
    completedAt: parseDate(order.completed_at, 'completedAt'),
    deliveredAt: parseDate(order.delivered_at, 'deliveredAt'),
    createdAt: parseDate(order.created_at, 'createdAt'),
    updatedAt: parseDate(order.updated_at, 'updatedAt'),
  };
}