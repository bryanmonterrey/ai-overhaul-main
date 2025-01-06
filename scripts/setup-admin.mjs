// src/scripts/setup-admin.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupAdmin(email) {
    try {
        console.log('Looking for user:', email);
        
        // 1. First verify the user exists
        const { data: user, error: userError } = await supabase
            .from('auth.users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error(`User with email ${email} not found`);
        }

        console.log('Found user:', user.id);

        // 2. Create admin role
        const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
                user_id: user.id,
                role: 'admin',
                permissions: {
                    all: true,
                    canManageUsers: true,
                    canManageContent: true,
                    canAccessAnalytics: true
                }
            });

        if (roleError) {
            throw roleError;
        }

        console.log('Created admin role');

        // 3. Log admin creation
        const { error: logError } = await supabase
            .from('admin_logs')
            .insert({
                user_id: user.id,
                action: 'admin_role_created',
                details: {
                    method: 'setup_script',
                    timestamp: new Date().toISOString()
                }
            });

        if (logError) {
            console.warn('Warning: Failed to create admin log:', logError);
        }

        console.log(`Successfully created admin role for user ${email}`);

    } catch (error) {
        console.error('Error setting up admin:', error);
        throw error;
    }
}

// Get email from command line arguments
const email = process.argv[2];
if (!email) {
    console.error('Please provide an email address');
    process.exit(1);
}

setupAdmin(email)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Failed:', error);
        process.exit(1);
    });