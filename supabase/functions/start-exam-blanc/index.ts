import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const REQUIRED_TOKENS = 5;
const STATIONS_COUNT = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, tokens, premium')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if ((profile.tokens ?? 0) < REQUIRED_TOKENS) {
      return new Response(JSON.stringify({
        error: `Tokens insuffisants. Il vous faut ${REQUIRED_TOKENS} tokens pour démarrer un ECOS blanc.`,
        code: 'INSUFFICIENT_TOKENS',
        tokens_remaining: profile.tokens,
        tokens_required: REQUIRED_TOKENS,
        requires_upgrade: !profile.premium
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch live SDDs with all fields needed for chat + evaluation
    const { data: allSdds, error: sddError } = await supabaseAdmin
      .from('sdds')
      .select(`
        sdd_id,
        sdd_titre,
        consignes_etudiant,
        sdd_type,
        sdd_specialite,
        official_id,
        item_edn,
        include_documents,
        fiche_patient_prénom,
        fiche_patient_nom,
        lien_document_externe_1,
        lien_document_externe_2,
        lien_document_externe_3,
        lien_document_externe_4,
        lien_document_externe_5
      `)
      .eq('status', 'live')
      .neq('sdd_type', 'Document(s)');

    if (sddError || !allSdds || allSdds.length < STATIONS_COUNT) {
      return new Response(JSON.stringify({
        error: 'Not enough live stations available',
        code: 'INSUFFICIENT_SDDS'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fisher-Yates shuffle and pick 5
    const shuffled = [...allSdds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selectedSdds = shuffled.slice(0, STATIONS_COUNT);

    // Atomically deduct 5 tokens
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ tokens: profile.tokens - REQUIRED_TOKENS, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('tokens', profile.tokens) // optimistic lock
      .select('tokens')
      .single();

    if (updateError || !updatedProfile) {
      return new Response(JSON.stringify({
        error: 'Echec de la déduction des tokens. Veuillez réessayer.',
        code: 'UPDATE_FAILED'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create exam session record
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('exam_blanc_sessions')
      .insert({
        user_id: user.id,
        status: 'in_progress',
        sdd_ids: selectedSdds.map((s: any) => s.sdd_id),
        current_sdd_index: 0
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      // Refund tokens on session creation failure
      await supabaseAdmin
        .from('profiles')
        .update({ tokens: profile.tokens })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        error: 'Echec de la création de la session. Tokens remboursés.',
        code: 'SESSION_CREATION_FAILED'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: session.id,
      sdds: selectedSdds,
      tokens_remaining: updatedProfile.tokens
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
