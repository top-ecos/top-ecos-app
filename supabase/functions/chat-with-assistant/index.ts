import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    console.log('Function called, parsing request...');
    const { message, threadId, assistantId, stationId } = await req.json();
    console.log('Received params:', {
      message: message?.substring(0, 50),
      threadId,
      assistantId,
      stationId
    });
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not found in environment');
      throw new Error('OPENAI_API_KEY not found');
    }
    console.log('OpenAI API key found');
    if (!message || !assistantId) {
      throw new Error('Message and assistantId are required');
    }
    const headers = {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    };
    let currentThreadId = threadId;
    // Create thread if not exists
    if (!currentThreadId) {
      console.log('Creating new thread...');
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      if (!threadResponse.ok) {
        const errorText = await threadResponse.text();
        console.error('Thread creation failed:', errorText);
        throw new Error(`Failed to create thread: ${threadResponse.status}`);
      }
      const threadData = await threadResponse.json();
      currentThreadId = threadData.id;
      console.log('Thread created:', currentThreadId);
    }
    // Add message to thread
    console.log('Adding message to thread...');
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        role: 'user',
        content: message
      })
    });
    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Message addition failed:', errorText);
      throw new Error(`Failed to add message: ${messageResponse.status}`);
    }
    // Run assistant
    console.log('Running assistant...');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assistant_id: assistantId
      })
    });
    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Run creation failed:', errorText);
      throw new Error(`Failed to run assistant: ${runResponse.status}`);
    }
    const runData = await runResponse.json();
    console.log('Run started:', runData.id);
    // Poll for completion
    let run = runData;
    let attempts = 0;
    const maxAttempts = 30 // 30 seconds timeout
    ;
    while((run.status === 'queued' || run.status === 'in_progress') && attempts < maxAttempts){
      await new Promise((resolve)=>setTimeout(resolve, 1000));
      attempts++;
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${run.id}`, {
        method: 'GET',
        headers
      });
      if (!statusResponse.ok) {
        console.error('Status check failed:', statusResponse.status);
        break;
      }
      run = await statusResponse.json();
      console.log(`Run status check ${attempts}:`, run.status);
    }
    if (run.status === 'completed') {
      // Get messages
      console.log('Getting messages...');
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
        method: 'GET',
        headers
      });
      if (!messagesResponse.ok) {
        throw new Error(`Failed to get messages: ${messagesResponse.status}`);
      }
      const messagesData = await messagesResponse.json();
      if (messagesData.data && messagesData.data.length > 0) {
        const assistantMessage = messagesData.data[0];
        const content = assistantMessage.content[0]?.text?.value || 'Désolé, je n\'ai pas pu générer de réponse.';
        console.log('Response generated successfully');
        return new Response(JSON.stringify({
          message: content,
          threadId: currentThreadId
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } else {
        throw new Error('No messages returned from assistant');
      }
    } else {
      console.error('Run failed with status:', run.status);
      if (run.last_error) {
        console.error('Run error details:', run.last_error);
      }
      throw new Error(`Assistant run failed with status: ${run.status}`);
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Vérifiez les logs de la fonction pour plus de détails'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
