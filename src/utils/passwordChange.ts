import { supabase } from '../lib/supabase';

export interface PasswordChangeResult {
  success: boolean;
  message: string;
}

export async function changeAdminPassword(
  token: string,
  oldPassword: string,
  newPassword: string
): Promise<PasswordChangeResult> {
  try {
    const { data, error } = await supabase.rpc('change_admin_password', {
      p_token: token,
      p_old_password: oldPassword,
      p_new_password: newPassword,
    });

    if (error) {
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
      success: result.success,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to change password',
    };
  }
}

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): boolean {
  return password === confirmPassword && password.length > 0;
}
