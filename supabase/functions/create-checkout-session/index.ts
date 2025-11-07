import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from "https://esm.sh/stripe@13.6.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const stripe = new Stripe(Deno.env.get('VITE_STRIPE_SECRET'), {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient()
});
const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'));
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // --- 1. AUTHENTICATE THE USER ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header.");
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw userError;
    if (!user) throw new Error("User not found or token is invalid.");
    // --- 2. GET SECURE USER DATA & INPUT ---
    const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: profile, error: profileError } = await serviceSupabase.from('profiles').select('stripe_customer_id').eq('user_id', user.id).single();
    if (profileError) throw profileError;
    const { priceId, mode } = await req.json();
    if (!priceId || !mode) throw new Error("A 'priceId' and 'mode' are required.");
    // --- 3. PREPARE STRIPE SESSION ---
    const stripeCustomerId = profile.stripe_customer_id;
    const sessionParams = {
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: mode,
      success_url: `${Deno.env.get('VITE_SITE_URL')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('VITE_SITE_URL')}/`
    };
    // --- 4. CREATE SESSION WITH CORRECTED LOGIC ---
    let session;
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      try {
        session = await stripe.checkout.sessions.create(sessionParams);
      } catch (e) {
        if (e.code === 'resource_missing' && e.param === 'customer') {
          console.warn(`Stale Stripe customer ID '${stripeCustomerId}'. Creating a new one.`);
          delete sessionParams.customer;
          // Apply the conditional logic HERE as well for the self-healing path
          if (mode === 'payment') {
            sessionParams.customer_creation = 'always';
          }
          sessionParams.customer_email = user.email;
          session = await stripe.checkout.sessions.create(sessionParams);
        } else {
          throw e;
        }
      }
    } else {
      // Logic for a brand new customer
      // --- THIS IS THE KEY CHANGE ---
      // Only add `customer_creation` if the mode is 'payment'
      if (mode === 'payment') {
        sessionParams.customer_creation = 'always';
      }
      // For both modes, providing the email will find or create the customer.
      sessionParams.customer_email = user.email;
      session = await stripe.checkout.sessions.create(sessionParams);
    }
    // --- 5. RETURN THE SESSION URL ---
    return new Response(JSON.stringify({
      url: session.url
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in create-checkout-session:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
