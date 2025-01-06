// app/api/memory/[key]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { key: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('User not authenticated')

    // Get from Supabase
    const { data, error } = await supabase
      .from('memory_storage')
      .select('*')
      .eq('key', params.key)
      .eq('user_id', user.id)
      .single()

    if (error) throw error

    // Get from MemGPT service
    const memgptResponse = await fetch(`https://ai-overhaul.onrender.com/memory/${params.key}`)
    const memgptData = await memgptResponse.json()

    return NextResponse.json({
      success: true,
      data: {
        supabase: data,
        memgpt: memgptData
      }
    })

  } catch (error) {
    console.error('Error retrieving memory:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}