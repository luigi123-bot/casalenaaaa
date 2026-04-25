
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('products').select('id, name, category_id, available').limit(1)
  if (error) console.error(error)
  else console.log('Product sample:', data[0])

  const { data: roles, error: rolesError } = await supabase.from('profiles').select('role').limit(100)
  if (rolesError) console.error(rolesError)
  else console.log('Distinct roles in profiles:', [...new Set(roles.map(r => r.role))])

  const { data: userRoles, error: userRolesError } = await supabase.from('usuarios').select('role').limit(100)
  if (userRolesError) console.error(userRolesError)
  else console.log('Distinct roles in usuarios:', [...new Set(userRoles.map(r => r.role))])
}

test()
