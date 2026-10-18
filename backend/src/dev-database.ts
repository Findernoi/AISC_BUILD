// Opt-in local schema preview. No Supabase migration or cloud write is performed.
process.env.DATABASE_PREVIEW = 'true';
process.env.NODE_ENV = 'development';
process.env.DISABLE_HMR = 'true';
await import('./server');
