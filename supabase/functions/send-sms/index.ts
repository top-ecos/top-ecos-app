import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const phone: string | undefined = body?.phone?.toString();
    const email: string | undefined = body?.email?.toString();

    // Minimal validation: accept either phone or email for logging
    if (!phone && !email) {
      return new Response(JSON.stringify({ error: "Missing phone or email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fake SMS send: log and return success. In real integration, call your SMS provider here.
    const maskedPhone = phone ? phone.replace(/.(?=.{2})/g, "*") : undefined;
    console.log("[send-sms] request", { phone: maskedPhone, email });

    // Optionally: basic (noop) rate limit hooks could be added here later

    return new Response(JSON.stringify({ ok: true, ttl: 300 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-sms] error", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
