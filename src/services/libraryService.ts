import { supabase } from '../lib/supabase';
import { getSeriesDetails } from './tmdb';

export const repairLibrary = async (userId: string, onProgress?: (msg: string) => void) => {
    try {
        if (onProgress) onProgress('Buscando biblioteca...');

        const { data: library, error } = await supabase
            .from('user_library')
            .select(`*, media:media_id (*)`)
            .eq('user_id', userId)
            .neq('status', 'watched'); // Don't touch history generally, or maybe yes?
        // Let's fix everything just in case.

        if (error) throw error;
        if (!library) return;

        let updatedCount = 0;

        for (const item of library) {
            if (item.media?.media_type === 'tv' && item.media?.tmdb_id) {
                const details = await getSeriesDetails(item.media.tmdb_id);
                if (details) {
                    let needsUpdate = false;
                    const updates: any = {};

                    // Fix Total Episodes
                    if (item.total_episodes !== details.number_of_episodes) {
                        updates.total_episodes = details.number_of_episodes;
                        needsUpdate = true;
                    }

                    // Fix Status Logic
                    const actualTotal = details.number_of_episodes;
                    const isUpToDate = item.last_episode_seen >= actualTotal;
                    const isEnded = details.status === 'Ended' || details.status === 'Canceled';

                    let correctStatus = item.status;
                    if (item.status !== 'watchlist') { // Don't auto-start watchlist
                        if (isUpToDate && !isEnded) correctStatus = 'waiting';
                        else if (isUpToDate && isEnded) correctStatus = 'finished'; // Or keep waiting? Logic says 'active' if not done.
                        else if (!isUpToDate) correctStatus = 'watching'; // Should be 'watching' (active)
                    }

                    // Only change if different and valid
                    if (correctStatus !== item.status) {
                        // Only override if it makes sense (e.g. not overwriting 'watchlist' unless unseen?)
                        // Actually, let's just fix 'waiting' vs 'watching'
                        if (item.status === 'watching' && correctStatus === 'waiting') {
                            updates.status = 'waiting';
                            needsUpdate = true;
                        }
                        if (item.status === 'waiting' && correctStatus === 'watching') {
                            updates.status = 'watching';
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        if (onProgress) onProgress(`Atualizando ${item.media.title}...`);
                        await supabase.from('user_library').update(updates).eq('id', item.id);
                        updatedCount++;
                    }
                }
            }
        }

        if (onProgress) onProgress(`Concluído! ${updatedCount} séries atualizadas.`);

    } catch (error) {
        console.error('Repair failed', error);
        throw error;
    }
};

export const addToWatchlist = async (userId: string, tmdbId: number, mediaType: 'tv' | 'movie') => {
    try {
        // 1. Fetch Basic Media Details from TMDB to ensure we have title/poster
        const { getSeriesDetails, getMovieDetails } = await import('./tmdb');
        const details = mediaType === 'tv' ? await getSeriesDetails(tmdbId) : await getMovieDetails(tmdbId);

        if (!details) throw new Error('Could not fetch details from TMDB');

        // 2. Ensure Media Exists in our DB
        let { data: media } = await supabase
            .from('media')
            .select('id')
            .eq('tmdb_id', tmdbId)
            .eq('media_type', mediaType)
            .single();

        if (!media) {
            const { data: newMedia, error: mediaError } = await supabase
                .from('media')
                .insert({
                    tmdb_id: tmdbId,
                    media_type: mediaType,
                    title: details.title || details.name,
                    poster_url: details.poster_path
                })
                .select()
                .single();

            if (mediaError) throw mediaError;
            media = newMedia;
        }

        // 3. Add to User Library
        const { data: newLib, error: libError } = await supabase
            .from('user_library')
            .insert({
                user_id: userId,
                media_id: media?.id,
                status: 'watchlist',
                total_episodes: details.number_of_episodes || 0,
                last_episode_seen: 0
            })
            .select()
            .single();

        if (libError) {
            // If it already exists, just return success (or handle error)
            if (libError.code === '23505') return { success: true, message: 'Já está na sua lista!' };
            throw libError;
        }

        return { success: true, data: newLib };
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        throw error;
    }
};
