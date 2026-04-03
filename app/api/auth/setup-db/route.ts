import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    const adminClient = getSupabaseAdmin();

    const { error } = await adminClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          first_name TEXT NOT NULL DEFAULT '',
          last_name TEXT NOT NULL DEFAULT '',
          username TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
            CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
            CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Service role can manage profiles') THEN
            CREATE POLICY "Service role can manage profiles" ON profiles FOR ALL USING (true);
          END IF;
        END
        $$;
      `
    });

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        hint: 'Run the SQL manually in Supabase Dashboard > SQL Editor'
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Profiles table created' });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      hint: 'The exec_sql RPC may not exist. Create the profiles table manually in Supabase Dashboard.'
    }, { status: 500 });
  }
}
