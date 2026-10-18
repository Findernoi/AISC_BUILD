process.env.RECRUITMENT_LOCAL='true';
process.env.DATABASE_PREVIEW='true';
process.env.NODE_ENV='development';
process.env.DISABLE_HMR='true';
await import('./server');
