process.env.DB_USER = 'postgres';
process.env.PGUSER = 'postgres';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'postgres';
process.env.PGHOST = process.env.PGHOST || 'localhost';
process.env.PGPORT = process.env.PGPORT || '5432';
process.env.PGDATABASE = process.env.PGDATABASE || 'hospital_capacity';
process.env.NODE_ENV = 'test';
