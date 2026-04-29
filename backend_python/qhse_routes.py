"""
NAIdo QHSE — Routes FastAPI
ISO 9001 / ISO 14001 / ISO 45001 / FSSC 22000
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional, List
import json, os, shutil
from datetime import datetime, date
from pathlib import Path

router = APIRouter(prefix="/api/qhse", tags=["qhse"])

UPLOAD_DIR = Path("/app/uploads/qhse")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def int_or_none(v):
    if v is None or v == "": return None
    try: return int(v)
    except: return None

def safe_json(v, fb=None):
    if fb is None: fb = []
    if isinstance(v, (list, dict)): return v
    if not v or v in ("", "null", "undefined"): return fb
    try: return json.loads(v)
    except: return fb

# ── DASHBOARD ─────────────────────────────────────────────────
async def qhse_dashboard(pool):
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow("SELECT * FROM vue_qhse_dashboard")
            return dict(row) if row else {}
        except:
            return {}

# ── PROCESSUS ─────────────────────────────────────────────────
async def get_processus_list(pool, type_proc=None, search=None):
    async with pool.acquire() as conn:
        q = """
            SELECT 
                p.id, p.code, p.titre AS libelle,
                p.type AS type_processus,
                p.description, p.objectif AS finalite,
                p.statut, p.version, p.actif,
                p.pilote_id, p.copilote_id,
                COALESCE(p.normes_applicables, '[]'::jsonb) AS normes_applicables,
                p.donnees_entree, p.donnees_sortie,
                p.date_revision, p.created_at,
                up.nom||' '||up.prenom AS pilote_nom,
                uc.nom||' '||uc.prenom AS copilote_nom,
                0 AS nb_documents,
                0 AS nb_nc_ouvertes
            FROM processus p
            LEFT JOIN utilisateurs up ON up.id = p.pilote_id
            LEFT JOIN utilisateurs uc ON uc.id = p.copilote_id
            WHERE p.actif = true
        """
        params = []
        if type_proc:
            params.append(type_proc)
            q += f" AND p.type = ${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (p.code ILIKE ${len(params)} OR p.libelle ILIKE ${len(params)})"
        q += " ORDER BY p.type_processus, p.code"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_processus(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO processus (
                code, titre, type, description, objectif,
                pilote_id, copilote_id, normes_applicables,
                donnees_entree, donnees_sortie, version, statut, actif
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'actif',true)
            RETURNING *
        """,
            data["code"].upper(),
            data.get("libelle") or data.get("titre"),
            data.get("type_processus") or data.get("type","realisation"),
            data.get("description"), data.get("finalite") or data.get("objectif"),
            data.get("pilote_id") or None,
            data.get("copilote_id") or None,
            json.dumps(safe_json(data.get("normes_applicables"), [])),
            data.get("donnees_entree"), data.get("donnees_sortie"),
            data.get("version", "v1")
        )
        return dict(row)

