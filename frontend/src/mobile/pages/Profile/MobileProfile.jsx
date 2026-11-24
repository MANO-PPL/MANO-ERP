import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Loader2,
  X,
  Edit,
  Trash2,
  Copy,
  Check,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { profileApi } from '../../../services/profileApi';
import { customToast } from '../../../utils/toast';
import ConfirmModal from '../../../components/ConfirmModal';
import { compressImage } from '../../../utils/imageCompressor';

export default function MobileProfile() {
  const navigate = useNavigate();
  const { user: authUser, refreshUser, logout } = useAuth();

  const [profileData, setProfileData] = useState(authUser || null);
  const [loading, setLoading] = useState(!authUser);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());
  const [copiedKey, setCopiedKey] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Modals
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setImageError(false);
  }, [profileData?.profile_image_url, authUser?.profile_image_url, imageTimestamp]);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await profileApi.getMyProfile();
        if (res?.user && isMounted) {
          setProfileData(res.user);
        }
      } catch (err) {
        console.error('Failed to load mobile profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (authUser) {
      setProfileData((prev) => ({ ...prev, ...authUser }));
    }
  }, [authUser]);

  const getAvatarUrl = (rawUrl) => {
    if (!rawUrl) return null;
    if (rawUrl.includes('X-Amz-Signature') || rawUrl.includes('Signature=')) {
      return rawUrl;
    }
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}t=${imageTimestamp}`;
  };

  const user = {
    id: profileData?.id || authUser?.id,
    name: profileData?.user_name || authUser?.user_name || '',
    role: profileData?.user_type || authUser?.user_type || '',
    email: profileData?.email || authUser?.email || '',
    phone: profileData?.phone_no || authUser?.phone_no || '',
    department: profileData?.dept_name || authUser?.dept_name || '',
    designation: profileData?.desg_name || authUser?.desg_name || '',
    employeeCode: profileData?.user_code || authUser?.user_code || '',
    avatar: getAvatarUrl(profileData?.profile_image_url || authUser?.profile_image_url),
    systemPermissions: profileData?.system_permissions || authUser?.system_permissions || {}
  };

  const getInitials = (name) => {
    return String(name || 'User')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const handleCopy = (text, key) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    customToast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAvatarClick = () => {
    if (user.avatar) {
      setShowPreview(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      customToast.error('Please select an image file (JPEG, PNG, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      customToast.error('Image exceeds 10MB limit');
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.85 });
      const formData = new FormData();
      formData.append('avatar', compressed);

      const res = await profileApi.uploadProfilePicture(formData);
      if (res?.ok || res?.success || res?.profile_image_url) {
        customToast.success('Profile picture updated!');
        setImageTimestamp(Date.now());
        setImageError(false);
        setProfileData((prev) => ({
          ...prev,
          profile_image_url: res.profile_image_url || res.url
        }));
        await refreshUser();
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
      customToast.error(err.response?.data?.message || 'Failed to update profile picture');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setIsRemovingAvatar(true);
    try {
      const res = await profileApi.deleteProfilePicture();
      if (res?.ok || res?.success) {
        customToast.success('Profile picture removed');
        setImageTimestamp(Date.now());
        setProfileData((prev) => ({ ...prev, profile_image_url: null }));
        setShowPreview(false);
        await refreshUser();
      }
    } catch (err) {
      console.error('Error removing avatar:', err);
      customToast.error(err.response?.data?.message || 'Failed to remove profile picture');
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] w-full">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 pb-20 font-sans">
      {/* Header Profile Info (Full Width) */}
      <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-3.5 bg-white dark:bg-[#0d1117]">
        <div className="relative shrink-0">
          <div
            onClick={handleAvatarClick}
            className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200/50 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl font-bold overflow-hidden cursor-pointer"
          >
            {user.avatar && !imageError ? (
              <img
                key={user.avatar}
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span>{getInitials(user.name)}</span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center border border-white dark:border-[#0d1117] shadow-xs active:scale-95"
            aria-label="Change photo"
          >
            {uploading ? <Loader2 className="animate-spin" size={11} /> : <Camera size={11} />}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">
            {user.name}
          </h1>
        </div>
      </div>

      {/* Section 1: Employee Details (Flat Rows, Full Width) */}
      <div className="p-4 border-b border-gray-200 dark:border-white/10 space-y-3 bg-white dark:bg-[#0d1117]">
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Employee Details
        </h2>

        <div className="space-y-2.5 text-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Email</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{user.email || '—'}</span>
                {user.email && (
                  <button type="button" onClick={() => handleCopy(user.email, 'email')} className="text-gray-400 hover:text-blue-600 p-0.5">
                    {copiedKey === 'email' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Phone</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{user.phone || '—'}</span>
                {user.phone && (
                  <button type="button" onClick={() => handleCopy(user.phone, 'phone')} className="text-gray-400 hover:text-blue-600 p-0.5">
                    {copiedKey === 'phone' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {user.department && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Department</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{user.department}</span>
            </div>
          )}

          {user.designation && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Designation</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{user.designation}</span>
            </div>
          )}

          {user.employeeCode && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Employee Code</span>
              <span className="font-semibold font-mono text-gray-800 dark:text-gray-200">{user.employeeCode}</span>
            </div>
          )}
        </div>
      </div>

      {/* Account Actions */}
      <div className="p-4 space-y-2.5">
        <button
          type="button"
          onClick={() => setConfirmLogoutOpen(true)}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 text-xs font-bold text-red-600 dark:text-red-400 shadow-2xs active:bg-red-100 dark:active:bg-red-900/40"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* --- PREVIEW MODAL --- */}
      {showPreview && user.avatar && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="w-full max-w-sm flex items-center justify-between pb-4">
            <h3 className="text-sm font-bold text-white">Profile Photo</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploading || isRemovingAvatar}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="px-2 py-1 rounded-md bg-white/10 text-white text-xs font-semibold disabled:opacity-50"
              >
                {uploading ? 'Updating...' : 'Replace'}
              </button>
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isRemovingAvatar}
                className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-xs font-semibold disabled:opacity-50"
              >
                {isRemovingAvatar ? 'Removing...' : 'Remove'}
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="p-1 text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-sm bg-black rounded-xl overflow-hidden flex items-center justify-center max-h-[70vh] min-h-[200px]">
            {uploading && (
              <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-blue-500" size={28} />
                <span className="text-xs font-semibold text-white">Updating photo...</span>
              </div>
            )}
            <img
              key={user.avatar}
              src={user.avatar}
              alt="Profile"
              className="w-full h-auto max-h-[65vh] object-contain transition-opacity duration-200"
            />
          </div>
        </div>,
        document.body
      )}

      {/* --- CONFIRM LOGOUT MODAL --- */}
      <ConfirmModal
        isOpen={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={async () => {
          setConfirmLogoutOpen(false);
          await logout();
        }}
        title="Sign Out?"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
