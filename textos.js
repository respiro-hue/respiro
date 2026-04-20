import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'método não permitido' });
  }

  try {
    const { data, error } = await sb
      .from('textos')
      .select('id, semana, ano, titulo, texto, midia, tipo, midia_tipo, url_video, musica_vocal, musica_instrumental, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Retorna apenas os campos públicos
    const textos = (data || []).map(t => ({
      id: t.id,
      semana: t.semana,
      ano: t.ano,
      titulo: t.titulo,
      texto: t.texto,
      midia: t.midia,
      tipo: t.tipo,
      midia_tipo: t.midia_tipo,
      url_video: t.url_video,
      musica_vocal: t.musica_vocal,
      musica_instrumental: t.musica_instrumental
    }));

    res.status(200).json(textos);
  } catch (e) {
    console.error('Erro ao buscar textos:', e);
    res.status(500).json({ error: 'erro ao buscar textos' });
  }
}
