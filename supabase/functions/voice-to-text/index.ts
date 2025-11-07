import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String, chunkSize = 32768) {
  const chunks = [];
  let position = 0;
  while(position < base64String.length){
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    for(let i = 0; i < binaryChunk.length; i++){
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    chunks.push(bytes);
    position += chunkSize;
  }
  const totalLength = chunks.reduce((acc, chunk)=>acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks){
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    console.log('Voice-to-text function called');
    const { audio } = await req.json();
    console.log('Received audio data length:', audio?.length);
    if (!audio) {
      throw new Error('No audio data provided');
    }
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not found');
    }
    console.log('Processing audio in chunks...');
    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    console.log('Binary audio length:', binaryAudio.length);
    // Prepare form data
    const formData = new FormData();
    const blob = new Blob([
      binaryAudio
    ], {
      type: 'audio/webm'
    });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');
    console.log('Sending to OpenAI Whisper...');
    // Send to OpenAI
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: formData
    });
    console.log('OpenAI Whisper response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Whisper API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    const result = await response.json();
    console.log('Transcription result:', result);
    return new Response(JSON.stringify({
      text: result.text
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in voice-to-text function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
