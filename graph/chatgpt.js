import { OpenAI } from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// prompt: string content for the user message
// options: { model?, max_tokens?, temperature?, system? }
export async function chatWithGPT(prompt, options = {}) {
  try {
    const messages = [];
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o',
      messages,
      max_tokens: options.max_tokens || 1200,
      temperature: options.temperature || 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error?.message || error);
    throw new Error('Failed to get response from ChatGPT');
  }
}
