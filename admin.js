import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_SENHA}`) {
    return res.status(401).json({ error: 'não autorizado' });
  }

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  if (req.method === 'GET') {
    const [{ data: msgs }, { data: emails }] = await Promise.all([
      sb.from('mensagens').select('*').order('created_at', { ascending: false }),
      sb.from('emails').select('*').order('created_at', { ascending: false })
    ]);
    return res.status(200).json({ msgs: msgs || [], emails: emails || [] });
  }

  if (req.method === 'DELETE') {
    const { tipo, id } = req.body;
    if (!tipo || !id) return res.status(400).json({ error: 'tipo e id obrigatórios' });
    const tabela = tipo === 'mensagem' ? 'mensagens' : 'emails';
    const { error } = await sb.from(tabela).delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'método não permitido' });
}
