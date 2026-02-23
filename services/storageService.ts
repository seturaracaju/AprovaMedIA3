
import { supabase } from './supabaseClient';

const BUCKET_NAME = 'media-assets';
const MATERIALS_BUCKET = 'marketplace-materials';

/**
 * Uploads an image file to the Supabase storage bucket.
 */
export const uploadImage = async (file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return data.publicUrl;

    } catch (error) {
        console.error('Error uploading image:', error);
        return null;
    }
};

/**
 * Uploads a PDF or Document to the marketplace materials bucket.
 */
export const uploadMaterial = async (file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(MATERIALS_BUCKET)
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from(MATERIALS_BUCKET)
            .getPublicUrl(filePath);

        return data.publicUrl;

    } catch (error) {
        console.error('Error uploading material:', error);
        return null;
    }
};
