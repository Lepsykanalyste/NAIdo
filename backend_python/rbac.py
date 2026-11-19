"""NAIdo - controle d'acces par role (RBAC) : meme politique que le serveur Node (permissions.json).
RBAC_MODE=enforce (defaut) : refuse les actions interdites | audit : journalise sans bloquer (valve de secours)."""
import json
import logging
import os

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

_FICHIER = os.environ.get("RBAC_FILE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "permissions.json")
with open(_FICHIER, encoding="utf-8") as _f:
    POLITIQUE = json.load(_f)

_log = logging.getLogger("rbac")


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


class RbacMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        chemin = request.url.path
        if est_publique(request.method, chemin):
            return await call_next(request)
        h = request.headers.get("authorization", "")
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
