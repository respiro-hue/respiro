import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Rate limiting simples
const rateLimits = {};
function verificarRateLimit(ip, max = 5, janela = 60000) {
  const agora = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => agora - t < janela);
  if (rateLimits[ip].length >= max) return false;
  rateLimits[ip].push(agora);
  return true;
}

function obterIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= 254;
}

function escaparHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'não permitido' });

  const ip = obterIp(req);
  if (!verificarRateLimit(ip, 5, 60000)) {
    return res.status(429).json({ error: 'muitas tentativas. tente novamente em 1 minuto' });
  }

  const { texto, email } = req.body;
  
  if (!texto || texto.trim().length === 0) {
    return res.status(400).json({ error: 'texto obrigatório' });
  }
  if (texto.length > 300) {
    return res.status(400).json({ error: 'máximo 300 caracteres' });
  }

  const textoLimpo = texto.trim();
  const emailLimpo = email ? email.trim().toLowerCase() : null;

  if (emailLimpo && !validarEmail(emailLimpo)) {
    return res.status(400).json({ error: 'email inválido' });
  }

  try {
    const { error: errMsg } = await sb
      .from('mensagens')
      .insert([{
        texto: escaparHtml(textoLimpo),
        email: emailLimpo
      }]);

    if (errMsg) throw errMsg;

    if (emailLimpo) {
      await sb.from('emails').upsert([{ email: emailLimpo }], { onConflict: 'email' });
      // Envio via Resend seria aqui, mas é assíncrono
      // O importante é que o email foi registrado no banco
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Erro ao salvar mensagem:', e);
    res.status(500).json({ error: 'erro ao salvar. tente novamente' });
  }
}
