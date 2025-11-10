import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { changeAdminPassword, validatePassword, validatePasswordMatch } from '../utils/passwordChange';

interface ChangePasswordFormProps {
  token: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function ChangePasswordForm({
  token,
  onSuccess,
  onError,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  function validateForm(): boolean {
    const errors: string[] = [];

    if (!currentPassword) {
      errors.push('Current password is required');
    }

    const newPasswordValidation = validatePassword(newPassword);
    if (!newPasswordValidation.valid) {
      errors.push(...newPasswordValidation.errors);
    }

    if (!validatePasswordMatch(newPassword, confirmPassword)) {
      errors.push('New passwords do not match');
    }

    if (currentPassword === newPassword) {
      errors.push('New password must be different from current password');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setValidationErrors([]);

    try {
      const result = await changeAdminPassword(token, currentPassword, newPassword);

      if (result.success) {
        onSuccess();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        onError(result.message);
      }
    } catch (err: any) {
      onError(err?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current Password
        </label>
        <div className="relative">
          <input
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 pr-12 border-2 rounded-xl border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6] transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            disabled={loading}
            className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {showCurrentPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          New Password
        </label>
        <div className="relative">
          <input
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 pr-12 border-2 rounded-xl border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6] transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            disabled={loading}
            className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {showNewPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm New Password
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 pr-12 border-2 rounded-xl border-[#C9A9A6]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A9A6]/40 focus:border-[#C9A9A6] transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={loading}
            className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {showConfirmPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <ul className="space-y-1">
            {validationErrors.map((error, idx) => (
              <li key={idx} className="text-sm text-rose-700">
                • {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
        className="w-full bg-gradient-to-r from-[#EAC7C7] to-[#C9A9A6] text-white py-3 rounded-xl font-semibold hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        <Lock className="w-4 h-4" />
        {loading ? 'Changing password...' : 'Change Password'}
      </button>
    </form>
  );
}
