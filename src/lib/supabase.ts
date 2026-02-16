import { createClient } from '@supabase/supabase-js'

// Usamos credenciales directas para asegurar que funcione en Vercel sin configurar variables
const supabaseUrl = 'https://dqqcvjxoxaasftgrgpsm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcWN2anhveGFhc2Z0Z3JncHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3OTAwMjQsImV4cCI6MjA4MjM2NjAyNH0.MR01nmH19TRmgQgVQHGCFsOpjl0MY1aWg7PTL2CZ_Xc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
