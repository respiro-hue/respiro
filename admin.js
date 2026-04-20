import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const rateLimits = {};
function verificarRateLimit(ip, max = 10, janela = 60000) {
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

function compararSenha(entrada, esperada) {
  const buf1 = Buffer.from(entrada || '');
  const buf2 = Buffer.from(esperada || '');
  if (buf1.length !== buf2.length) return false;
  return crypto.timingSafeEqual(buf1, buf2);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = obterIp(req);
  if (!verificarRateLimit(ip, 10, 60000)) {
    return res.status(429).json({ error: 'muitas tentativas' });
  }

  const auth = req.headers.authorization || '';
  const senhaEnviada = auth.replace('Bearer ', '');

  try {
    if (!compararSenha(senhaEnviada, process.env.ADMIN_SENHA || '')) {
      return res.status(401).json({ error: 'não autorizado' });
    }
  } catch {
    return res.status(401).json({ error: 'não autorizado' });
  }

  if (req.method === 'GET') {
    try {
      const [{ data: msgs }, { data: emails }] = await Promise.all([
        sb.from('mensagens').select('*').order('created_at', { ascending: false }),
        sb.from('emails').select('*').order('created_at', { ascending: false })
      ]);

      res.status(200).json({
        msgs: msgs || [],
        emails: emails || []
      });
    } catch (e) {
      console.error('Erro ao buscar admin data:', e);
      res.status(500).json({ error: 'erro ao buscar dados' });
    }
  }

  if (req.method === 'DELETE') {
    const { tipo, id } = req.body;
    if (!tipo || !id || typeof id !== 'number') {
      return res.status(400).json({ error: 'parâmetros inválidos' });
    }

    const tabela = tipo === 'mensagem' ? 'mensagens' : 'emails';
    try {
      const { error } = await sb.from(tabela).delete().eq('id', id);
      if (error) throw error;
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Erro ao deletar:', e);
      res.status(500).json({ error: 'erro ao deletar' });
    }
  }
}
