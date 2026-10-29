export const APP_NAME = 'JUZ GAME';
export const SUPABASE_URL = 'https://ntuzwvmtxgjrkozpfjgm.supabase.co';
export const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50dXp3dm10eGdqcmtvenBmamdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNTkzNzQsImV4cCI6MjEwODgzNTM3NH0.c_q-GFni_2y5Jw39Utn_dGW_mY1bbP-SOO5ITainpt0';
export const MOCK = import.meta.env.VITE_MOCK === '1';
export const DEMO = import.meta.env.VITE_DEMO === '1';
export const API_URL = MOCK ? '/mock/game' : `${SUPABASE_URL}/functions/v1/game`;
