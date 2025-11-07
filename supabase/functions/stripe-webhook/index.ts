import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from "https://esm.sh/stripe@13.6.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // --- 1. INITIAL SETUP & SECURITY ---
    const stripeSecretKey = Deno.env.get('VITE_STRIPE_SECRET');
    const webhookSecret = Deno.env.get('VITE_STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables.');
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient()
    });
    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new Error('Missing stripe-signature header.');
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log(`Processing webhook event: ${event.type}`);
    // --- 2. HANDLE WEBHOOK EVENTS ---
    switch(event.type){
      case 'checkout.session.completed':
        {
          const session = event.data.object;
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
          if (!customerId) throw new Error('Customer ID not found in session.');
          const customer = await stripe.customers.retrieve(customerId);
          if (customer.deleted) throw new Error('Customer has been deleted.');
          if (!customer.email) throw new Error('Customer email is missing.');
          const { data: user, error: userError } = await supabase.from('profiles').select('id').eq('email', customer.email).single();
          if (userError || !user) throw new Error(`User not found for email: ${customer.email}`);
          // Define your known Product and Price IDs
          const SEASON_PASS_PRODUCT_ID = 'prod_TN890bAsyMKbDQ'; // 👈 PASTE YOUR ID
          const MONTHLY_PRICE_ID = 'price_1SQNnZLlOo2xJneBQpV4861I'; // 👈 PASTE YOUR ID
          const TRIMESTRIAL_PRICE_ID = 'price_1SQNyVLlOo2xJneBfdVTkomo'; // 👈 PASTE YOUR ID
          if (session.mode === 'subscription') {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const priceId = subscription.items.data[0].price.id;
            // Only grant access for known subscription price IDs
            if ([
              MONTHLY_PRICE_ID,
              TRIMESTRIAL_PRICE_ID
            ].includes(priceId)) {
              const profileUpdate = {
                premium: true,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription.id,
                priceId: priceId,
                stripe_product_id: subscription.items.data[0].price.product,
                subscription_status: subscription.status,
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                access_expires_at: null // Clear fixed expiration date when moving to a subscription
              };
              const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
              if (error) throw new Error(`DB Error (Subscription): ${error.message}`);
              console.log(`Profile updated for new subscription (${priceId}) for: ${customer.email}`);
            } else {
              console.log(`Ignoring unrecognized subscription with price ID: ${priceId}`);
            }
          } else if (session.mode === 'payment') {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            const price = lineItems.data[0].price;
            if (!price) throw new Error("Price data not found in line items.");
            // Only grant access if the product is the Season Pass
            if (price.product === SEASON_PASS_PRODUCT_ID) {
              const profileUpdate = {
                premium: true,
                stripe_customer_id: customerId,
                priceId: price.id,
                stripe_product_id: price.product,
                access_expires_at: new Date('2026-08-15T23:59:59Z').toISOString(),
                // Clear subscription fields
                stripe_subscription_id: null,
                subscription_status: null,
                current_period_end: null
              };
              const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
              if (error) throw new Error(`DB Error (Season Pass): ${error.message}`);
              console.log(`Profile updated for Season Pass payment for: ${customer.email}`);
            } else {
              console.log(`Ignoring unrecognized one-time payment for product ID: ${price.product}`);
            }
          }
          break;
        }
      case 'customer.subscription.updated':
        {
          const subscription = event.data.object;
          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
          const { data: user, error: userError } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).single();
          if (userError || !user) throw new Error(`User not found for customer ID: ${customerId}`);
          const profileUpdate = {
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            priceId: subscription.items.data[0].price.id
          };
          const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
          if (error) throw new Error(`DB Error (Subscription Update): ${error.message}`);
          console.log(`Subscription status updated for user: ${user.id}`);
          break;
        }
      case 'customer.subscription.deleted':
        {
          const subscription = event.data.object;
          // The `current_period_end` remains from the last update, so access will naturally expire.
          // We just need to clear the status and subscription ID.
          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
          const { data: user, error: userError } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).single();
          if (userError || !user) throw new Error(`User not found for customer ID on deletion: ${customerId}`);
          const profileUpdate = {
            subscription_status: subscription.status,
            stripe_subscription_id: null
          };
          const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
          if (error) throw new Error(`DB Error (Subscription Deletion): ${error.message}`);
          console.log(`Subscription canceled for user: ${user.id}. Access valid until ${new Date(subscription.current_period_end * 1000).toISOString()}`);
          break;
        }
    }
    return new Response(JSON.stringify({
      received: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Webhook Error:', error.message);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
