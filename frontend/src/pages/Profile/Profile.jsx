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
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../services/profileApi';
import { customToast } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import { compressImage } from '../../utils/imageCompressor';

export default function Profile() {
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
        console.error('Failed to load profile:', err);
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
    // Presigned S3 URLs already contain AWS SigV4 query params (X-Amz-Signature).
    // Appending any query parameter (like ?t=...) invalidates the signature and causes 403 Forbidden!
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
      customToast.error('Image size exceeds 10MB limit');
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.85 });
      const formData = new FormData();
      formData.append('avatar', compressed);

      const res = await profileApi.uploadProfilePicture(formData);
      if (res?.ok || res?.success || res?.profile_image_url) {
        customToast.success('Profile picture updated successfully!');
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
      <div className="flex-1 flex items-center justify-center h-full w-full bg-white dark:bg-[#0d1117]">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-y-auto font-sans">
      {/* Top Profile Header (Full Width edge-to-edge) */}
      <div className="px-6 py-6 border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-5 bg-white dark:bg-[#0d1117] shrink-0">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div
              onClick={handleAvatarClick}
              className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200/50 dark:border-blue-500/20 shadow-xs flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-extrabold cursor-pointer overflow-hidden transition-opacity hover:opacity-95"
              title={user.avatar ? 'Click to preview picture' : undefined}
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
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center border-2 border-white dark:border-[#0d1117] shadow-sm transition-transform active:scale-95 cursor-pointer"
              title="Upload New Profile Picture"
            >
              {uploading ? <Loader2 className="animate-spin" size={13} /> : <Camera size={13} />}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* User identity */}
          <div className="text-center sm:text-left">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              {user.name}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setConfirmLogoutOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-2xs"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Section 1: Employee Information (Full Width Edge-to-Edge) */}
      <div className="border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Employee Information
          </h2>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-8">
          <div>
            <span className="text-[11px] font-medium text-gray-400 block">Email Address</span>
            <div className="flex items-center justify-between mt-1 max-w-sm">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                {user.email || '—'}
              </span>
              {user.email && (
                <button
                  type="button"
                  onClick={() => handleCopy(user.email, 'email')}
                  className="text-gray-400 hover:text-blue-600 p-1"
                  title="Copy Email"
                >
                  {copiedKey === 'email' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-medium text-gray-400 block">Phone Number</span>
            <div className="flex items-center justify-between mt-1 max-w-sm">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                {user.phone || '—'}
              </span>
              {user.phone && (
                <button
                  type="button"
                  onClick={() => handleCopy(user.phone, 'phone')}
                  className="text-gray-400 hover:text-blue-600 p-1"
                  title="Copy Phone"
                >
                  {copiedKey === 'phone' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>

          {user.department && (
            <div>
              <span className="text-[11px] font-medium text-gray-400 block">Department</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1 block">
                {user.department}
              </span>
            </div>
          )}

          {user.designation && (
            <div>
              <span className="text-[11px] font-medium text-gray-400 block">Designation</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1 block">
                {user.designation}
              </span>
            </div>
          )}

          {user.employeeCode && (
            <div>
              <span className="text-[11px] font-medium text-gray-400 block">Employee Code</span>
              <span className="text-xs font-semibold font-mono text-gray-800 dark:text-gray-200 mt-1 block">
                {user.employeeCode}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* --- AVATAR PREVIEW MODAL (PORTAL) --- */}
      {showPreview && user.avatar && !imageError && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-200"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative w-full max-w-xl bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white tracking-tight">Profile Picture</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={uploading || isRemovingAvatar}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Edit size={13} />}
                  <span>{uploading ? 'Updating...' : 'Replace'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isRemovingAvatar}
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isRemovingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  <span>{isRemovingAvatar ? 'Removing...' : 'Remove'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="relative flex items-center justify-center bg-black/60 rounded-xl overflow-hidden max-h-[60vh] min-h-[200px] p-2">
              {uploading && (
                <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                  <span className="text-xs font-semibold text-white">Updating profile photo...</span>
                </div>
              )}
              <img
                key={user.avatar}
                src={user.avatar}
                alt="Profile Preview"
                className="max-h-[55vh] w-auto max-w-full object-contain rounded-lg transition-opacity duration-200"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- LOGOUT CONFIRM MODAL --- */}
      <ConfirmModal
        isOpen={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={async () => {
          setConfirmLogoutOpen(false);
          await logout();
        }}
        title="Sign Out of MANO-ERP?"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
