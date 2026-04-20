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

function validarUrl(url) {
  try {
    new URL(url);
    return /^https?:\/\//.test(url);
  } catch {
    return false;
  }
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = obterIp(req);
  if (!verificarRateLimit(ip, 10, 60000)) {
    return res.status(429).json({ error: 'muitas tentativas. tente novamente em 1 minuto' });
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

  if (req.method === 'POST') {
    const { semana, ano, titulo, texto, midia, tipo, midia_tipo, url_video, musica_vocal, musica_instrumental } = req.body;

    if (!semana || !ano || !titulo || !texto) {
      return res.status(400).json({ error: 'campos obrigatórios ausentes' });
    }

    if (midia && midia.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'imagem muito grande (máx 5MB)' });
    }

    if (url_video && !validarUrl(url_video)) {
      return res.status(400).json({ error: 'URL de vídeo inválida' });
    }

    try {
      const { error } = await sb.from('textos').insert([{
        semana: String(semana).padStart(2, '0'),
        ano: String(ano),
        titulo: escaparHtml(titulo),
        texto: escaparHtml(texto),
        midia: midia || '',
        tipo: tipo || 'image',
        midia_tipo: midia_tipo || null,
        url_video: url_video || null,
        musica_vocal: musica_vocal || null,
        musica_instrumental: musica_instrumental || null
      }]);

      if (error) throw error;
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Erro ao publicar:', e);
      res.status(500).json({ error: 'erro ao publicar' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id || typeof id !== 'number') {
      return res.status(400).json({ error: 'id inválido' });
    }

    try {
      const { error } = await sb.from('textos').delete().eq('id', id);
      if (error) throw error;
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Erro ao deletar:', e);
      res.status(500).json({ error: 'erro ao deletar' });
    }
  }
}
