import { AccessibilityRole, AccessibilityState, AccessibilityProps } from 'react-native';

// Accessibility utility functions and constants

// Common accessibility roles for POS system components
export const ACCESSIBILITY_ROLES = {
  BUTTON: 'button' as AccessibilityRole,
  HEADER: 'header' as AccessibilityRole,
  TEXT: 'text' as AccessibilityRole,
  IMAGE: 'image' as AccessibilityRole,
  LINK: 'link' as AccessibilityRole,
  SEARCH: 'search' as AccessibilityRole,
  TAB: 'tab' as AccessibilityRole,
  TAB_LIST: 'tablist' as AccessibilityRole,
  MENU: 'menu' as AccessibilityRole,
  MENU_ITEM: 'menuitem' as AccessibilityRole,
  LIST: 'list' as AccessibilityRole,
  LIST_ITEM: 'none' as AccessibilityRole, // Use 'none' for list items to avoid redundancy
  CHECKBOX: 'checkbox' as AccessibilityRole,
  RADIO: 'radio' as AccessibilityRole,
  SWITCH: 'switch' as AccessibilityRole,
  PROGRESS_BAR: 'progressbar' as AccessibilityRole,
  SUMMARY: 'summary' as AccessibilityRole,
  TOOLBAR: 'toolbar' as AccessibilityRole,
} as const;

// Accessibility state helpers
export const createAccessibilityState = (options: {
  selected?: boolean;
  disabled?: boolean;
  checked?: boolean;
  expanded?: boolean;
  busy?: boolean;
}): AccessibilityState => {
  const state: AccessibilityState = {};

  if (options.selected !== undefined) {
    state.selected = options.selected;
  }
  if (options.disabled !== undefined) {
    state.disabled = options.disabled;
  }
  if (options.checked !== undefined) {
    state.checked = options.checked;
  }
  if (options.expanded !== undefined) {
    state.expanded = options.expanded;
  }
  if (options.busy !== undefined) {
    state.busy = options.busy;
  }

  return state;
};

// Currency formatting for screen readers
export const formatCurrencyForAccessibility = (amount: number, currency = 'GBP'): string => {
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  });

  return formatter.format(amount).replace('£', 'pounds ');
};

// Format numbers for screen readers
export const formatNumberForAccessibility = (num: number): string => {
  return num.toLocaleString('en-GB');
};

// Create accessible label for form fields
export const createFieldLabel = (label: string, required = false, error?: string): string => {
  let accessibleLabel = label;

  if (required) {
    accessibleLabel += ', required';
  }

  if (error) {
    accessibleLabel += `, error: ${error}`;
  }

  return accessibleLabel;
};

// Create accessible hint for form fields
export const createFieldHint = (helper?: string, format?: string): string | undefined => {
  const hints: string[] = [];

  if (helper) {
    hints.push(helper);
  }
  if (format) {
    hints.push(`Format: ${format}`);
  }

  return hints.length > 0 ? hints.join('. ') : undefined;
};

// Common accessibility props for buttons
export const createButtonAccessibility = (options: {
  label: string;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  role?: AccessibilityRole;
}): AccessibilityProps => {
  return {
    accessible: true,
    accessibilityRole: options.role || ACCESSIBILITY_ROLES.BUTTON,
    accessibilityLabel: options.label,
    accessibilityHint: options.hint,
    accessibilityState: createAccessibilityState({
      disabled: options.disabled || options.loading,
      busy: options.loading,
    }),
  };
};

// Common accessibility props for form inputs
export const createInputAccessibility = (options: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  value?: string;
}): AccessibilityProps => {
  return {
    accessible: true,
    accessibilityLabel: createFieldLabel(options.label, options.required, options.error),
    accessibilityHint: options.hint,
    accessibilityValue: options.value ? { text: options.value } : undefined,
  };
};

