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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'método não permitido' });

  const { texto, email } = req.body;
  if (!texto || texto.trim().length === 0) return res.status(400).json({ error: 'texto obrigatório' });
  if (texto.length > 300) return res.status(400).json({ error: 'texto muito longo' });

    // valida formato de email se fornecido
  if (email && email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'formato de email inválido' });
    }
  }
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // salva mensagem
  const { error: errMsg } = await sb
    .from('mensagens')
    .insert([{ texto: escapeHtml(texto.trim()), email: email?.trim() || null }]);
  if (errMsg) return res.status(500).json({ error: errMsg.message });

  // salva email e envia confirmação se fornecido
  if (email && email.trim()) {
    const emailLimpo = email.trim().toLowerCase();

    // upsert para não duplicar
    await sb.from('emails').upsert([{ email: emailLimpo }], { onConflict: 'email' });

    // envia email de confirmação via Resend
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_REMETENTE,
          to: emailLimpo,
          subject: 'você está no respiro',
          html: `
            <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:2rem;color:#1a1a18;">
              <p style="font-style:italic;font-size:1.1rem;line-height:1.8;margin-bottom:1.5rem;">
                obrigada por estar aqui.
              </p>
              <p style="font-size:0.9rem;line-height:1.7;color:#5a5a50;">
                quando eu escrever algo novo, você vai saber.<br>
                só isso. nada mais.
              </p>
              <p style="font-size:0.75rem;color:#9a9a90;margin-top:2rem;border-top:1px solid #e5e0d8;padding-top:1rem;">
                para sair desta lista, responda com "sair".
              </p>
            </div>
          `
        })
      });
    } catch (e) {
      // não bloqueia — mensagem já foi salva
      console.error('Resend error:', e);
    }
  }

  return res.status(200).json({ ok: true });
}
