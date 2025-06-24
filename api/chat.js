import { config } from 'dotenv';
config();

// CORS headers for Vercel deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight requests
function handleOptions(req, res) {
  res.setHeader('Vary', 'Origin');
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  return res.status(204).end();
}

// Main API handler
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res);
  }

  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, temperature, top_p, top_k, max_tokens, stream, model } = req.body;

    // Validate required parameters
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Get API key from environment variables
    const apiKey = process.env.FIREWORKS_API_KEY;
    if (!apiKey) {
      throw new Error('FIREWORKS_API_KEY environment variable is not set');
    }

    // Default to DeepSeek if no model specified
    const selectedModel = model || "accounts/fireworks/models/deepseek-v3-0324";

    // Call the specified model through Fireworks.ai
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: temperature || 0.3,
        top_p: top_p || 0.9,
        top_k: top_k || 40,
        max_tokens: max_tokens || 8192,
        stream: stream || false
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Fireworks API error');
    }

    // Handle streaming responses
    if (stream) {
      // Set appropriate headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        res.write(chunk);
      }

      res.end();
    } else {
      // Return regular JSON response
      const data = await response.json();
      return res.status(200).json(data);
    }

  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