// Common accessibility props for menu items
export const createMenuItemAccessibility = (options: {
  label: string;
  price?: number;
  description?: string;
  selected?: boolean;
  index?: number;
  total?: number;
}): AccessibilityProps => {
  let label = options.label;

  if (options.price !== undefined) {
    label += `, ${formatCurrencyForAccessibility(options.price)}`;
  }

  let hint = options.description;

  if (options.index !== undefined && options.total !== undefined) {
    const position = `Item ${options.index + 1} of ${options.total}`;
    hint = hint ? `${hint}. ${position}` : position;
  }

  return {
    accessible: true,
    accessibilityRole: ACCESSIBILITY_ROLES.BUTTON,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: createAccessibilityState({
      selected: options.selected,
    }),
  };
};

// Common accessibility props for list items
export const createListItemAccessibility = (options: {
  title: string;
  subtitle?: string;
  value?: string;
  index?: number;
  total?: number;
  onPress?: () => void;
}): AccessibilityProps => {
  let label = options.title;

  if (options.subtitle) {
    label += `, ${options.subtitle}`;
  }

  if (options.value) {
    label += `, ${options.value}`;
  }

  let hint: string | undefined;

  if (options.index !== undefined && options.total !== undefined) {
    hint = `Item ${options.index + 1} of ${options.total}`;
  }

  if (options.onPress) {
    hint = hint ? `${hint}. Double tap to select` : 'Double tap to select';
  }

  return {
    accessible: true,
    accessibilityRole: options.onPress ? ACCESSIBILITY_ROLES.BUTTON : ACCESSIBILITY_ROLES.TEXT,
    accessibilityLabel: label,
    accessibilityHint: hint,
  };
};

// Accessibility props for tabs
export const createTabAccessibility = (options: {
  label: string;
  selected: boolean;
  index: number;
  total: number;
}): AccessibilityProps => {
  const hint = `Tab ${options.index + 1} of ${options.total}`;

  return {
    accessible: true,
    accessibilityRole: ACCESSIBILITY_ROLES.TAB,
    accessibilityLabel: options.label,
    accessibilityHint: hint,
    accessibilityState: createAccessibilityState({
      selected: options.selected,
    }),
  };
};

// Accessibility props for modal dialogs
export const createModalAccessibility = (options: {
  title?: string;
  description?: string;
}): AccessibilityProps => {
  return {
    accessible: true,
    accessibilityRole: 'none',
    accessibilityLabel: options.title,
    accessibilityHint: options.description,
    accessibilityViewIsModal: true,
  };
};

// Accessibility announcement helper
export const announceForAccessibility = (message: string) => {
  // This would typically use AccessibilityInfo.announceForAccessibility
  // but that's only available in React Native, not in TypeScript files
  console.log(`Accessibility announcement: ${message}`);
};

// Screen reader optimized time formatting
export const formatTimeForAccessibility = (date: Date): string => {
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `${timeFormatter.format(date)} on ${dateFormatter.format(date)}`;
};

// Percentage formatting for screen readers
export const formatPercentageForAccessibility = (percentage: number): string => {
  return `${percentage} percent`;
};

// Error message formatting for accessibility
export const formatErrorForAccessibility = (error: string): string => {
  return `Error: ${error}`;
};

// Success message formatting for accessibility
export const formatSuccessForAccessibility = (message: string): string => {
  return `Success: ${message}`;
};

export default {
  ACCESSIBILITY_ROLES,
  createAccessibilityState,
  formatCurrencyForAccessibility,
  formatNumberForAccessibility,
  createFieldLabel,
  createFieldHint,
  createButtonAccessibility,
  createInputAccessibility,
  createMenuItemAccessibility,
  createListItemAccessibility,
  createTabAccessibility,
  createModalAccessibility,
  announceForAccessibility,
  formatTimeForAccessibility,
  formatPercentageForAccessibility,
  formatErrorForAccessibility,
  formatSuccessForAccessibility,
};
