import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
import { loadEnv, type AppEnv } from '@peytakilid/config';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

export const appEnv: AppEnv = loadEnv();
