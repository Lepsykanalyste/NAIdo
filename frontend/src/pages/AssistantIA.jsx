import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

const MODES = [
  { id:'chat',       label:'💬 Chat libre',         desc:'Posez n\'importe quelle question' },
  { id:'nc',         label:'🔍 Analyser une NC',    desc:'Analyse causes + actions correctives' },
  { id:'production', label:'📊 Analyser production', desc:'Analyse KPI et optimisations' },
  { id:'procedure',  label:'📋 Générer procédure',   desc:'Procédure ISO automatique' },
  { id:'panne',      label:'🔧 Diagnostiquer panne', desc:'Analyse et réparation équipement' },
];

export default function AssistantIA() {
  const [mode, setMode] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [iaStatus, setIaStatus] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  // Formulaires spécifiques
  const [ncId, setNcId] = useState('');
  const [prodForm, setProdForm] = useState({ atelier_id:'', date_debut:'', date_fin:'' });
  const [procedureForm, setProcedureForm] = useState({ titre:'', type_processus:'production', atelier:'', contexte:'' });
  const [panneForm, setPanneForm] = useState({ equipement:'', symptomes:'', historique_pannes:'' });
  const [ateliers, setAteliers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Vérifier statut IA
    axios.get(`${API}/ia/status`).then(({ data }) => setIaStatus(data)).catch(() => setIaStatus({ disponible: false }));
    // Charger suggestions
    axios.get(`${API}/ia/suggestions`).then(({ data }) => setSuggestions(data)).catch(() => {});
    // Charger ateliers
    axios.get(`${API}/ateliers`).then(({ data }) => setAteliers(data)).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const envoyerMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role:'user', content:userMsg, time: new Date() }]);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/ia/chat`, {
        message: userMsg,
        historique: messages.map(m => ({ role: m.role, content: m.content }))
      });
      setMessages(prev => [...prev, { role:'assistant', content:data.reponse, time: new Date(), modele: data.modele }]);
    } catch (err) {
      toast.error('IA non disponible');
      setMessages(prev => [...prev, { role:'assistant', content:'❌ IA non disponible. Vérifiez qu\'Ollama est démarré.', time: new Date() }]);
    } finally { setLoading(false); }
  };

  const analyserNC = async () => {
    if (!ncId) return toast.error('Entrez un ID de non-conformité');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/ia/analyser-nc`, { nc_id: ncId });
      setMessages(prev => [...prev,
        { role:'user', content:`Analyse la non-conformité ${data.nc}`, time: new Date() },
        { role:'assistant', content:data.analyse, time: new Date() }
      ]);
      setMode('chat');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  };

  const analyserProduction = async () => {
    if (!prodForm.date_debut || !prodForm.date_fin) return toast.error('Dates requises');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/ia/analyser-production`, prodForm);
      setMessages(prev => [...prev,
        { role:'user', content:`Analyse la production du ${prodForm.date_debut} au ${prodForm.date_fin}`, time: new Date() },
        { role:'assistant', content:data.analyse, time: new Date() }
      ]);
      setMode('chat');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  };

  const genererProcedure = async () => {
    if (!procedureForm.titre) return toast.error('Titre requis');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/ia/generer-procedure`, procedureForm);
      setMessages(prev => [...prev,
        { role:'user', content:`Génère la procédure : ${procedureForm.titre}`, time: new Date() },
        { role:'assistant', content:data.procedure, time: new Date() }
      ]);
      setMode('chat');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  };

  const diagnostiquerPanne = async () => {
    if (!panneForm.equipement || !panneForm.symptomes) return toast.error('Équipement et symptômes requis');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/ia/analyser-panne`, panneForm);
      setMessages(prev => [...prev,
        { role:'user', content:`Diagnostique la panne de : ${panneForm.equipement}`, time: new Date() },
        { role:'assistant', content:data.analyse, time: new Date() }
      ]);
      setMode('chat');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  };

  const effacerConversation = () => {
    setMessages([]);
    toast.success('Conversation effacée');
  };

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', display:'flex', gap:16, height:'calc(100vh - 120px)' }}>

      {/* Sidebar gauche */}
      <div style={{ width:260, flexShrink:0, display:'flex', flexDirection:'column', gap:12 }}>

        {/* Statut IA */}
        <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #e5e7eb' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background: iaStatus?.disponible ? '#16a34a' : '#dc2626' }}/>
            <span style={{ fontWeight:700, fontSize:13, color: iaStatus?.disponible ? '#15803d' : '#dc2626' }}>
              {iaStatus?.disponible ? 'IA disponible' : 'IA hors ligne'}
            </span>
          </div>
          {iaStatus?.disponible ? (
            <div style={{ fontSize:11, color:'#6b7280' }}>
              Modèle : {iaStatus.modele_actif}<br/>
              Ollama : {iaStatus.url}
            </div>
          ) : (
            <div style={{ fontSize:11, color:'#dc2626' }}>
              Démarrez Ollama sur le serveur :<br/>
              <code style={{ fontSize:10 }}>ollama serve</code>
            </div>
          )}
        </div>

        {/* Modes */}
        <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:10 }}>MODE D'ASSISTANCE</div>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:8, border:'none',
              background: mode===m.id ? '#f0fdf4' : 'none', cursor:'pointer', marginBottom:4,
              borderLeft: mode===m.id ? '3px solid #14532d' : '3px solid transparent'
            }}>
              <div style={{ fontSize:13, fontWeight: mode===m.id ? 700 : 400, color: mode===m.id ? '#14532d' : '#374151' }}>{m.label}</div>
              <div style={{ fontSize:11, color:'#9ca3af' }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Suggestions IA */}
        {suggestions.length > 0 && (
          <div style={{ background:'#fff', borderRadius:12, padding:14, border:'1px solid #e5e7eb', overflow:'auto', flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:10 }}>
              💡 SUGGESTIONS IA ({suggestions.length})
            </div>
            {suggestions.slice(0,3).map(s => (
              <div key={s.id} style={{ background:'#fefce8', borderRadius:8, padding:'8px 10px', marginBottom:8, fontSize:11, color:'#713f12', border:'1px solid #fde68a' }}>
                <div style={{ fontWeight:600, marginBottom:4 }}>{s.type.replace(/_/g,' ')}</div>
                <div style={{ color:'#92400e' }}>{s.suggestion.substring(0, 100)}...</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone principale */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Formulaires spécifiques selon le mode */}
        {mode !== 'chat' && (
          <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e5e7eb', marginBottom:12 }}>
            {mode === 'nc' && (
              <div>
                <h4 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700, color:'#374151' }}>🔍 Analyse de Non-Conformité</h4>
                <div style={{ display:'flex', gap:10 }}>
                  <input value={ncId} onChange={e => setNcId(e.target.value)} placeholder="ID de la NC (UUID)"
                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}/>
                  <button onClick={analyserNC} disabled={loading}
                    style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
                    {loading ? 'Analyse...' : 'Analyser'}
                  </button>
                </div>
              </div>
            )}
            {mode === 'production' && (
              <div>
                <h4 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700 }}>📊 Analyse Production</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:10, alignItems:'end' }}>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Atelier</label>
                    <select value={prodForm.atelier_id} onChange={e => setProdForm({...prodForm, atelier_id:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                      <option value="">Tous</option>
                      {ateliers.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Du</label>
                    <input type="date" value={prodForm.date_debut} onChange={e => setProdForm({...prodForm, date_debut:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Au</label>
                    <input type="date" value={prodForm.date_fin} onChange={e => setProdForm({...prodForm, date_fin:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
                  </div>
                  <button onClick={analyserProduction} disabled={loading}
                    style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>
                    {loading ? '...' : 'Analyser'}
                  </button>
                </div>
              </div>
            )}
            {mode === 'procedure' && (
              <div>
                <h4 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700 }}>📋 Générer Procédure ISO</h4>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Titre *</label>
                    <input value={procedureForm.titre} onChange={e => setProcedureForm({...procedureForm, titre:e.target.value})}
                      placeholder="Ex: Contrôle qualité produit fini"
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Type</label>
                    <select value={procedureForm.type_processus} onChange={e => setProcedureForm({...procedureForm, type_processus:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                      {['production','qualite','maintenance','securite','achat','rh'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Atelier</label>
                    <select value={procedureForm.atelier} onChange={e => setProcedureForm({...procedureForm, atelier:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                      <option value="">Tous</option>
                      {ateliers.map(a => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <textarea value={procedureForm.contexte} onChange={e => setProcedureForm({...procedureForm, contexte:e.target.value})}
                    placeholder="Contexte spécifique, contraintes particulières..." rows={2}
                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, resize:'none' }}/>
                  <button onClick={genererProcedure} disabled={loading}
                    style={{ background:'#7e22ce', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, cursor:'pointer', fontWeight:600, alignSelf:'center' }}>
                    {loading ? '...' : 'Générer'}
                  </button>
                </div>
              </div>
            )}
            {mode === 'panne' && (
              <div>
                <h4 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700 }}>🔧 Diagnostic de Panne</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Équipement *</label>
                    <input value={panneForm.equipement} onChange={e => setPanneForm({...panneForm, equipement:e.target.value})}
                      placeholder="Ex: Extrudeuse EX04" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:12, display:'block', marginBottom:3 }}>Symptômes *</label>
                    <input value={panneForm.symptomes} onChange={e => setPanneForm({...panneForm, symptomes:e.target.value})}
                      placeholder="Ex: Vibrations anormales, surchauffe..." style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <textarea value={panneForm.historique_pannes} onChange={e => setPanneForm({...panneForm, historique_pannes:e.target.value})}
                    placeholder="Historique des pannes récentes..." rows={2}
                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, resize:'none' }}/>
                  <button onClick={diagnostiquerPanne} disabled={loading}
                    style={{ background:'#b45309', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, cursor:'pointer', fontWeight:600, alignSelf:'center' }}>
                    {loading ? '...' : 'Diagnostiquer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Zone chat */}
        <div style={{ flex:1, background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>
            {messages.length === 0 && (
              <div style={{ textAlign:'center', color:'#9ca3af', margin:'auto' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🤖</div>
                <p style={{ fontSize:15, fontWeight:600, color:'#374151' }}>Assistant IA NAIdo</p>
                <p style={{ fontSize:13 }}>Propulsé par Ollama · {iaStatus?.modele_actif || 'Chargement...'}</p>
                <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginTop:16 }}>
                  {['Analyse mon TRS de cette semaine','Quelles sont les causes de rebus ?','Génère une procédure de nettoyage','Comment optimiser la cadence ?'].map(q => (
                    <button key={q} onClick={() => { setInput(q); }} style={{
                      background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d',
                      padding:'8px 14px', borderRadius:20, cursor:'pointer', fontSize:12
                    }}>{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth:'80%', padding:'12px 16px', borderRadius:12,
                  background: m.role==='user' ? '#14532d' : '#f9fafb',
                  color: m.role==='user' ? '#fff' : '#374151',
                  border: m.role==='assistant' ? '1px solid #e5e7eb' : 'none',
                  fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap'
                }}>
                  {m.role === 'assistant' && (
                    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:6 }}>
                      🤖 IA · {m.modele || ''} · {m.time?.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}
                    </div>
                  )}
                  {m.content}
                  {m.role === 'user' && (
                    <div style={{ fontSize:10, color:'#86efac', marginTop:4, textAlign:'right' }}>
                      {m.time?.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', justifyContent:'flex-start' }}>
                <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#9ca3af' }}>
                  🤖 IA réfléchit... ⏳
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Input */}
          {mode === 'chat' && (
            <div style={{ padding:'12px 16px', borderTop:'1px solid #e5e7eb', display:'flex', gap:10, alignItems:'flex-end' }}>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage(); } }}
                placeholder="Posez votre question... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
                rows={2} style={{ flex:1, border:'1px solid #d1d5db', borderRadius:10, padding:'10px 14px', fontSize:13, resize:'none', outline:'none' }}/>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <button onClick={envoyerMessage} disabled={loading || !input.trim()}
                  style={{ background: (loading||!input.trim()) ? '#d1d5db' : '#14532d', color:'#fff', border:'none', padding:'10px 18px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13 }}>
                  {loading ? '...' : '↑ Envoyer'}
                </button>
                {messages.length > 0 && (
                  <button onClick={effacerConversation} style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:11 }}>
                    Effacer
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
