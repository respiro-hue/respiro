// ══════════════════════════════════════════
// RESPIRO — Frontend com Segurança
// ══════════════════════════════════════════
let idx = 0, adminLogado = false, adminSenha = '';
let textosCache = [];
let fontIdx = 1;
const fontClasses = ['f-sm','f-md','f-lg','f-xl'];
let audioCtx = null, somAtivo = null, somNos = {};
let musicaAtiva = null;

// ══ API ═
async function api(path, opts={}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'erro na requisição');
  }
  return res.json();
}

function authHeader() {
  return { 'Authorization': 'Bearer ' + adminSenha };
}

// ══ HERO ══
async function renderHero() {
  try {
    textosCache = await api('/api/textos');
  } catch(e) {
    console.error('Erro ao buscar textos:', e);
    textosCache = [];
  }
  if (!textosCache.length) {
    document.getElementById('hero-semana').textContent = 'em breve';
    document.getElementById('hero-titulo').textContent = 'respiro';
    document.getElementById('hero-trecho').textContent = 'textos que chegam devagar.';
    document.getElementById('arquivo-grid').innerHTML = '<p>nenhum texto ainda.</p>';
    return;
  }
  idx = 0; mostrar(0);
  const nav = document.getElementById('semanas-nav'); nav.innerHTML = '';
  textosCache.forEach(function(_, i) {
    const d = document.createElement('div');
    d.className = 'dot' + (i===0?' active':'');
    d.onclick = function(){ idx=i; mostrar(i); };
    nav.appendChild(d);
  });
  renderArquivo();
}

function mostrar(i) {
  const t = textosCache[i]; if (!t) return;
  const bg = document.getElementById('hero-bg');
  bg.style.opacity = '0';
  setTimeout(function(){
    if (t.url_video) {
      bg.style.backgroundImage = `url('https://img.youtube.com/vi/${extrairYoutubeId(t.url_video)}/maxresdefault.jpg')`;
    } else if (t.midia && t.midia_tipo==='image') {
      bg.style.backgroundImage = "url('" + t.midia + "')";
    } else {
      bg.style.backgroundImage = 'none';
    }
    bg.style.opacity = '1';
  }, 200);
  document.getElementById('hero-semana').textContent = 'semana '+t.semana+' · '+t.ano;
  document.getElementById('hero-titulo').textContent = t.titulo;
  const p = t.texto.split('\n\n')[0];
  document.getElementById('hero-trecho').textContent = p.length>130 ? p.slice(0,130)+'…' : p;
  document.querySelectorAll('.dot').forEach(function(d,j){ d.classList.toggle('active',j===i); });
  idx = i;
}

