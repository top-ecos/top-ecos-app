import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Basic test response first
    console.log('Function called with method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header found');
      return new Response(JSON.stringify({
        error: 'Missing authorization header',
        code: 'UNAUTHORIZED'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Auth header present:', authHeader.substring(0, 20) + '...');
    // Create Supabase client with the user's auth token
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    console.log('Supabase client created');
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        error: 'Authentication failed',
        code: 'UNAUTHORIZED',
        details: authError
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('User authenticated:', user.id);
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body:', requestBody);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { sdd_id } = requestBody;
    if (!sdd_id || typeof sdd_id !== 'string') {
      return new Response(JSON.stringify({
        error: 'SDD ID is required and must be a string'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Processing token consumption for SDD:', sdd_id);
    // Use service role client for database operations
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    console.log('Admin client created');
    // Get current user profile WITHOUT RLS for now (to test)
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id, user_id, tokens, premium').eq('user_id', user.id).single();
    console.log('Profile query result:', {
      profile,
      profileError
    });
    if (profileError || !profile) {
      return new Response(JSON.stringify({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
        details: profileError
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if user has sufficient tokens
    if (profile.tokens <= 0) {
      return new Response(JSON.stringify({
        error: 'Insufficient tokens',
        code: 'INSUFFICIENT_TOKENS',
        tokens_remaining: profile.tokens,
        requires_upgrade: !profile.premium
      }), {
        status: 402,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Simple token consumption (without optimistic locking for now)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin.from('profiles').update({
      tokens: profile.tokens - 1,
      updated_at: new Date().toISOString()
    }).eq('user_id', user.id).select('tokens').single();
    console.log('Token update result:', {
      updatedProfile,
      updateError
    });
    if (updateError || !updatedProfile) {
      return new Response(JSON.stringify({
        error: 'Token consumption failed',
        code: 'UPDATE_FAILED',
        details: updateError
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Token consumed successfully');
    return new Response(JSON.stringify({
      success: true,
      tokens_remaining: updatedProfile.tokens,
      sdd_id: sdd_id,
      message: 'Token consumed successfully'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
