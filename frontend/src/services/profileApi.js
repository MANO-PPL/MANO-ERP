import api from './api';

export const profileApi = {
    /**
     * Get current user's profile info
     */
    getMyProfile: async () => {
        const response = await api.get('/profile/me');
        return response.data;
    },

    /**
     * Upload and update user's profile picture
     */
    uploadProfilePicture: async (formData) => {
        const response = await api.post('/profile', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    /**
     * Remove user's profile picture
     */
    deleteProfilePicture: async () => {
        const response = await api.delete('/profile');
        return response.data;
    }
};

export default profileApi;
