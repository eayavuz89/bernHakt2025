import { OpenAI } from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatWithGPT(prompt, options = {}) {
  try {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.max_tokens || 750,
      temperature: options.temperature || 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error?.message || error);
    throw new Error('Failed to get response from ChatGPT');
  }
}
