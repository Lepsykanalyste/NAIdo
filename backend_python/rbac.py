"""NAIdo - controle d'acces par role (RBAC) : meme politique que le serveur Node (permissions.json).
RBAC_MODE=enforce (defaut) : refuse les actions interdites | audit : journalise sans bloquer (valve de secours)."""
import json
import logging
import os

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import HTMLResponse, JSONResponse

_FICHIER = os.environ.get("RBAC_FILE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "permissions.json")
with open(_FICHIER, encoding="utf-8") as _f:
    POLITIQUE = json.load(_f)

_log = logging.getLogger("rbac")

# Politique lue dans la base (table politique_acces), rechargee au plus toutes les 60 secondes.
# Si la base est absente ou la politique invalide, la precedente reste active.
_POOL = None
_DERNIER_CHARGEMENT = 0.0
_CLES = ("regles", "publiques", "super_admin_seulement", "tous_connectes")

def definir_pool(pool):
    global _POOL
    _POOL = pool

def _politique_valide(p):
    return isinstance(p, dict) and all(isinstance(p.get(k), list) for k in _CLES) \
        and isinstance(p.get("defaut"), dict) and isinstance(p["defaut"].get("lecture"), list) and isinstance(p["defaut"].get("ecriture"), list)

async def recharger_politique():
    global POLITIQUE
    if _POOL is None:
        return False
    try:
        async with _POOL.acquire() as conn:
            contenu = await conn.fetchval("SELECT contenu FROM politique_acces WHERE id = 1")
        if contenu is None:
            return False
        p = json.loads(contenu) if isinstance(contenu, str) else contenu
        if not _politique_valide(p):
            raise ValueError("politique invalide : la precedente reste active")
        POLITIQUE = p
        return True
    except Exception as e:
        _log.warning("[RBAC] politique non rechargee : %s", e)
        return False

async def rafraichir_si_besoin():
    global _DERNIER_CHARGEMENT
    import time
    if _POOL is None or time.time() - _DERNIER_CHARGEMENT < 60:
        return
    _DERNIER_CHARGEMENT = time.time()
    await recharger_politique()


def _segs(p):
    return [s for s in str(p).split("?")[0].split("/") if s]


def _correspond(motif, chemin):
    m, c = _segs(motif), _segs(chemin)
    return len(m) <= len(c) and all(s == "*" or s == c[i] for i, s in enumerate(m))


def _est_lecture(methode):
    return str(methode).upper() in ("GET", "HEAD", "OPTIONS")


def _methode_ok(regle, methode):
    return "methodes" not in regle or str(methode).upper() in regle["methodes"]


def _normaliser_role(role):
    r = str(role or "").lower().strip()
    return POLITIQUE.get("alias", {}).get(r, r)


def est_publique(methode, chemin):
    return any(_methode_ok(r, methode) and _correspond(r["motif"], chemin) for r in POLITIQUE["publiques"])


def decider(role_brut, methode, chemin):
    role = _normaliser_role(role_brut)
    if role == "super_admin":
        return True, "super_admin"
    if any(_methode_ok(r, methode) and _correspond(r["motif"], chemin) for r in POLITIQUE["super_admin_seulement"]):
        return False, "reserve au super_admin"
    if any(_methode_ok(r, methode) and _correspond(r["motif"], chemin) for r in POLITIQUE["tous_connectes"]):
        return True, "tous connectes"
    if role == "directeur":
        return True, "directeur"
    meilleure = None
    for r in POLITIQUE["regles"]:
        if _correspond(r["motif"], chemin) and (meilleure is None or len(_segs(r["motif"])) > len(_segs(meilleure["motif"]))):
            meilleure = r
    lect = _est_lecture(methode)
    if meilleure:
        liste = meilleure["lecture"] if lect else meilleure["ecriture"]
    else:
        liste = POLITIQUE["defaut"]["lecture" if lect else "ecriture"]
    ok = role in liste
    cible = meilleure["motif"] if meilleure else "defaut"
    return ok, (cible if ok else f"role '{role or '?'}' non autorise sur {cible} ({'lecture' if lect else 'ecriture'})")


# Ouverture d'un PDF protege depuis la barre d'adresse d'un navigateur (sans jeton) : page qui relit le jeton et redemande le PDF
PAGE_PDF = "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>NAIdo - ouverture du document</title></head><body style=\"font-family:sans-serif;text-align:center;padding:40px;color:#374151\"><p id=\"m\">Ouverture du document...</p><script>\n(function () {\n  var m = document.getElementById('m');\n  function echec(texte) {\n    m.textContent = texte + ' ';\n    var a = document.createElement('a'); a.href = '/'; a.textContent = 'Ouvrir NAIdo';\n    m.appendChild(a);\n  }\n  var t = null;\n  try { t = localStorage.getItem('naido_token'); } catch (e) {}\n  if (!t) { echec('Connectez-vous d abord a NAIdo, puis rouvrez ce lien.'); return; }\n  fetch(location.pathname + location.search, { headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/pdf' } })\n    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })\n    .then(function (b) { location.replace(URL.createObjectURL(b)); })\n    .catch(function (e) { echec('Impossible d ouvrir le document (' + (e && e.message ? e.message : 'erreur') + '). Votre session a peut-etre expire : reconnectez-vous, puis rouvrez ce lien.'); });\n})();\n</script></body></html>"


def ouverture_navigateur_pdf(methode, chemin, accept):
    return methode == "GET" and chemin.endswith("/pdf") and "text/html" in (accept or "").lower()


class RbacMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        await rafraichir_si_besoin()
        chemin = request.url.path
        if est_publique(request.method, chemin):
            return await call_next(request)
        h = request.headers.get("authorization", "")
        if not h and ouverture_navigateur_pdf(request.method, chemin, request.headers.get("accept", "")):
            return HTMLResponse(PAGE_PDF, headers={"Cache-Control": "no-store"})
        if not h.lower().startswith("bearer "):
            return await call_next(request)                   # sans jeton : la route repond 401
        try:
            payload = jwt.decode(h[7:], os.environ.get("JWT_SECRET", ""), algorithms=["HS256"])
        except Exception:
            return await call_next(request)
        ok, raison = decider(payload.get("role"), request.method, chemin)
        if ok:
            return await call_next(request)
        _log.warning("[RBAC] REFUS %s role=%s %s %s : %s", payload.get("login") or payload.get("id"), payload.get("role"), request.method, chemin, raison)
        print(f"[RBAC] REFUS {payload.get('login') or payload.get('id')} role={payload.get('role')} {request.method} {chemin} : {raison}", flush=True)
        if os.environ.get("RBAC_MODE", "enforce") == "audit":
            return await call_next(request)
        msg = "Accès refusé : votre rôle ne permet pas cette action"
        return JSONResponse({"detail": msg, "error": msg}, status_code=403)
