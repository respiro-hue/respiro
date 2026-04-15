import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Permitir apenas o domínio do projeto (CORS seguro)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://respiro.com.br';
res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
res.setHeader('Vary', 'Origin'); // importante para cache

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // service key — nunca vai ao browser
  );

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('textos')
      .select('id, semana, ano, titulo, texto, midia, tipo, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  res.status(405).json({ error: 'método não permitido' });
}