async def update_processus(pool, proc_id: str, data: dict):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE processus SET
                titre=$1, description=$2, objectif=$3,
                pilote_id=$4, copilote_id=$5,
                normes_applicables=$6,
                donnees_entree=$7, donnees_sortie=$8,
                statut=$9, date_revision=CURRENT_DATE
            WHERE id=$10 RETURNING *
        """,
            data.get("libelle") or data.get("titre"),
            data.get("description"),
            data.get("finalite") or data.get("objectif"),
            data.get("pilote_id") or None, data.get("copilote_id") or None,
            json.dumps(safe_json(data.get("normes_applicables"), [])),
            data.get("donnees_entree"), data.get("donnees_sortie"),
            data.get("statut", "actif"),
            proc_id
        )
        return dict(row) if row else None

# ── NON-CONFORMITÉS ───────────────────────────────────────────
async def get_nc_list(pool, statut=None, type_nc=None, gravite=None, search=None):
    async with pool.acquire() as conn:
        q = """
            SELECT nc.*,
                ud.nom||' '||ud.prenom AS detecteur_nom,
                ur.nom||' '||ur.prenom AS responsable_nom
            FROM non_conformites nc
            LEFT JOIN utilisateurs ud ON ud.id = nc.detecteur_id
            LEFT JOIN utilisateurs ur ON ur.id = nc.responsable_traitement_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND nc.statut = ${len(params)}"
        if type_nc:
            params.append(type_nc)
            q += f" AND nc.type_nc = ${len(params)}"
        if gravite:
            params.append(gravite)
            q += f" AND nc.gravite = ${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (nc.numero_nc ILIKE ${len(params)} OR nc.titre ILIKE ${len(params)})"
        q += " ORDER BY nc.created_at DESC LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_nc(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO non_conformites (
                type_nc, gravite, titre, description,
                produit_concerne, lot_concerne,
                atelier_id, machine_id,
                date_detection, detecteur_id, responsable_traitement_id,
                action_immediate, normes_applicables,
                gravite_score, occurrence_score, detectabilite_score,
                delai_traitement_jours, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING *
        """,
            data.get("type_nc","qualite"),
            data.get("gravite","mineure"), data["titre"], data.get("description",""),
            data.get("produit_concerne"), data.get("lot_concerne"),
            int_or_none(data.get("atelier_id")), int_or_none(data.get("machine_id")),
            data.get("date_detection") or date.today().isoformat(),
            data.get("detecteur_id") or user_id,
            data.get("responsable_traitement_id") or None,
            data.get("action_immediate"),
            json.dumps(safe_json(data.get("normes_applicables"), [])),
            int(data.get("gravite_score",1) or 1),
            int(data.get("occurrence_score",1) or 1),
            int(data.get("detectabilite_score",1) or 1),
            int(data.get("delai_traitement_jours",30) or 30),
            data.get("notes")
        )
        return dict(row)

async def update_nc(pool, nc_id: str, data: dict):
    async with pool.acquire() as conn:
        sets, vals = [], []
        def add(col, val):
            vals.append(val); sets.append(f"{col}=${len(vals)}")

        for field in ["titre","description","statut","gravite","action_immediate",
                     "action_corrective","action_preventive","cause_principale",
                     "cause_matiere","cause_milieu","cause_machine","cause_methode",
                     "cause_main_oeuvre","verification_efficacite","notes"]:
            if field in data: add(field, data[field] or None)

        if "date_cloture" in data: add("date_cloture", data["date_cloture"] or None)
        if "date_verification" in data: add("date_verification", data["date_verification"] or None)
        if "efficacite_confirmee" in data: add("efficacite_confirmee", bool(data["efficacite_confirmee"]))
        if "gravite_score" in data: add("gravite_score", int(data["gravite_score"] or 1))
        if "occurrence_score" in data: add("occurrence_score", int(data["occurrence_score"] or 1))
        if "detectabilite_score" in data: add("detectabilite_score", int(data["detectabilite_score"] or 1))
        if "gravite_amdec" in data: add("gravite_amdec", int(data["gravite_amdec"] or 1))
        if "occurrence_amdec" in data: add("occurrence_amdec", int(data["occurrence_amdec"] or 1))
        if "detectabilite_amdec" in data: add("detectabilite_amdec", int(data["detectabilite_amdec"] or 1))
        if "responsable_traitement_id" in data: add("responsable_traitement_id", data["responsable_traitement_id"] or None)
        if "cout_nc" in data: add("cout_nc", float(data["cout_nc"] or 0))

        add("updated_at", datetime.utcnow())
        vals.append(nc_id)
        if len(sets) <= 1: return None

        row = await conn.fetchrow(
            f"UPDATE non_conformites SET {','.join(sets)} WHERE id=${len(vals)} RETURNING *",
            *vals
        )
        return dict(row) if row else None

# ── DOCUMENTS ─────────────────────────────────────────────────
async def get_documents_list(pool, processus_id=None, type_doc=None, statut=None, search=None):
    async with pool.acquire() as conn:
        q = """
            SELECT d.*,
                p.titre AS processus_libelle,
                ur.nom||' '||ur.prenom AS redacteur_nom,
                ua.nom||' '||ua.prenom AS approbateur_nom
            FROM documents_qhse d
            LEFT JOIN processus p ON p.id = d.processus_id
            LEFT JOIN utilisateurs ur ON ur.id = d.redacteur_id
            LEFT JOIN utilisateurs ua ON ua.id = d.approbateur_id
            WHERE d.actif = true
        """
        params = []
        if processus_id:
            params.append(processus_id)
            q += f" AND d.processus_id = ${len(params)}"
        if type_doc:
            params.append(type_doc)
            q += f" AND d.type_document = ${len(params)}"
        if statut:
            params.append(statut)
            q += f" AND d.statut = ${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (d.code ILIKE ${len(params)} OR d.titre ILIKE ${len(params)})"
        q += " ORDER BY d.type_document, d.code"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

# ── AUDITS ────────────────────────────────────────────────────
async def get_audits_list(pool, statut=None, norme=None):
    async with pool.acquire() as conn:
        q = """
            SELECT a.*,
                u.nom||' '||u.prenom AS auditeur_chef_nom,
                (SELECT COUNT(*) FROM ecarts_audit e WHERE e.audit_id=a.id) AS nb_ecarts_total
            FROM audits a
            LEFT JOIN utilisateurs u ON u.id = a.auditeur_chef_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND a.statut = ${len(params)}"
        if norme:
            params.append(norme)
            q += f" AND a.norme_auditee = ${len(params)}"
        q += " ORDER BY a.date_planifiee DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_audit(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO audits (
                titre, type_audit, norme_auditee,
                processus_audites, ateliers_audites,
                auditeur_chef_id, auditeurs,
                date_planifiee, duree_jours
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
        """,
            data["titre"], data.get("type_audit","interne"),
            data.get("norme_auditee"),
            json.dumps(safe_json(data.get("processus_audites"),[])),
            json.dumps(safe_json(data.get("ateliers_audites"),[])),
            data.get("auditeur_chef_id") or user_id,
            json.dumps(safe_json(data.get("auditeurs"),[])),
            data.get("date_planifiee") or None,
            float(data.get("duree_jours",1) or 1)
        )
        return dict(row)

# ── RISQUES ───────────────────────────────────────────────────
async def get_risques_list(pool, type_r=None, categorie=None):
    async with pool.acquire() as conn:
        q = """
            SELECT r.*, p.titre AS processus_libelle,
                u.nom||' '||u.prenom AS responsable_nom
            FROM risques_opportunites r
            LEFT JOIN processus p ON p.id = r.processus_id
            LEFT JOIN utilisateurs u ON u.id = r.responsable_id
            WHERE 1=1
        """
        params = []
        if type_r:
            params.append(type_r)
            q += f" AND r.type = ${len(params)}"
        if categorie:
            params.append(categorie)
            q += f" AND r.categorie = ${len(params)}"
        q += " ORDER BY r.ipr DESC, r.criticite DESC"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

# ── INDICATEURS ───────────────────────────────────────────────
async def get_indicateurs(pool, processus_id=None):
    async with pool.acquire() as conn:
        q = """
            SELECT i.*,
                p.titre AS processus_libelle,
                u.nom||' '||u.prenom AS responsable_nom,
                (SELECT vi.valeur FROM valeurs_indicateurs vi
                 WHERE vi.indicateur_id=i.id ORDER BY vi.periode DESC LIMIT 1) AS derniere_valeur,
                (SELECT vi.periode FROM valeurs_indicateurs vi
                 WHERE vi.indicateur_id=i.id ORDER BY vi.periode DESC LIMIT 1) AS derniere_periode
            FROM indicateurs_qhse i
            LEFT JOIN processus p ON p.id = i.processus_id
            LEFT JOIN utilisateurs u ON u.id = i.responsable_id
            WHERE i.actif = true
        """
        params = []
        if processus_id:
            params.append(processus_id)
            q += f" AND i.processus_id = ${len(params)}"
        q += " ORDER BY i.norme_associee, i.code"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

# ── ACCIDENTS SST ─────────────────────────────────────────────
async def get_accidents_list(pool, type_a=None, statut=None):
    async with pool.acquire() as conn:
        q = """
            SELECT a.*, at.libelle AS atelier_libelle,
                u.nom||' '||u.prenom AS victime_nom_user
            FROM accidents_incidents a
            LEFT JOIN ateliers at ON at.id = a.atelier_id
            LEFT JOIN utilisateurs u ON u.id = a.victime_id
            WHERE 1=1
        """
        params = []
        if type_a:
            params.append(type_a)
            q += f" AND a.type = ${len(params)}"
        if statut:
            params.append(statut)
            q += f" AND a.statut = ${len(params)}"
        q += " ORDER BY a.date_accident DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

# ── HABILITATIONS ─────────────────────────────────────────────
async def get_habilitations_list(pool, utilisateur_id=None, expiration_proche=False):
    async with pool.acquire() as conn:
        q = """
            SELECT h.*, u.nom, u.prenom, u.matricule
            FROM habilitations h
            JOIN utilisateurs u ON u.id = h.utilisateur_id
            WHERE 1=1
        """
        params = []
        if utilisateur_id:
            params.append(utilisateur_id)
            q += f" AND h.utilisateur_id = ${len(params)}"
        if expiration_proche:
            q += " AND h.date_expiration <= CURRENT_DATE + INTERVAL '60 days'"
        q += " ORDER BY h.date_expiration ASC NULLS LAST"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]
