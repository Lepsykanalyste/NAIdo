import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [clock, setClock] = useState('--:--:--');
  const canvasRef = useRef(null);

  const roleRedirect = (role) => {
    const map = {
      operateur:'op', operateur_ext:'op', operateur_sou:'op',
      operateur_imp:'op', operateur_dec:'op',
      regleur:'/regleur', qualite:'/qualite',
      chef_atelier:'/chef', commercial:'/chef', vente:'/chef',
      achat:'/chef', magasinier:'/chef', magasinier_at3:'/chef',
      magasinier_mp:'/chef', magasinier_central:'/chef',
      directeur:'/chef', rh:'/chef', qhse:'/chef',
      technicien:'/chef', super_admin:'/chef',
      technicien_regleur:'/chef',
    };
    return map[role] || '/chef';
  };

  // Horloge
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = v => String(v).padStart(2,'0');
      setClock(`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Canvas particules
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [], raf;
    const COLORS = [[26,107,255],[26,107,255],[26,107,255],[255,45,75]];

    const resize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    class P {
      init() {
        this.x=Math.random()*W; this.y=Math.random()*H;
        this.vx=(Math.random()-.5)*.32; this.vy=(Math.random()-.5)*.32;
        this.r=Math.random()*1.4+.4; this.a=Math.random()*.4+.1;
        this.t=Math.random()*Math.PI*2;
        this.c=COLORS[Math.floor(Math.random()*COLORS.length)];
      }
      constructor() { this.init(); }
      update() {
        this.x+=this.vx; this.y+=this.vy; this.t+=.018;
        if(this.x<0||this.x>W||this.y<0||this.y>H) this.init();
      }
      draw() {
        const a=this.a*(0.7+0.3*Math.sin(this.t));
        ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(${this.c[0]},${this.c[1]},${this.c[2]},${a})`;
        ctx.fill();
      }
    }
    for(let i=0;i<95;i++) particles.push(new P());

    const links = () => {
      const D=125;
      for(let i=0;i<particles.length;i++) for(let j=i+1;j<particles.length;j++) {
        const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<D){
          const a=(1-d/D)*.1;
          const ci=particles[i].c,cj=particles[j].c;
          const r=(ci[0]+cj[0])>>1,g=(ci[1]+cj[1])>>1,b=(ci[2]+cj[2])>>1;
          ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y);
          ctx.lineTo(particles[j].x,particles[j].y);
          ctx.strokeStyle=`rgba(${r},${g},${b},${a})`; ctx.lineWidth=.5; ctx.stroke();
        }
      }
    };

    const loop = () => {
      ctx.clearRect(0,0,W,H); links();
      particles.forEach(p=>{p.update();p.draw();});
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.login, form.password);
      toast.success(`Bienvenue ${user.prenom} !`);
      navigate(roleRedirect(user.role));
    } catch {
      toast.error('Identifiants incorrects');
    } finally { setLoading(false); }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Syne:wght@300;400;600&display=swap');
    .nai-root{position:fixed;inset:0;background:#f0f4ff;font-family:'Syne',sans-serif;color:#0a1628;overflow:hidden;}
    .nai-grid{position:fixed;inset:0;z-index:1;background-image:linear-gradient(rgba(26,107,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(26,107,255,0.06) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;}
    .nai-vignette{position:fixed;inset:0;z-index:2;background:radial-gradient(ellipse at center,transparent 60%,rgba(26,107,255,0.04) 100%);pointer-events:none;}
    .nai-glow-b{position:fixed;top:-15%;left:-10%;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(26,107,255,0.12) 0%,transparent 70%);z-index:1;pointer-events:none;animation:drift 12s ease-in-out infinite alternate;}
    .nai-glow-r{position:fixed;bottom:-15%;right:-10%;width:450px;height:450px;border-radius:50%;background:radial-gradient(circle,rgba(255,45,75,0.1) 0%,transparent 70%);z-index:1;pointer-events:none;animation:drift 10s ease-in-out infinite alternate-reverse;}
    .nai-scan{position:fixed;top:-100%;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(26,107,255,0.2),rgba(255,45,75,0.2),transparent);z-index:3;animation:scan 9s linear infinite;pointer-events:none;}
    @keyframes scan{0%{top:-5%}100%{top:105%}}
    @keyframes drift{0%{transform:translate(0,0)}100%{transform:translate(30px,20px)}}
    .nai-corner{position:fixed;font-family:'Orbitron',monospace;font-size:0.5rem;letter-spacing:0.18em;text-transform:uppercase;pointer-events:none;z-index:10;line-height:1.8;}
    .nai-corner.tl{top:1.4rem;left:1.4rem;color:rgba(26,107,255,0.5);}
    .nai-corner.tr{top:1.4rem;right:1.4rem;color:rgba(26,107,255,0.5);text-align:right;}
    .nai-corner.bl{bottom:1.4rem;left:1.4rem;color:rgba(255,45,75,0.45);}
    .nai-corner.br{bottom:1.4rem;right:1.4rem;color:rgba(255,45,75,0.45);text-align:right;}
    .nai-page{position:relative;z-index:10;height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;}
    .nai-card{width:100%;max-width:448px;background:#ffffff;border:1px solid rgba(26,107,255,0.25);box-shadow:0 20px 60px rgba(26,107,255,0.12);border-radius:2px;padding:3rem 2.5rem 2.5rem;position:relative;backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);animation:slideUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards;opacity:0;}
    .nai-card::before{content:'';position:absolute;top:-1px;left:-1px;width:22px;height:22px;border-top:2px solid #1A6BFF;border-left:2px solid #1A6BFF;}
    .nai-card::after{content:'';position:absolute;bottom:-1px;right:-1px;width:22px;height:22px;border-bottom:2px solid #FF2D4B;border-right:2px solid #FF2D4B;}
    @keyframes slideUp{from{opacity:0;transform:translateY(28px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
    .nai-brand{font-family:'Orbitron',monospace;font-size:2.5rem;font-weight:900;letter-spacing:0.18em;line-height:1;margin-bottom:0.45rem;background:linear-gradient(135deg,#1A6BFF 0%,#6BA4FF 40%,#FF2D4B 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 18px rgba(26,107,255,0.25));}
    .nai-tagline{font-size:0.68rem;letter-spacing:0.3em;text-transform:uppercase;color:rgba(26,107,255,0.6);font-weight:300;}
    .nai-powered{margin-top:0.5rem;font-size:0.58rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,45,75,0.45);}
    .nai-powered strong{color:#FF2D4B;font-weight:600;}
    .nai-sep{display:flex;align-items:center;gap:1rem;margin-bottom:2rem;}
    .nai-sep::before{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(26,107,255,0.3));}
    .nai-sep::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(255,45,75,0.3),transparent);}
    .nai-sep span{font-size:0.62rem;letter-spacing:0.28em;text-transform:uppercase;color:rgba(26,107,255,0.6);white-space:nowrap;}
    .nai-label{display:block;font-size:0.62rem;letter-spacing:0.22em;text-transform:uppercase;color:rgba(26,107,255,0.6);margin-bottom:0.5rem;font-weight:600;}
    .nai-input-wrap{position:relative;display:flex;align-items:center;margin-bottom:1.2rem;}
    .nai-icon{position:absolute;left:13px;color:rgba(26,107,255,0.6);transition:color 0.25s;pointer-events:none;}
    .nai-input{width:100%;background:rgba(26,107,255,0.05);border:1px solid rgba(26,107,255,0.22);border-radius:2px;padding:0.8rem 1rem 0.8rem 2.75rem;font-family:'Syne',sans-serif;font-size:0.88rem;color:#0a1628;outline:none;transition:border-color 0.25s,background 0.25s,box-shadow 0.25s;}
    .nai-input::placeholder{color:rgba(26,107,255,0.6);}
    .nai-input:focus{border-color:rgba(26,107,255,0.65);background:#eef3ff;box-shadow:0 0 0 3px rgba(26,107,255,0.1);}
    .nai-eye{position:absolute;right:11px;background:none;border:none;cursor:pointer;color:rgba(26,107,255,0.6);padding:4px;display:flex;transition:color 0.2s;}
    .nai-eye:hover{color:#1A6BFF;}
    .nai-btn{width:100%;padding:0.9rem;background:linear-gradient(135deg,#1A6BFF,#0F4FCC);border:none;border-radius:2px;font-family:'Orbitron',monospace;font-size:0.75rem;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#fff;cursor:pointer;transition:opacity 0.2s,transform 0.15s;margin-top:0.5rem;}
    .nai-btn:hover:not(:disabled){opacity:0.9;transform:translateY(-1px);}
    .nai-btn:disabled{opacity:0.6;cursor:not-allowed;}
    .nai-btn.success{background:linear-gradient(135deg,#15803d,#166534);}
    .nai-status{display:flex;justify-content:space-between;align-items:center;margin-top:1.8rem;padding-top:1.2rem;border-top:1px solid rgba(26,107,255,0.15);}
    .nai-dot-wrap{display:flex;align-items:center;gap:0.5rem;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(26,107,255,0.6);}
    .nai-dot{width:6px;height:6px;border-radius:50%;background:#1A6BFF;animation:blink 2.2s ease-in-out infinite;}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
    .nai-version{font-family:'Orbitron',monospace;font-size:0.58rem;color:rgba(26,107,255,0.6);letter-spacing:0.2em;}
    .ring-blue{position:absolute;inset:-8px;border:1px solid rgba(26,107,255,0.3);border-radius:50%;animation:pulseRing 2.8s ease-in-out infinite;}
    .ring-red{position:absolute;inset:-17px;border:1px solid rgba(255,45,75,0.15);border-radius:50%;animation:pulseRing 2.8s ease-in-out 0.6s infinite;}
    @keyframes pulseRing{0%,100%{opacity:0.7;transform:scale(1)}50%{opacity:0.15;transform:scale(1.07)}}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="nai-root">
        <canvas ref={canvasRef} style={{position:'fixed',inset:0,zIndex:0}}/>
        <div className="nai-grid"/>
        <div className="nai-vignette"/>
        <div className="nai-glow-b"/>
        <div className="nai-glow-r"/>
        <div className="nai-scan"/>

        <span className="nai-corner tl">SYS // NAIDO-MES<br/>ATELIER — ACTIF</span>
        <span className="nai-corner tr">SESSION<br/>SÉCURISÉE</span>
        <span className="nai-corner bl">© 2026 SOPHOPSY<br/>sophopsy.com</span>
        <span className="nai-corner br">{clock}</span>

        <div className="nai-page">
          <div className="nai-card">
            {/* Logo */}
            <div style={{textAlign:'center',marginBottom:'2.25rem'}}>
              <div style={{width:60,height:60,margin:'0 auto 1.2rem',position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div className="ring-blue"/>
                <div className="ring-red"/>
                <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%',filter:'drop-shadow(0 0 10px rgba(26,107,255,0.4))'}}>
                  <polygon points="30,4 54,18 54,42 30,56 6,42 6,18" stroke="#1A6BFF" strokeWidth="1.5" fill="none"/>
                  <polygon points="30,14 46,23.5 46,36.5 30,46 14,36.5 14,23.5" stroke="#FF2D4B" strokeWidth="1" fill="rgba(255,45,75,0.05)"/>
                  <polygon points="30,22 38,30 30,38 22,30" fill="rgba(26,107,255,0.15)" stroke="#1A6BFF" strokeWidth="1"/>
                  <circle cx="30" cy="30" r="4" fill="#1A6BFF"/>
                  <circle cx="30" cy="30" r="2" fill="#FF2D4B"/>
                  <line x1="30" y1="14" x2="30" y2="22" stroke="#1A6BFF" strokeWidth="1"/>
                  <line x1="30" y1="38" x2="30" y2="46" stroke="#1A6BFF" strokeWidth="1"/>
                  <line x1="14" y1="23.5" x2="21" y2="27.5" stroke="#FF2D4B" strokeWidth="1"/>
                  <line x1="39" y1="32.5" x2="46" y2="36.5" stroke="#FF2D4B" strokeWidth="1"/>
                  <line x1="46" y1="23.5" x2="39" y2="27.5" stroke="#1A6BFF" strokeWidth="1"/>
                  <line x1="21" y1="32.5" x2="14" y2="36.5" stroke="#1A6BFF" strokeWidth="1"/>
                </svg>
              </div>
              <div className="nai-brand">NAIdo</div>
              <div className="nai-tagline">NAI — Digital Operations</div>
              <div className="nai-powered">Powered by <strong>SOPHOPSY.COM</strong></div>
            </div>

            <div className="nai-sep"><span>Accès sécurisé</span></div>

            <form onSubmit={handleLogin}>
              <div>
                <label className="nai-label">Identifiant</label>
                <div className="nai-input-wrap">
                  <svg className="nai-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                  <input className="nai-input" type="text" placeholder="Entrez votre identifiant"
                    value={form.login} onChange={e=>setForm({...form,login:e.target.value})}
                    autoComplete="username" spellCheck="false" required/>
                </div>
              </div>

              <div>
                <label className="nai-label">Mot de passe</label>
                <div className="nai-input-wrap">
                  <svg className="nai-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input className="nai-input" type={showPwd?'text':'password'} placeholder="••••••••"
                    value={form.password} onChange={e=>setForm({...form,password:e.target.value})}
                    autoComplete="current-password" required/>
                  <button type="button" className="nai-eye" onClick={()=>setShowPwd(!showPwd)}>
                    {showPwd
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" className={`nai-btn${loading?'':''}`} disabled={loading}>
                {loading ? 'Authentification...' : 'Connexion'}
              </button>
            </form>

            <div className="nai-status">
              <div className="nai-dot-wrap"><span className="nai-dot"/><span>Système opérationnel</span></div>
              <div className="nai-version">v3.1.0</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