function extrairYoutubeId(url) {
  const m = url.match(/(?:youtube.com\/watch\?v=|youtu.be\/|youtube.com\/embed\/)([^&\n?#]+)/);
  return m && m[1] ? m[1] : '';
}

// ══ ARQUIVO ══
function renderArquivo() {
  const grid = document.getElementById('arquivo-grid'); grid.innerHTML = '';
  const cores = ['#1e2018','#18201e','#1e1820','#20181e','#181e20','#201e18'];
  textosCache.forEach(function(t, i) {
    const c = document.createElement('div'); c.className = 'arquivo-card';
    let bg = 'background-color:'+cores[i%cores.length]+';';
    if (t.url_video) {
      const ytId = extrairYoutubeId(t.url_video);
      bg = `background-image:url('https://img.youtube.com/vi/${ytId}/maxresdefault.jpg');background-color:#2a2820;`;
    } else if (t.midia && t.midia_tipo==='image') {
      bg = "background-image:url('"+t.midia+"');background-color:#2a2820;";
    }
    c.innerHTML = '<div class="arquivo-semana">semana '+t.semana+'</div><div class="arquivo-titulo">'+esc(t.titulo)+'</div>';
    c.onclick = function(){ abrirLeitura(i); };
    grid.appendChild(c);
  });
}

// ══ LEITURA ══
function abrirLeitura(i) {
  idx = i; renderLeitura();
  const el = document.getElementById('view-leitura');
  el.classList.add('open'); el.scrollTop = 0;
  iniciarProgresso(el);
}

function renderLeitura() {
  const t = textosCache[idx]; if (!t) return;
  document.getElementById('leitura-semana').textContent = 'semana '+t.semana+' · '+t.ano;
  document.getElementById('leitura-titulo').textContent = t.titulo;
  document.getElementById('leitura-texto').textContent = t.texto;
  const musicaDiv = document.getElementById('leitura-musica');
  if (t.musica_vocal || t.musica_instrumental) {
    musicaDiv.style.display = 'block';
    document.getElementById('musica-vocal').style.display = t.musica_vocal ? 'inline-block' : 'none';
    document.getElementById('musica-instrumental').style.display = t.musica_instrumental ? 'inline-block' : 'none';
  } else {
    musicaDiv.style.display = 'none';
  }
  const bg = document.getElementById('leitura-bg');
  if (t.url_video) {
    const ytId = extrairYoutubeId(t.url_video);
    bg.style.backgroundImage = `url('https://img.youtube.com/vi/${ytId}/maxresdefault.jpg')`;
  } else if (t.midia && t.midia_tipo==='image') {
    bg.style.backgroundImage = "url('"+t.midia+"')";
  } else {
    bg.style.backgroundImage = 'none';
  }
  const primeiro = idx===0, ultimo = idx===textosCache.length-1;
  ['nav-anterior','rodape-anterior'].forEach(function(id){ document.getElementById(id).classList.toggle('disabled',primeiro); });
  ['nav-proximo','rodape-proximo'].forEach(function(id){ document.getElementById(id).classList.toggle('disabled',ultimo); });
}

function navegarLeitura(dir) {
  const novo = idx+dir;
  if (novo<0||novo>=textosCache.length) return;
  idx = novo; renderLeitura();
  document.getElementById('view-leitura').scrollTop = 0;
  document.getElementById('leitura-progresso').style.width = '0%';
  pararMusica();
}

function fecharLeitura() {
  document.getElementById('view-leitura').classList.remove('open');
  pararMusica();
}

function iniciarProgresso(el) {
  function tick() {
    if (!el.classList.contains('open')) return;
    const max = el.scrollHeight - el.clientHeight;
    document.getElementById('leitura-progresso').style.width = (max>0 ? el.scrollTop/max*100 : 0)+'%';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function ajustarFonte(dir) {
  const el = document.getElementById('leitura-texto');
  fontIdx = Math.max(0, Math.min(3, fontIdx+dir));
  el.className = 'leitura-texto '+fontClasses[fontIdx];
}

function compartilhar() {
  const t = textosCache[idx]; if (!t) return;
  const btn = document.getElementById('btn-compartilhar');
  const url = window.location.href.split('#')[0];
  if (navigator.share) {
    navigator.share({ title: t.titulo, text: t.texto.split('\n\n')[0], url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText('"'+t.titulo+'" — respiro\n'+url).then(function(){
      btn.innerHTML = '✓ link copiado'; btn.classList.add('compartilhar-ok');
      setTimeout(function(){
        btn.innerHTML = 'compartilhar';
        btn.classList.remove('compartilhar-ok');
      }, 2500);
    });
  }
}

// ══ MÚSICA ══
let audioMusica = null;
function tocarMusica(tipo) {
  const t = textosCache[idx]; if (!t) return;
  const url = tipo === 'vocal' ? t.musica_vocal : t.musica_instrumental;
  if (!url) return;
  pararMusica();
  audioMusica = new Audio(url);
  audioMusica.loop = true;
  audioMusica.play().catch(e => console.log('Erro ao tocar música:', e));
  musicaAtiva = tipo;
  document.querySelectorAll('.musica-btn').forEach(b => b.classList.remove('ativo'));
  document.getElementById('musica-'+tipo).classList.add('ativo');
}

function pararMusica() {
  if (audioMusica) {
    audioMusica.pause();
    audioMusica = null;
  }
  musicaAtiva = null;
  document.querySelectorAll('.musica-btn').forEach(b => b.classList.remove('ativo'));
}

// ══ MENSAGEM ══
function contarChars(){ document.getElementById('msg-chars').textContent = document.getElementById('msg-input').value.length; }
async function enviar() {
  const txt = document.getElementById('msg-input').value.trim();
  const email = document.getElementById('msg-email').value.trim();
  if (!txt) return;
  const btn = document.getElementById('btn-enviar');
  btn.disabled = true; btn.textContent = 'enviando...';
  try {
    await api('/api/mensagem', { method:'POST', body:{ texto:txt, email:email||'' } });
    document.getElementById('msg-form').style.display = 'none';
    document.getElementById('msg-ok').style.display = 'block';
  } catch(e) {
    btn.disabled = false; btn.textContent = 'enviar';
    alert('Não foi possível enviar. Tente novamente.');
  }
}

// ══ ADMIN ══
async function loginAdmin() {
  const s = document.getElementById('login-senha').value;
  try {
    await api('/api/admin', { method:'GET', headers:{ 'Authorization':'Bearer '+s } });
    adminLogado = true; adminSenha = s;
    document.getElementById('login-erro').style.display = 'none';
    document.getElementById('login-senha').value = '';
    document.getElementById('view-login').classList.remove('open');
    document.getElementById('view-admin').classList.add('open');
    renderAdmin();
  } catch(e) {
    document.getElementById('login-erro').style.display = 'block';
  }
}

function fecharAdmin() {
  adminLogado = false; adminSenha = '';
  document.getElementById('view-admin').classList.remove('open');
  history.replaceState(null, '', window.location.pathname);
}

function abaAdmin(aba) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('ativo'));
  document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('ativo'));
  document.getElementById('aba-'+aba).classList.add('ativo');
  document.querySelector('[onclick="abaAdmin(\''+aba+'\')"]').classList.add('ativo');
}

function mostrarOpcaoMidia(tipo) {
  const upload = document.getElementById('opcao-upload');
  const url = document.getElementById('opcao-url');
  if (tipo === 'upload') {
    upload.style.display = 'block';
    url.style.display = 'none';
  } else {
    upload.style.display = 'none';
    url.style.display = 'block';
  }
}

function prevMidia(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('a-file-nome').textContent = file.name;
  document.getElementById('btn-limpar').style.display = 'block';
  const img = document.getElementById('prev-img'), vid = document.getElementById('prev-vid');
  const r = new FileReader();
  r.onload = function(e){ if(file.type.startsWith('image')){img.src=e.target.result;img.style.display='block';vid.style.display='none';}else{vid.src=e.target.result;vid.style.display='block';vid.play();img.style.display='none';} };
  r.readAsDataURL(file);
}

function limparArquivo() {
  document.getElementById('a-midia').value = '';
  document.getElementById('a-file-nome').textContent = 'escolher arquivo...';
  document.getElementById('btn-limpar').style.display = 'none';
  document.getElementById('prev-img').style.display = 'none';
  document.getElementById('prev-vid').style.display = 'none';
}

async function publicar() {
  const titulo = document.getElementById('a-titulo').value.trim();
  const texto = document.getElementById('a-texto').value.trim();
  const sem = document.getElementById('a-semana').value.trim();
  const fi = document.getElementById('a-midia');
  const st = document.getElementById('a-status');
  const btn = document.getElementById('btn-publicar');
  if (!titulo||!texto||!sem){ st.textContent='preencha título, texto e semana.'; st.className='admin-status err'; return; }
  const tipoMidia = document.querySelector('input[name="tipo-midia"]:checked').value;
  let urlVideo = null;
  if (tipoMidia === 'url') {
    urlVideo = document.getElementById('a-url-video').value.trim();
    if (urlVideo && !validarUrl(urlVideo)) {
      st.textContent = 'URL de vídeo inválida';
      st.className = 'admin-status err';
      return;
    }
  }
  const musicaVocal = document.getElementById('a-musica-vocal').value.trim() || null;
  const musicaInstrumental = document.getElementById('a-musica-instrumental').value.trim() || null;
  async function salvar(midia, midiaTipo) {
    btn.disabled = true; btn.textContent = 'publicando...';
    try {
      await api('/api/publicar', {
        method: 'POST',
        headers: authHeader(),
        body: {
          semana:sem.padStart(2,'0'),
          ano:new Date().getFullYear().toString(),
          titulo, texto,
          midia:midia||'',
          tipo:midiaTipo||'image',
          midia_tipo: midiaTipo ? 'image' : null,
          url_video: urlVideo,
          musica_vocal: musicaVocal,
          musica_instrumental: musicaInstrumental
        }
      });
      ['a-titulo','a-texto','a-semana','a-url-video','a-musica-vocal','a-musica-instrumental'].forEach(function(id){document.getElementById(id).value='';});
      limparArquivo();
      st.textContent = '✓ publicado com sucesso.'; st.className = 'admin-status ok';
      await renderHero();
      renderAdmin();
    } catch(e) {
      st.textContent = 'erro ao publicar. tente novamente.'; st.className = 'admin-status err';
    }
    btn.disabled = false; btn.textContent = 'publicar esta semana';
  }
  if (tipoMidia === 'upload' && fi.files[0]) {
    const file = fi.files[0];
    if (file.size > 5*1024*1024){ st.textContent='arquivo muito grande (máx 5 MB).'; st.className='admin-status err'; return; }
    const tipo = file.type.startsWith('image')?'image':'video';
    const r = new FileReader();
    r.onload = function(e){ salvar(e.target.result, tipo); };
    r.readAsDataURL(file);
  } else if (tipoMidia === 'url' && urlVideo) {
    salvar(null, null);
  } else {
    salvar('', 'image');
  }
}

async function renderAdmin() {
  try {
    const { msgs, emails } = await api('/api/admin', { method:'GET', headers:authHeader() });
    const c = document.getElementById('a-msgs');
    c.innerHTML = msgs.length ? msgs.map(function(m){
      return '<div class="msg-card"><p class="msg-txt">"'+esc(m.texto)+'"</p>'+(m.email?'<p class="msg-email">'+esc(m.email)+'</p>':'')+'<p class="msg-data">'+new Date(m.created_at).toLocaleDateString('pt-BR')+'</p><button class="btn-x" onclick="deletarItem(\'mensagem\','+m.id+')">×</button></div>';
    }).join('') : '<p class="sem-msgs">nenhuma mensagem ainda.</p>';
    const ce = document.getElementById('a-emails');
    ce.innerHTML = emails.length ? emails.map(function(e){
      return '<div class="email-item"><span>'+esc(e.email)+'</span><span style="font-size:0.65rem;color:var(--text-soft)">'+new Date(e.created_at).toLocaleDateString('pt-BR')+'</span></div>';
    }).join('') : '<p class="sem-msgs">nenhum email ainda.</p>';
  } catch(e) { console.error('Admin load error:', e); }
}

async function deletarItem(tipo, id) {
  if (!confirm('tem certeza?')) return;
  try {
    await api('/api/admin', { method:'DELETE', headers:authHeader(), body:{ tipo, id } });
    renderAdmin();
  } catch(e) { alert('erro ao deletar'); }
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function validarUrl(url) {
  try {
    new URL(url);
    return /^https?:\/\//.test(url);
  } catch { return false; }
}

// ══ HASH ROUTING ══
function rotear() {
  if (window.location.hash === '#admin') {
    if (adminLogado) { document.getElementById('view-admin').classList.add('open'); renderAdmin(); }
    else { document.getElementById('view-login').classList.add('open'); }
  }
}

// ══ SOM ══
function getCtx(){ if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)(); return audioCtx; }

function criarBuffer(ctx,tipo){
  const len=3*ctx.sampleRate;
  const buf=ctx.createBuffer(1,len,ctx.sampleRate);
  const d=buf.getChannelData(0);
  if(tipo==='branco'){
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  }else{
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1;
      b0=0.99886*b0+w*0.0555179;
      b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520;
      b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522;
      b5=-0.7616*b5-w*0.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
      b6=w*0.115926;
    }
  }
  return buf;
}

function loopBuf(ctx,buf,dest){
  const s=ctx.createBufferSource();
  s.buffer=buf;
  s.loop=true;
  s.connect(dest);
  s.start();
  return s;
}

const ambientes={
  floresta:function(ctx,m){
    const n=ctx.currentTime,bV=criarBuffer(ctx,'rosa'),fV=ctx.createBiquadFilter(),gV=ctx.createGain();
    fV.type='bandpass';fV.frequency.value=200;fV.Q.value=0.4;
    gV.gain.setValueAtTime(0,n);gV.gain.linearRampToValueAtTime(0.35,n+4);
    const sV=loopBuf(ctx,bV,fV);fV.connect(gV);gV.connect(m);
    const bF=criarBuffer(ctx,'branco'),fF=ctx.createBiquadFilter(),gF=ctx.createGain();
    fF.type='highpass';fF.frequency.value=3800;
    gF.gain.setValueAtTime(0,n);gF.gain.linearRampToValueAtTime(0.025,n+5);
    const lF=ctx.createOscillator(),lgF=ctx.createGain();
    lF.frequency.value=0.12;lgF.gain.value=0.018;lF.connect(lgF);lgF.connect(gF.gain);lF.start();
    const sF=loopBuf(ctx,bF,fF);fF.connect(gF);gF.connect(m);
    const oG=ctx.createOscillator(),gG=ctx.createGain();
    oG.frequency.value=4100;oG.type='sine';
    gG.gain.setValueAtTime(0,n);gG.gain.linearRampToValueAtTime(0.01,n+6);
    const tG=ctx.createOscillator(),tgG=ctx.createGain();
    tG.frequency.value=18;tgG.gain.value=0.008;tG.connect(tgG);tgG.connect(gG.gain);tG.start();
    oG.connect(gG);gG.connect(m);oG.start();
    return{srcs:[sV,sF],oscs:[oG,lF,tG]};
  },
  chuva:function(ctx,m){
    const n=ctx.currentTime,bR=criarBuffer(ctx,'branco'),fR=ctx.createBiquadFilter(),gR=ctx.createGain();
    fR.type='bandpass';fR.frequency.value=1400;fR.Q.value=0.6;
    gR.gain.setValueAtTime(0,n);gR.gain.linearRampToValueAtTime(0.42,n+3);
    const lfo=ctx.createOscillator(),lg=ctx.createGain();
    lfo.frequency.value=0.07;lg.gain.value=0.1;lfo.connect(lg);lg.connect(gR.gain);lfo.start();
    const sR=loopBuf(ctx,bR,fR);fR.connect(gR);gR.connect(m);
    const bG=criarBuffer(ctx,'rosa'),fG=ctx.createBiquadFilter(),gG=ctx.createGain();
    fG.type='lowpass';fG.frequency.value=320;
    gG.gain.setValueAtTime(0,n);gG.gain.linearRampToValueAtTime(0.22,n+4);
    const sG=loopBuf(ctx,bG,fG);fG.connect(gG);gG.connect(m);
    return{srcs:[sR,sG],oscs:[lfo]};
  },
  mar:function(ctx,m){
    const n=ctx.currentTime,bW=criarBuffer(ctx,'rosa'),fW=ctx.createBiquadFilter(),gW=ctx.createGain();
    fW.type='lowpass';fW.frequency.value=700;fW.Q.value=0.8;
    gW.gain.setValueAtTime(0,n);gW.gain.linearRampToValueAtTime(0.45,n+4);
    const lfo=ctx.createOscillator(),lg=ctx.createGain();
    lfo.frequency.value=0.09;lg.gain.value=0.22;lfo.connect(lg);lg.connect(gW.gain);lfo.start();
    const sW=loopBuf(ctx,bW,fW);fW.connect(gW);gW.connect(m);
    const bE=criarBuffer(ctx,'branco'),fE=ctx.createBiquadFilter(),gE=ctx.createGain();
    fE.type='highpass';fE.frequency.value=5000;
    gE.gain.setValueAtTime(0,n);gE.gain.linearRampToValueAtTime(0.02,n+5);
    const l2=ctx.createOscillator(),lg2=ctx.createGain();
    l2.frequency.value=0.11;lg2.gain.value=0.015;l2.connect(lg2);lg2.connect(gE.gain);l2.start();
    const sE=loopBuf(ctx,bE,fE);fE.connect(gE);gE.connect(m);
    return{srcs:[sW,sE],oscs:[lfo,l2]};
  },
  vento:function(ctx,m){
    const n=ctx.currentTime,bV=criarBuffer(ctx,'rosa'),fV=ctx.createBiquadFilter(),gV=ctx.createGain();
    fV.type='bandpass';fV.frequency.value=350;fV.Q.value=0.35;
    gV.gain.setValueAtTime(0,n);gV.gain.linearRampToValueAtTime(0.48,n+5);
    const lfo=ctx.createOscillator(),lg=ctx.createGain();
    lfo.frequency.value=0.04;lg.gain.value=0.28;lfo.connect(lg);lg.connect(gV.gain);lfo.start();
    const sV=loopBuf(ctx,bV,fV);fV.connect(gV);gV.connect(m);
    const bA=criarBuffer(ctx,'branco'),fA=ctx.createBiquadFilter(),gA=ctx.createGain();
    fA.type='bandpass';fA.frequency.value=2200;fA.Q.value=2;
    gA.gain.setValueAtTime(0,n);gA.gain.linearRampToValueAtTime(0.032,n+6);
    const l2=ctx.createOscillator(),lg2=ctx.createGain();
    l2.frequency.value=0.06;lg2.gain.value=0.025;l2.connect(lg2);lg2.connect(gA.gain);l2.start();
    const sA=loopBuf(ctx,bA,fA);fA.connect(gA);gA.connect(m);
    return{srcs:[sV,sA],oscs:[lfo,l2]};
  },
  branco:function(ctx,m){
    const n=ctx.currentTime,b=criarBuffer(ctx,'branco'),g=ctx.createGain();
    g.gain.setValueAtTime(0,n);g.gain.linearRampToValueAtTime(0.25,n+2);
    const s=loopBuf(ctx,b,g);g.connect(m);
    return{srcs:[s],oscs:[]};
  },
  rosa:function(ctx,m){
    const n=ctx.currentTime,b=criarBuffer(ctx,'rosa'),g=ctx.createGain();
    g.gain.setValueAtTime(0,n);g.gain.linearRampToValueAtTime(0.35,n+2);
    const s=loopBuf(ctx,b,g);g.connect(m);
    return{srcs:[s],oscs:[]};
  }
};

function pararSomAtivo(cb){
  if(!somNos.master){if(cb)cb();return;}
  somNos.master.gain.linearRampToValueAtTime(0,audioCtx.currentTime+1.8);
  setTimeout(function(){
    try{
      somNos.srcs.forEach(function(s){s.stop();});
      somNos.oscs.forEach(function(o){o.stop();});
    }catch(e){}
    somNos={};
    if(cb)cb();
  },2000);
}

function escolherSom(nome){
  document.getElementById('som-menu').classList.remove('open');
  if(somAtivo===nome){desligarSom();return;}
  pararSomAtivo(function(){
    const ctx=getCtx(),master=ctx.createGain();
    master.gain.value=0.36;
    master.connect(ctx.destination);
    const nos=ambientes[nome](ctx,master);
    somNos={master,srcs:nos.srcs,oscs:nos.oscs};
    somAtivo=nome;
    atualizarUISom();
  });
}

function desligarSom(){
  document.getElementById('som-menu').classList.remove('open');
  pararSomAtivo(function(){
    somAtivo=null;
    atualizarUISom();
  });
}

function toggleMenuSom(){
  document.getElementById('som-menu').classList.toggle('open');
}

function atualizarUISom(){
  const dot=document.getElementById('som-dot-el'),
      lbl=document.getElementById('som-label'),
      btn=document.getElementById('btn-som');
  document.querySelectorAll('.som-opcao').forEach(function(el){el.classList.remove('ativo');});
  if(somAtivo){
    const nomes={floresta:'floresta',chuva:'chuva',mar:'mar',vento:'vento',branco:'ruído branco',rosa:'ruído rosa'};
    lbl.textContent=nomes[somAtivo]||somAtivo;
    dot.style.display='block';
    btn.classList.add('on');
    const el=document.getElementById('op-'+somAtivo);
    if(el)el.classList.add('ativo');
  }else{
    lbl.textContent='som ambiente';
    dot.style.display='none';
    btn.classList.remove('on');
  }
}

document.addEventListener('click',function(e){
  const menu=document.getElementById('som-menu'),
        btn=document.getElementById('btn-som');
  if(menu.classList.contains('open')&&!menu.contains(e.target)&&!btn.contains(e.target))
    menu.classList.remove('open');
});

// ══ INIT ══
document.addEventListener('DOMContentLoaded', function(){
  renderHero();
  rotear();
  window.addEventListener('hashchange', rotear);
  document.getElementById('login-senha').addEventListener('keydown', function(e){
    if(e.key==='Enter') loginAdmin();
  });
});
