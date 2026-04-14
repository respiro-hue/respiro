import { createClient } from '@supabase/supabase-js';

// função simples para escapar caracteres perigosos de HTML
function escapeHtml(texto) {
  if (!texto) return texto;
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return texto.replace(/[&<>"']/g, (m) => map[m]);
}

export default async function handler(req, res) {
  // Permitir apenas o domínio do projeto (CORS seguro)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://respiro.com.br';
res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
res.setHeader('Vary', 'Origin'); // importante para cache
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // autenticação por senha — conferida no servidor, nunca exposta
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_SENHA}`) {
    return res.status(401).json({ error: 'não autorizado' });
  }

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  if (req.method === 'POST') {
    const { semana, ano, titulo, texto, midia, tipo } = req.body;
    if (!semana || !ano || !titulo || !texto) {
      return res.status(400).json({ error: 'campos obrigatórios ausentes' });
    }
    if (midia && midia.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'imagem muito grande' });
    }
        const { error } = await sb.from('textos').insert([{ semana, ano, titulo: escapeHtml(titulo), texto: escapeHtml(texto), midia: midia || '', tipo: tipo || 'image' }]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id obrigatório' });
    const { error } = await sb.from('textos').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'método não permitido' });
}
