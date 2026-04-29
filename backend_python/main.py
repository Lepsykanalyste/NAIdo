from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncpg, os, json
from contextlib import asynccontextmanager
from typing import Optional, List, Any
from pydantic import BaseModel
import uvicorn

# ── CONFIG ─────────────────────────────────────────────────────
DB_URL = os.getenv("DATABASE_URL", "postgresql://naido_user:naido_pass_2026@naido_postgres:5436/naido_db")
JWT_SECRET = os.getenv("JWT_SECRET", "naido_secret_2026")

# ── DB POOL ────────────────────────────────────────────────────
pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(DB_URL, min_size=3, max_size=10)
    print("NAIdo Python API démarré ✓")
    yield
    await pool.close()

app = FastAPI(title="NAIdo API", version="4.0", lifespan=lifespan)

# Import stock routes module
from stock_routes import inventaire_handler, resume_handler, mouvement_handler
# Import GMAO routes module
from gmao_routes import (
    gmao_dashboard, get_equipements, create_equipement,
    get_ots, create_ot, update_ot,
    get_plans, create_plan, generer_ot_depuis_plan,
    get_pieces, get_indicateurs_equipement,
    get_releves_energie, dashboard_energie
)
# Import RH routes module
from rh_routes import (
    rh_dashboard, get_postes, get_employes, create_employe,
    get_contrats, create_contrat,
    get_conges, create_conge, valider_conge,
    get_bulletins, generer_bulletin,
    get_presences, get_evaluations
)
# Import QHSE routes module
from qhse_routes import (
    qhse_dashboard, get_processus_list, create_processus, update_processus,
    get_nc_list, create_nc, update_nc,
    get_documents_list, get_audits_list, create_audit,
    get_risques_list, get_indicateurs,
    get_accidents_list, get_habilitations_list
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── AUTH ───────────────────────────────────────────────────────
import jwt, bcrypt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(401, "Token manquant")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except:
        raise HTTPException(401, "Token invalide")

# ── HELPERS ────────────────────────────────────────────────────
def safe_json(val, fallback=None):
    """Parse JSON en toute sécurité - accepte string, list, dict, None"""
    if fallback is None:
        fallback = []
    if val is None or val == "" or val == "null" or val == "undefined":
        return fallback
    if isinstance(val, (list, dict)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except:
            return fallback
    return fallback

def num(v, default=None):
    """Convertit en float ou None"""
    if v is None or v == "":
        return default
    try:
        return float(v)
    except:
        return default

def int_or_none(v):
    """Convertit en int ou None"""
    if v is None or v == "":
        return None
    try:
        return int(v)
    except:
        return None

# ── ROUTES AUTH ────────────────────────────────────────────────
from datetime import datetime, timedelta

class LoginRequest(BaseModel):
    login: str
    password: str

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT u.*, r.nom as role FROM utilisateurs u LEFT JOIN roles r ON r.id=u.role_id WHERE u.login=$1 AND u.actif=true",
            req.login
        )
        if not user:
            raise HTTPException(401, "Identifiants incorrects")
        if not bcrypt.checkpw(req.password.encode(), user['password_hash'].encode()):
            raise HTTPException(401, "Identifiants incorrects")
        token = jwt.encode({
            "id": str(user['id']),
            "login": user['login'],
            "role": user['role'],
            "nom": user['nom'],
            "prenom": user['prenom'],
            "exp": datetime.utcnow() + timedelta(days=7)
        }, JWT_SECRET, algorithm="HS256")
        return {"token": token, "user": {"id": str(user['id']), "login": user['login'], "nom": user['nom'], "prenom": user['prenom'], "role": user['role']}}

# ── ROUTES ARTICLES ────────────────────────────────────────────
@app.get("/api/articles")
async def get_articles(
    search: Optional[str] = None,
    type_article: Optional[str] = None,
    exclure_mp: Optional[str] = None,
    famille_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    async with pool.acquire() as conn:
        q = """
            SELECT a.id, a.code, a.designation, a.couleur, a.type_article,
                a.poids_theorique_kg, a.poids_reel_kg, a.cadence_theorique_kg_h,
                a.temps_reglage_min, a.prix_achat, a.prix_vente, a.prix_cession_interne,
                a.stock_mini, a.tracabilite_type, a.format_lot, a.actif,
                a.longueur_mm, a.largeur_mm, a.hauteur_mm,
                a.photo_path, a.fiche_technique_path, a.fiche_securite_path,
                a.dlc_jours, a.points_ccp, a.normes_iso, a.certifications,
                a.fournisseur, a.reference_fournisseur, a.densite,
                a.temperature_fusion, a.temperature_traitement,
                a.conditions_stockage, a.risques_securite, a.epi_requis,
                a.composition, a.notes, a.atelier_production_id,
                a.famille_id, a.unite_mesure_id, a.created_at,
                f.libelle AS famille_libelle, f.code AS famille_code,
                um.code AS unite_code, um.libelle AS unite_libelle,
                COALESCE(SUM(sa.qte_disponible),0) AS stock_total
            FROM articles a
            LEFT JOIN familles_articles f ON f.id=a.famille_id
            LEFT JOIN unites_mesure um ON um.id=a.unite_mesure_id
            LEFT JOIN stock_articles sa ON sa.article_id=a.id
            WHERE a.actif=true
        """
        params = []
        if exclure_mp == "true":
            q += " AND a.type_article!='matiere_premiere'"
        if type_article:
            params.append(type_article)
            q += f" AND a.type_article=${len(params)}"
        if famille_id:
            params.append(int(famille_id))
            q += f" AND a.famille_id=${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (a.code ILIKE ${len(params)} OR a.designation ILIKE ${len(params)})"
        q += " GROUP BY a.id,f.libelle,f.code,um.code,um.libelle ORDER BY a.type_article,a.code"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.get("/api/articles/{article_id}")
async def get_article(article_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT a.*, f.libelle AS famille_libelle, um.code AS unite_code,
               COALESCE(SUM(sa.qte_disponible),0) AS stock_total
               FROM articles a
               LEFT JOIN familles_articles f ON f.id=a.famille_id
               LEFT JOIN unites_mesure um ON um.id=a.unite_mesure_id
               LEFT JOIN stock_articles sa ON sa.article_id=a.id
               WHERE a.id=$1 GROUP BY a.id,f.libelle,um.code""",
            article_id
        )
        if not row:
            raise HTTPException(404, "Article introuvable")
        return dict(row)

@app.post("/api/articles")
async def create_article(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("designation"):
            raise HTTPException(400, "Code et désignation requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO articles (
                    code,designation,famille_id,unite_mesure_id,type_article,
                    tracabilite_type,format_lot,couleur,
                    longueur_mm,largeur_mm,hauteur_mm,
                    poids_theorique_kg,poids_reel_kg,poids_mandrin_kg,
                    cadence_theorique_kg_h,temps_reglage_min,
                    prix_achat,prix_vente,prix_cession_interne,
                    stock_mini,dlc_jours,allergenes,points_ccp,
                    normes_iso,atelier_production_id,
                    composition,notes,actif
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                    $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,true
                ) RETURNING id,code,designation,type_article
            """,
                d["code"].upper().strip(),
                d["designation"].strip(),
                int_or_none(d.get("famille_id")),
                int_or_none(d.get("unite_mesure_id")),
                d.get("type_article", "produit_fini"),
                d.get("tracabilite_type", "lot"),
                d.get("format_lot", "LOT-YYYYMMDD-001"),
                d.get("couleur") or None,
                num(d.get("longueur_mm")),
                num(d.get("largeur_mm")),
                num(d.get("hauteur_mm")),
                num(d.get("poids_theorique_kg")),
                num(d.get("poids_reel_kg")),
                num(d.get("poids_mandrin_kg")),
                num(d.get("cadence_theorique_kg_h")),
                num(d.get("temps_reglage_min"), 30),
                num(d.get("prix_achat"), 0),
                num(d.get("prix_vente"), 0),
                num(d.get("prix_cession_interne"), 0),
                num(d.get("stock_mini"), 0),
                int_or_none(d.get("dlc_jours")),
                d.get("allergenes") or None,
                bool(d.get("points_ccp", False)),
                d.get("normes_iso") or None,
                int_or_none(d.get("atelier_production_id")),
                json.dumps(safe_json(d.get("composition"), [])),
                d.get("notes") or None,
            )
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, f"Code '{d['code']}' déjà existant")

@app.put("/api/articles/{article_id}")
async def update_article(article_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        sets, vals = [], []

        def add(col, val):
            vals.append(val)
            sets.append(f"{col}=${len(vals)}")

        if "designation" in d: add("designation", d["designation"])
        if "famille_id" in d: add("famille_id", int_or_none(d["famille_id"]))
        if "unite_mesure_id" in d: add("unite_mesure_id", int_or_none(d["unite_mesure_id"]))
        if "atelier_production_id" in d: add("atelier_production_id", int_or_none(d["atelier_production_id"]))
        if "type_article" in d: add("type_article", d["type_article"])
        if "couleur" in d: add("couleur", d["couleur"] or None)
        if "fournisseur" in d: add("fournisseur", d["fournisseur"] or None)
        if "poids_theorique_kg" in d: add("poids_theorique_kg", num(d["poids_theorique_kg"]))
        if "cadence_theorique_kg_h" in d: add("cadence_theorique_kg_h", num(d["cadence_theorique_kg_h"]))
        if "temps_reglage_min" in d: add("temps_reglage_min", num(d["temps_reglage_min"], 30))
        if "prix_achat" in d: add("prix_achat", num(d["prix_achat"], 0))
        if "prix_vente" in d: add("prix_vente", num(d["prix_vente"], 0))
        if "prix_cession_interne" in d: add("prix_cession_interne", num(d["prix_cession_interne"], 0))
        if "stock_mini" in d: add("stock_mini", num(d["stock_mini"], 0))
        if "normes_iso" in d: add("normes_iso", d["normes_iso"] or None)
        if "notes" in d: add("notes", d["notes"] or None)
        if "points_ccp" in d: add("points_ccp", bool(d["points_ccp"]))
        if "actif" in d: add("actif", bool(d["actif"]))
        # JSONB — Python gère nativement, zéro problème de type
        if "composition" in d:
            add("composition", json.dumps(safe_json(d["composition"], [])))

        from datetime import datetime
        add("updated_at", datetime.utcnow())
        vals.append(article_id)

        row = await conn.fetchrow(
            f"UPDATE articles SET {','.join(sets)} WHERE id=${len(vals)} RETURNING id,code,designation",
            *vals
        )
        if not row:
            raise HTTPException(404, "Article introuvable")
        return dict(row)

@app.delete("/api/articles/{article_id}")
async def delete_article(article_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE articles SET actif=false WHERE id=$1", article_id)
        return {"success": True}

# ── ROUTES RÉFÉRENTIELS ────────────────────────────────────────
@app.get("/api/referentiels/familles")
async def get_familles(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM familles_articles WHERE actif=true ORDER BY libelle")
        return [dict(r) for r in rows]

@app.get("/api/referentiels/unites")
async def get_unites(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM unites_mesure WHERE actif=true ORDER BY code")
        return [dict(r) for r in rows]

@app.get("/api/ateliers")
async def get_ateliers(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM ateliers WHERE actif=true ORDER BY code")
        return [dict(r) for r in rows]

# ── ROUTES STOCK ───────────────────────────────────────────────
@app.get("/api/stock/inventaire")
async def get_inventaire(
    search: Optional[str] = None,
    atelier_id: Optional[str] = None,
    type_article: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Inventaire par emplacement/atelier"""
    return await inventaire_handler(pool, search, atelier_id, type_article)

@app.get("/api/stock/resume")
async def get_stock_resume(user=Depends(get_current_user)):
    """KPIs stock globaux"""
    return await resume_handler(pool)

@app.get("/api/stock/lots")
async def get_lots(statut: Optional[str] = None, search: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT l.*, a.code AS article_code, a.designation AS article_designation,
                e.code AS emplacement_code
            FROM lots_stock l
            JOIN articles a ON a.id=l.article_id
            LEFT JOIN emplacements_stock e ON e.id=l.emplacement_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND l.statut=${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (a.code ILIKE ${len(params)} OR l.numero_lot ILIKE ${len(params)})"
        q += " ORDER BY l.date_reception DESC LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/stock/entree")
async def entree_stock(payload: dict, user=Depends(get_current_user)):
    """Entrée manuelle en stock"""
    try:
        t = payload.get("type_mouvement", "entree_manuelle")
        if t not in ("entree_manuelle","entree_achat","entree_production","retour"):
            t = "entree_manuelle"
        return await mouvement_handler(pool, payload, t, user.get("id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/stock/entree_raw")
async def entree_stock_raw(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            article_id = payload.get("article_id")
            emplacement_id = int(payload["emplacement_id"]) if payload.get("emplacement_id") not in (None, "", "null") else None
            qte = float(payload.get("qte", 0))
            prix = float(payload.get("prix_unitaire", 0) or 0)
            numero_lot = payload.get("numero_lot") or None
            date_dlc = payload.get("date_dlc") or None

            if not article_id or qte <= 0:
                raise HTTPException(400, "Article et quantité requis")

            if numero_lot:
                existing = await conn.fetchrow(
                    "SELECT id FROM lots_stock WHERE numero_lot=$1 AND article_id=$2",
                    numero_lot, article_id
                )
                if existing:
                    await conn.execute(
                        "UPDATE lots_stock SET qte_disponible=qte_disponible+$1 WHERE id=$2",
                        qte, existing["id"]
                    )
                else:
                    await conn.execute("""
                        INSERT INTO lots_stock (article_id,emplacement_id,numero_lot,qte_initiale,qte_disponible,prix_unitaire,date_dlc,statut)
                        VALUES ($1,$2,$3,$4,$4,$5,$6,'disponible')
                    """, article_id, emplacement_id, numero_lot, qte, prix, date_dlc)

            if emplacement_id:
                await conn.execute("""
                    INSERT INTO stock_articles (article_id,emplacement_id,qte_disponible,valeur_stock,derniere_entree)
                    VALUES ($1,$2,$3,$3*$4,NOW())
                    ON CONFLICT (article_id,emplacement_id)
                    DO UPDATE SET qte_disponible=stock_articles.qte_disponible+$3,
                        valeur_stock=stock_articles.valeur_stock+($3*$4), derniere_entree=NOW()
                """, article_id, emplacement_id, qte, prix)

            # Journal
            try:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS journal_stock (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        article_id UUID, emplacement_id INTEGER,
                        type VARCHAR(10), qte NUMERIC(12,3),
                        prix_unitaire NUMERIC(12,4) DEFAULT 0,
                        numero_lot VARCHAR(100), notes TEXT,
                        cree_par UUID, created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                await conn.execute(
                    "INSERT INTO journal_stock (article_id,emplacement_id,type,qte,prix_unitaire,numero_lot,notes,cree_par) VALUES ($1,$2,'entree',$3,$4,$5,$6,$7)",
                    article_id, emplacement_id, qte, prix, numero_lot,
                    payload.get("notes"), user.get("id")
                )
            except Exception as je:
                print(f"Journal: {je}")
            return {"success": True, "message": f"Entree de {qte} enregistree"}

@app.post("/api/stock/sortie")
async def sortie_stock(payload: dict, user=Depends(get_current_user)):
    """Sortie manuelle du stock"""
    try:
        t = payload.get("type_mouvement", "sortie_manuelle")
        if t not in ("sortie_manuelle","sortie_vente","sortie_production","rebut"):
            t = "sortie_manuelle"
        return await mouvement_handler(pool, payload, t, user.get("id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/stock/sortie_raw")
async def sortie_stock_raw(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            article_id = payload.get("article_id")
            emplacement_id = int(payload["emplacement_id"]) if payload.get("emplacement_id") not in (None, "", "null") else None
            qte = float(payload.get("qte", 0))
            if not article_id or qte <= 0:
                raise HTTPException(400, "Article et quantité requis")

            # Vérifier stock
            dispo = await conn.fetchval(
                "SELECT COALESCE(SUM(qte_disponible),0) FROM stock_articles WHERE article_id=$1",
                article_id
            )
            if float(dispo) < qte:
                raise HTTPException(400, f"Stock insuffisant: {dispo} disponible, {qte} demandé")

            if emplacement_id:
                await conn.execute(
                    "UPDATE stock_articles SET qte_disponible=GREATEST(0,qte_disponible-$1),derniere_sortie=NOW() WHERE article_id=$2 AND emplacement_id=$3",
                    qte, article_id, emplacement_id
                )
            else:
                await conn.execute(
                    "UPDATE stock_articles SET qte_disponible=GREATEST(0,qte_disponible-$1),derniere_sortie=NOW() WHERE article_id=$2",
                    qte, article_id
                )
            # Journal
            try:
                await conn.execute(
                    "INSERT INTO journal_stock (article_id,emplacement_id,type,qte,notes,cree_par) VALUES ($1,$2,'sortie',$3,$4,$5) ON CONFLICT DO NOTHING",
                    article_id, emplacement_id, qte, payload.get("notes"), user.get("id")
                )
            except Exception as je:
                print(f"Journal sortie: {je}")
            return {"success": True, "message": f"Sortie de {qte} enregistree"}

@app.get("/api/emplacements")
async def get_emplacements(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT e.*, a.libelle AS atelier_libelle, a.code AS atelier_code
            FROM emplacements_stock e
            LEFT JOIN ateliers a ON a.id=e.atelier_id
            WHERE e.actif=true ORDER BY e.code
        """)
        return [dict(r) for r in rows]

# ── ROUTES VENTE ───────────────────────────────────────────────
@app.get("/api/vente/clients")
async def get_clients(search: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = "SELECT * FROM clients_complet WHERE actif=true"
        params = []
        if search:
            params.append(f"%{search}%")
            q += f" AND (code ILIKE $1 OR raison_sociale ILIKE $1)"
        q += " ORDER BY raison_sociale LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/vente/clients")
async def create_client(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("raison_sociale"):
            raise HTTPException(400, "Code et raison sociale requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO clients_complet (code,type,raison_sociale,contact_nom,telephone,email,adresse,ville,pays,nif,rc,condition_paiement,delai_paiement_jours,credit_limite,notes)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
            """, d["code"].upper(), d.get("type","B2B"), d["raison_sociale"],
                d.get("contact_nom"), d.get("telephone"), d.get("email"),
                d.get("adresse"), d.get("ville"), d.get("pays","Algérie"),
                d.get("nif"), d.get("rc"),
                d.get("condition_paiement","30_jours"),
                int(d.get("delai_paiement_jours") or 30),
                float(d.get("credit_limite") or 0),
                d.get("notes"))
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, "Code déjà existant")

@app.get("/api/vente/ventes")
async def get_ventes(statut: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT v.*, c.raison_sociale AS client_nom
            FROM ventes v LEFT JOIN clients_complet c ON c.id=v.client_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND v.statut=${len(params)}"
        q += " ORDER BY v.created_at DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/vente/ventes")
async def create_vente(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            d = payload
            lignes = d.get("lignes", [])
            total_ht = sum(
                float(l["quantite"]) * float(l["prix_unitaire_ht"]) * (1 - float(l.get("taux_remise",0))/100)
                for l in lignes
            )
            tva = float(d.get("taux_tva", 19))
            total_tva = total_ht * tva / 100
            total_ttc = total_ht + total_tva

            vente = await conn.fetchrow("""
                INSERT INTO ventes (type_vente,statut,client_id,montant_ht,taux_tva,montant_tva,montant_ttc,mode_paiement,reference_client,notes,cree_par)
                VALUES ($1,'brouillon',$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
            """, d.get("type_vente","B2B"), d.get("client_id"),
                total_ht, tva, total_tva, total_ttc,
                d.get("mode_paiement","virement"),
                d.get("reference_client"), d.get("notes"),
                user.get("id"))

            for l in lignes:
                ht = float(l["quantite"]) * float(l["prix_unitaire_ht"])
                tv = ht * float(l.get("taux_tva",19)) / 100
                await conn.execute("""
                    INSERT INTO lignes_vente (vente_id,article_id,designation,quantite,prix_unitaire_ht,taux_tva,montant_ht,montant_tva,montant_ttc)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """, str(vente["id"]), l.get("article_id"), l.get("designation",""),
                    float(l["quantite"]), float(l["prix_unitaire_ht"]),
                    float(l.get("taux_tva",19)), ht, tv, ht+tv)

            return dict(vente)

@app.put("/api/vente/ventes/{vente_id}/statut")
async def update_vente_statut(vente_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE ventes SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], vente_id
        )
        return dict(row)

@app.get("/api/vente/ventes/stats/resume")
async def ventes_stats(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT
                COUNT(*) FILTER (WHERE statut!='annule') AS nb_ventes,
                COALESCE(SUM(montant_ttc) FILTER (WHERE statut!='annule'),0) AS ca_ttc,
                COALESCE(SUM(montant_paye),0) AS total_encaisse,
                COALESCE(SUM(solde_restant),0) AS total_restant,
                COUNT(*) FILTER (WHERE statut='brouillon') AS nb_brouillon
            FROM ventes
        """)
        return dict(row)

# ── ROUTES ACHAT ───────────────────────────────────────────────
@app.get("/api/achat/fournisseurs")
async def get_fournisseurs(search: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = "SELECT * FROM fournisseurs WHERE actif=true"
        params = []
        if search:
            params.append(f"%{search}%")
            q += f" AND (code ILIKE $1 OR raison_sociale ILIKE $1)"
        q += " ORDER BY raison_sociale LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/achat/fournisseurs")
async def create_fournisseur(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("raison_sociale"):
            raise HTTPException(400, "Code et raison sociale requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO fournisseurs (code,raison_sociale,contact_nom,telephone,email,adresse,ville,pays,nif,condition_paiement,delai_paiement_jours,notes)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
            """, d["code"].upper(), d["raison_sociale"],
                d.get("contact_nom"), d.get("telephone"), d.get("email"),
                d.get("adresse"), d.get("ville"), d.get("pays","Algérie"),
                d.get("nif"), d.get("condition_paiement","30_jours"),
                int(d.get("delai_paiement_jours") or 30), d.get("notes"))
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, "Code déjà existant")

@app.get("/api/achat/commandes")
async def get_commandes(statut: Optional[str] = None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT ca.*, f.raison_sociale AS fournisseur_nom
            FROM commandes_achat ca LEFT JOIN fournisseurs f ON f.id=ca.fournisseur_id
            WHERE 1=1
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND ca.statut=${len(params)}"
        q += " ORDER BY ca.created_at DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

@app.post("/api/achat/commandes")
async def create_commande(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            d = payload
            lignes = d.get("lignes", [])
            total_ht = sum(float(l["quantite_commandee"]) * float(l["prix_unitaire_ht"]) for l in lignes)
            tva = float(d.get("taux_tva", 19))
            total_tva = total_ht * tva / 100

            cmd = await conn.fetchrow("""
                INSERT INTO commandes_achat (statut,fournisseur_id,date_commande,montant_ht,taux_tva,montant_tva,montant_ttc,notes,cree_par)
                VALUES ('brouillon',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
            """, d.get("fournisseur_id"),
                d.get("date_commande") or "today",
                total_ht, tva, total_tva, total_ht+total_tva,
                d.get("notes"), user.get("id"))

            for l in lignes:
                ht = float(l["quantite_commandee"]) * float(l["prix_unitaire_ht"])
                await conn.execute("""
                    INSERT INTO lignes_achat (commande_id,article_id,designation,quantite_commandee,prix_unitaire_ht,taux_tva,montant_ht,montant_ttc)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                """, str(cmd["id"]), l.get("article_id"), l.get("designation",""),
                    float(l["quantite_commandee"]), float(l["prix_unitaire_ht"]),
                    float(l.get("taux_tva",19)), ht, ht*(1+float(l.get("taux_tva",19))/100))

            return dict(cmd)

@app.put("/api/achat/commandes/{cmd_id}/statut")
async def update_commande_statut(cmd_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE commandes_achat SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], cmd_id
        )
        return dict(row)


# ── MOUVEMENTS STOCK ──────────────────────────────────────────
@app.get("/api/stock/mouvements")
async def get_mouvements(limit: int = 50, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS journal_stock (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    article_id UUID REFERENCES articles(id),
                    emplacement_id INTEGER,
                    type VARCHAR(10) NOT NULL,
                    qte NUMERIC(12,3) NOT NULL,
                    prix_unitaire NUMERIC(12,4) DEFAULT 0,
                    numero_lot VARCHAR(100),
                    notes TEXT,
                    cree_par UUID,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            rows = await conn.fetch("""
                SELECT j.id, j.created_at, j.type, j.qte, j.numero_lot, j.notes,
                    j.prix_unitaire,
                    a.code AS article_code, a.designation AS article_designation,
                    e.code AS emplacement_code
                FROM journal_stock j
                JOIN articles a ON a.id=j.article_id
                LEFT JOIN emplacements_stock e ON e.id=j.emplacement_id
                ORDER BY j.created_at DESC
                LIMIT $1
            """, limit)
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"Erreur mouvements: {e}")
            return []


@app.post("/api/stock/lots")
async def creer_lot(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        async with conn.transaction():
            d = payload
            if not d.get("article_id"):
                raise HTTPException(400, "Article requis")
            if not d.get("numero_lot"):
                raise HTTPException(400, "Numéro de lot requis")
            qte = float(d.get("qte_initiale", 0))
            if qte <= 0:
                raise HTTPException(400, "Quantité requise")
            
            emplacement_id = int(d["emplacement_id"]) if d.get("emplacement_id") not in (None,"","null") else None
            prix = float(d.get("prix_unitaire", 0) or 0)
            
            try:
                row = await conn.fetchrow("""
                    INSERT INTO lots_stock (
                        article_id, emplacement_id, numero_lot,
                        qte_initiale, qte_disponible, prix_unitaire,
                        date_fabrication, date_dlc, date_dluo,
                        date_reception, statut
                    ) VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,CURRENT_DATE,'disponible')
                    RETURNING *
                """,
                    d["article_id"], emplacement_id, d["numero_lot"],
                    qte, prix,
                    d.get("date_fabrication") or None,
                    d.get("date_dlc") or None,
                    d.get("date_dluo") or None,
                )
            except asyncpg.UniqueViolationError:
                raise HTTPException(400, "Ce numéro de lot existe déjà")
            
            if emplacement_id:
                await conn.execute("""
                    INSERT INTO stock_articles (article_id,emplacement_id,qte_disponible,valeur_stock,derniere_entree)
                    VALUES ($1,$2,$3,$3*$4,NOW())
                    ON CONFLICT (article_id,emplacement_id)
                    DO UPDATE SET
                        qte_disponible=stock_articles.qte_disponible+$3,
                        valeur_stock=stock_articles.valeur_stock+($3*$4),
                        derniere_entree=NOW()
                """, d["article_id"], emplacement_id, qte, prix)
            
            return dict(row)

@app.put("/api/stock/lots/{lot_id}")
async def update_lot_statut(lot_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        valid = ['disponible','quarantaine','bloque','perime','epuise']
        if payload.get("statut") not in valid:
            raise HTTPException(400, "Statut invalide")
        row = await conn.fetchrow(
            "UPDATE lots_stock SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], lot_id
        )
        return dict(row)

@app.post("/api/stock/transfert")
async def transfert_stock(payload: dict, user=Depends(get_current_user)):
    """Transfert entre emplacements (= bon de cession automatique)"""
    try:
        return await mouvement_handler(pool, payload, "transfert", user.get("id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════
# ROUTES QHSE
# ══════════════════════════════════════════════════════════════

@app.get("/api/qhse/dashboard")
async def get_qhse_dashboard(user=Depends(get_current_user)):
    return await qhse_dashboard(pool)

# ── PROCESSUS ─────────────────────────────────────────────────
@app.get("/api/qhse/processus")
async def api_get_processus(type_processus: Optional[str]=None, search: Optional[str]=None, user=Depends(get_current_user)):
    return await get_processus_list(pool, type_processus, search)

@app.post("/api/qhse/processus")
async def api_create_processus(payload: dict, user=Depends(get_current_user)):
    try: return await create_processus(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/qhse/processus/{proc_id}")
async def api_update_processus(proc_id: str, payload: dict, user=Depends(get_current_user)):
    result = await update_processus(pool, proc_id, payload)
    if not result: raise HTTPException(404, "Processus introuvable")
    return result

@app.delete("/api/qhse/processus/{proc_id}")
async def api_delete_processus(proc_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE processus SET actif=false WHERE id=$1", proc_id)
    return {"success": True}

# ── NON-CONFORMITÉS ───────────────────────────────────────────
@app.get("/api/qhse/nc")
async def api_get_nc(statut: Optional[str]=None, type_nc: Optional[str]=None,
                     gravite: Optional[str]=None, search: Optional[str]=None,
                     user=Depends(get_current_user)):
    return await get_nc_list(pool, statut, type_nc, gravite, search)

@app.post("/api/qhse/nc")
async def api_create_nc(payload: dict, user=Depends(get_current_user)):
    try: return await create_nc(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/qhse/nc/{nc_id}")
async def api_update_nc(nc_id: str, payload: dict, user=Depends(get_current_user)):
    result = await update_nc(pool, nc_id, payload)
    if not result: raise HTTPException(404, "NC introuvable")
    return result

@app.get("/api/qhse/nc/{nc_id}")
async def api_get_nc_detail(nc_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM non_conformites WHERE id=$1", nc_id)
        if not row: raise HTTPException(404, "NC introuvable")
        return dict(row)

# ── DOCUMENTS ─────────────────────────────────────────────────
@app.get("/api/qhse/documents")
async def api_get_documents(processus_id: Optional[str]=None, type_document: Optional[str]=None,
                            statut: Optional[str]=None, search: Optional[str]=None,
                            user=Depends(get_current_user)):
    return await get_documents_list(pool, processus_id, type_document, statut, search)

@app.post("/api/qhse/documents")
async def api_create_document(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("code") or not d.get("titre"):
            raise HTTPException(400, "Code et titre requis")
        try:
            row = await conn.fetchrow("""
                INSERT INTO documents_qhse (
                    code, titre, type_document, processus_id,
                    normes_applicables, version, description,
                    redacteur_id, date_redaction, date_prochaine_revision,
                    statut, mots_cles
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'brouillon',$11)
                RETURNING *
            """,
                d["code"].upper(), d["titre"], d.get("type_document","procedure"),
                d.get("processus_id") or None,
                json.dumps(safe_json(d.get("normes_applicables"), [])),
                d.get("version","v1"), d.get("description"),
                d.get("redacteur_id") or user.get("id"),
                d.get("date_redaction") or None,
                d.get("date_prochaine_revision") or None,
                d.get("mots_cles")
            )
            return dict(row)
        except asyncpg.UniqueViolationError:
            raise HTTPException(400, "Code document déjà existant")

@app.put("/api/qhse/documents/{doc_id}/statut")
async def api_update_doc_statut(doc_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        statut = payload.get("statut")
        extra = ""
        if statut == "approuve":
            extra = ", date_approbation=CURRENT_DATE, approbateur_id='" + user.get("id","") + "'"
        elif statut == "en_verification":
            extra = ", date_verification=CURRENT_DATE"
        row = await conn.fetchrow(
            f"UPDATE documents_qhse SET statut=$1{extra}, updated_at=NOW() WHERE id=$2 RETURNING *",
            statut, doc_id
        )
        return dict(row)

# ── AUDITS ────────────────────────────────────────────────────
@app.get("/api/qhse/audits")
async def api_get_audits(statut: Optional[str]=None, norme: Optional[str]=None, user=Depends(get_current_user)):
    return await get_audits_list(pool, statut, norme)

@app.post("/api/qhse/audits")
async def api_create_audit(payload: dict, user=Depends(get_current_user)):
    try: return await create_audit(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/qhse/audits/{audit_id}")
async def api_update_audit(audit_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            UPDATE audits SET statut=$1, date_realisation=$2,
                nb_ecarts_majeurs=$3, nb_ecarts_mineurs=$4,
                nb_observations=$5, nb_points_forts=$6, conclusion=$7
            WHERE id=$8 RETURNING *
        """,
            d.get("statut"), d.get("date_realisation") or None,
            int(d.get("nb_ecarts_majeurs",0) or 0), int(d.get("nb_ecarts_mineurs",0) or 0),
            int(d.get("nb_observations",0) or 0), int(d.get("nb_points_forts",0) or 0),
            d.get("conclusion"), audit_id
        )
        return dict(row)

# ── RISQUES ───────────────────────────────────────────────────
@app.get("/api/qhse/risques")
async def api_get_risques(type: Optional[str]=None, categorie: Optional[str]=None, user=Depends(get_current_user)):
    return await get_risques_list(pool, type, categorie)

@app.post("/api/qhse/risques")
async def api_create_risque(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO risques_opportunites (
                type, categorie, titre, description,
                processus_id, norme_ref,
                probabilite, gravite, detectabilite,
                plan_traitement, responsable_id, date_echeance, statut
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING *
        """,
            d.get("type","risque"), d.get("categorie","qualite"),
            d["titre"], d.get("description"),
            d.get("processus_id") or None, d.get("norme_ref"),
            int(d.get("probabilite",1) or 1), int(d.get("gravite",1) or 1),
            int(d.get("detectabilite",1) or 1),
            d.get("plan_traitement"),
            d.get("responsable_id") or None,
            d.get("date_echeance") or None,
            d.get("statut","identifie")
        )
        return dict(row)

@app.put("/api/qhse/risques/{risque_id}")
async def api_update_risque(risque_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            UPDATE risques_opportunites SET
                statut=$1, plan_traitement=$2,
                probabilite_residuelle=$3, gravite_residuelle=$4,
                criticite_residuelle=$5
            WHERE id=$6 RETURNING *
        """,
            d.get("statut"), d.get("plan_traitement"),
            int(d.get("probabilite_residuelle",1) or 1),
            int(d.get("gravite_residuelle",1) or 1),
            int(d.get("probabilite_residuelle",1) or 1) * int(d.get("gravite_residuelle",1) or 1),
            risque_id
        )
        return dict(row)

# ── INDICATEURS ───────────────────────────────────────────────
@app.get("/api/qhse/indicateurs")
async def api_get_indicateurs(processus_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_indicateurs(pool, processus_id)

@app.post("/api/qhse/indicateurs")
async def api_create_indicateur(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO indicateurs_qhse (
                code, libelle, processus_id, norme_associee,
                formule, unite, frequence_mesure,
                objectif_valeur, seuil_alerte, sens, responsable_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *
        """,
            d["code"].upper(), d["libelle"],
            d.get("processus_id") or None, d.get("norme_associee"),
            d.get("formule"), d.get("unite"), d.get("frequence_mesure","mensuel"),
            float(d.get("objectif_valeur",0) or 0),
            float(d.get("seuil_alerte",0) or 0) if d.get("seuil_alerte") else None,
            d.get("sens","hausse"),
            d.get("responsable_id") or None
        )
        return dict(row)

@app.post("/api/qhse/indicateurs/{ind_id}/valeur")
async def api_saisir_valeur(ind_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO valeurs_indicateurs (indicateur_id, periode, valeur, commentaire, saisi_par)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (indicateur_id, periode) DO UPDATE SET valeur=$3, commentaire=$4
            RETURNING *
        """,
            ind_id, payload.get("periode") or date.today().isoformat(),
            float(payload["valeur"]), payload.get("commentaire"),
            user.get("id")
        )
        return dict(row)

@app.get("/api/qhse/indicateurs/{ind_id}/historique")
async def api_historique_indicateur(ind_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM valeurs_indicateurs WHERE indicateur_id=$1 ORDER BY periode DESC LIMIT 24",
            ind_id
        )
        return [dict(r) for r in rows]

# ── ACCIDENTS SST ─────────────────────────────────────────────
@app.get("/api/qhse/accidents")
async def api_get_accidents(type: Optional[str]=None, statut: Optional[str]=None, user=Depends(get_current_user)):
    return await get_accidents_list(pool, type, statut)

@app.post("/api/qhse/accidents")
async def api_create_accident(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO accidents_incidents (
                type, gravite_sst, titre, description,
                atelier_id, machine_id, victime_nom, victime_id,
                temoins, date_accident, nb_jours_arret,
                cause_immediate, action_immediate, cout_estime
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING *
        """,
            d.get("type","incident"), d.get("gravite_sst","leger"),
            d["titre"], d.get("description",""),
            int_or_none(d.get("atelier_id")), int_or_none(d.get("machine_id")),
            d.get("victime_nom"), d.get("victime_id") or None,
            d.get("temoins"),
            d.get("date_accident") or datetime.utcnow().isoformat(),
            int(d.get("nb_jours_arret",0) or 0),
            d.get("cause_immediate"), d.get("action_immediate"),
            float(d.get("cout_estime",0) or 0)
        )
        return dict(row)

# ── HABILITATIONS ─────────────────────────────────────────────
@app.get("/api/qhse/habilitations")
async def api_get_habilitations(utilisateur_id: Optional[str]=None,
                                expiration_proche: bool=False,
                                user=Depends(get_current_user)):
    return await get_habilitations_list(pool, utilisateur_id, expiration_proche)

@app.post("/api/qhse/habilitations")
async def api_create_habilitation(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO habilitations (
                utilisateur_id, type_habilitation, numero,
                organisme_delivrant, date_obtention, date_expiration,
                statut, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,'valide',$7)
            RETURNING *
        """,
            d["utilisateur_id"], d["type_habilitation"], d.get("numero"),
            d.get("organisme_delivrant"),
            d.get("date_obtention") or None,
            d.get("date_expiration") or None,
            d.get("notes")
        )
        return dict(row)

# ── NORMES ────────────────────────────────────────────────────
@app.get("/api/qhse/normes")
async def api_get_normes(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM normes_qhse WHERE actif=true ORDER BY code")
        return [dict(r) for r in rows]



# ══════════════════════════════════════════════════════════════
# ROUTES GMAO
# ══════════════════════════════════════════════════════════════

@app.get("/api/gmao/dashboard")
async def api_gmao_dashboard(user=Depends(get_current_user)):
    return await gmao_dashboard(pool)

# ── ÉQUIPEMENTS ───────────────────────────────────────────────
@app.get("/api/gmao/equipements")
async def api_get_equipements(search: Optional[str]=None, statut: Optional[str]=None,
                               atelier_id: Optional[str]=None, criticite: Optional[str]=None,
                               user=Depends(get_current_user)):
    return await get_equipements(pool, search, statut, atelier_id, criticite)

@app.get("/api/gmao/equipements/{eq_id}")
async def api_get_equipement(eq_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM equipements WHERE id=$1", eq_id)
        if not row: raise HTTPException(404, "Équipement introuvable")
        return dict(row)

@app.post("/api/gmao/equipements")
async def api_create_equipement(payload: dict, user=Depends(get_current_user)):
    try: return await create_equipement(pool, payload, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))

@app.put("/api/gmao/equipements/{eq_id}")
async def api_update_equipement(eq_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            UPDATE equipements SET
                designation=$1, statut=$2, criticite=$3,
                atelier_id=$4, localisation=$5,
                responsable_id=$6, compteur_heures=$7, notes=$8
            WHERE id=$9 RETURNING *
        """,
            d.get("designation"), d.get("statut","en_service"),
            d.get("criticite","normale"),
            int(d["atelier_id"]) if d.get("atelier_id") else None,
            d.get("localisation"), d.get("responsable_id") or None,
            float(d.get("compteur_heures",0) or 0),
            d.get("notes"), eq_id
        )
        return dict(row)

@app.get("/api/gmao/equipements/{eq_id}/indicateurs")
async def api_indicateurs_equipement(eq_id: str, user=Depends(get_current_user)):
    try: return await get_indicateurs_equipement(pool, eq_id)
    except ValueError as e: raise HTTPException(404, str(e))

@app.get("/api/gmao/disponibilite")
async def api_disponibilite(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM vue_disponibilite_equipements")
        return [dict(r) for r in rows]

# ── ORDRES DE TRAVAIL ─────────────────────────────────────────
@app.get("/api/gmao/ots")
async def api_get_ots(statut: Optional[str]=None, type_ot: Optional[str]=None,
                       equipement_id: Optional[str]=None, priorite: Optional[str]=None,
                       user=Depends(get_current_user)):
    return await get_ots(pool, statut, type_ot, equipement_id, priorite)

@app.get("/api/gmao/ots/{ot_id}")
async def api_get_ot(ot_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT ot.*, e.code AS equipement_code, e.designation AS equipement_designation,
                u.nom||' '||u.prenom AS technicien_nom
            FROM ordres_travail ot
            LEFT JOIN equipements e ON e.id=ot.equipement_id
            LEFT JOIN utilisateurs u ON u.id=ot.technicien_id
            WHERE ot.id=$1
        """, ot_id)
        if not row: raise HTTPException(404, "OT introuvable")
        return dict(row)

@app.post("/api/gmao/ots")
async def api_create_ot(payload: dict, user=Depends(get_current_user)):
    try: return await create_ot(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/gmao/ots/{ot_id}")
async def api_update_ot(ot_id: str, payload: dict, user=Depends(get_current_user)):
    try: return await update_ot(pool, ot_id, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

# ── PLANS DE MAINTENANCE ──────────────────────────────────────
@app.get("/api/gmao/plans")
async def api_get_plans(equipement_id: Optional[str]=None, echeance_proche: bool=False,
                         user=Depends(get_current_user)):
    return await get_plans(pool, equipement_id, echeance_proche)

@app.post("/api/gmao/plans")
async def api_create_plan(payload: dict, user=Depends(get_current_user)):
    try: return await create_plan(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.post("/api/gmao/plans/{plan_id}/generer-ot")
async def api_generer_ot(plan_id: str, user=Depends(get_current_user)):
    try: return await generer_ot_depuis_plan(pool, plan_id, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))

@app.put("/api/gmao/plans/{plan_id}/realiser")
async def api_realiser_plan(plan_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        date_real = payload.get("date_realisation") or date.today().isoformat()
        plan = await conn.fetchrow("SELECT * FROM plans_maintenance WHERE id=$1", plan_id)
        if not plan: raise HTTPException(404, "Plan introuvable")
        from datetime import timedelta
        p, pt = plan["periodicite_valeur"], plan["periodicite_type"]
        d = date.fromisoformat(date_real)
        if pt=="jours": prochaine = d+timedelta(days=p)
        elif pt=="semaines": prochaine = d+timedelta(weeks=p)
        else: prochaine = d+timedelta(days=p*30)
        row = await conn.fetchrow(
            "UPDATE plans_maintenance SET derniere_realisation=$1, prochaine_echeance=$2 WHERE id=$3 RETURNING *",
            date_real, prochaine.isoformat(), plan_id
        )
        return dict(row)

# ── PIÈCES DÉTACHÉES ──────────────────────────────────────────
@app.get("/api/gmao/pieces")
async def api_get_pieces(search: Optional[str]=None, alerte_stock: bool=False,
                          user=Depends(get_current_user)):
    return await get_pieces(pool, search, alerte_stock)

@app.post("/api/gmao/pieces")
async def api_create_piece(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        try:
            row = await conn.fetchrow("""
                INSERT INTO pieces_detachees (
                    code, designation, famille, unite,
                    qte_stock, qte_minimum, qte_maximum, prix_unitaire,
                    fournisseur_id, reference_fournisseur,
                    delai_livraison_jours, emplacement_magasin
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                RETURNING *
            """,
                d["code"].upper(), d["designation"], d.get("famille"), d.get("unite","pcs"),
                int(d.get("qte_stock",0) or 0), int(d.get("qte_minimum",0) or 0),
                int(d.get("qte_maximum",100) or 100), float(d.get("prix_unitaire",0) or 0),
                d.get("fournisseur_id") or None, d.get("reference_fournisseur"),
                int(d.get("delai_livraison_jours",7) or 7), d.get("emplacement_magasin")
            )
            return dict(row)
        except Exception as e:
            raise HTTPException(400, str(e))

@app.put("/api/gmao/pieces/{piece_id}/stock")
async def api_update_stock_piece(piece_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        mouvement = payload.get("mouvement","entree")
        qte = int(payload.get("qte",0))
        if mouvement == "entree":
            row = await conn.fetchrow(
                "UPDATE pieces_detachees SET qte_stock=qte_stock+$1 WHERE id=$2 RETURNING *",
                qte, piece_id
            )
        else:
            row = await conn.fetchrow(
                "UPDATE pieces_detachees SET qte_stock=GREATEST(0,qte_stock-$1) WHERE id=$2 RETURNING *",
                qte, piece_id
            )
        return dict(row)

# ── HISTORIQUE PANNES ─────────────────────────────────────────
@app.get("/api/gmao/pannes")
async def api_get_pannes(equipement_id: Optional[str]=None, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        q = """
            SELECT hp.*, e.code AS eq_code, e.designation AS eq_designation
            FROM historique_pannes hp
            JOIN equipements e ON e.id=hp.equipement_id
            WHERE 1=1
        """
        params = []
        if equipement_id:
            params.append(equipement_id)
            q += f" AND hp.equipement_id=${len(params)}"
        q += " ORDER BY hp.date_panne DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]


# ── ÉNERGIE ───────────────────────────────────────────────────
@app.get("/api/gmao/energie/dashboard")
async def api_energie_dashboard(mois: Optional[str]=None, user=Depends(get_current_user)):
    return await dashboard_energie(pool, mois)

@app.get("/api/gmao/energie/releves")
async def api_get_releves(equipement_id: Optional[str]=None, mois: Optional[str]=None,
                           atelier_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_releves_energie(pool, equipement_id, mois, atelier_id)

@app.post("/api/gmao/energie/releves")
async def api_create_releve(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        if not d.get("equipement_id") or not d.get("date_releve"):
            raise HTTPException(400, "Équipement et date requis")
        heures = float(d.get("heures_marche",0) or 0)
        idx_debut = float(d.get("index_debut",0) or 0)
        idx_fin = float(d.get("index_fin",0) or 0)
        conso = idx_fin - idx_debut
        puissance_moy = round(conso/heures, 3) if heures > 0 else None
        row = await conn.fetchrow("""
            INSERT INTO releves_energie (
                equipement_id, atelier_id, date_releve, shift,
                index_debut, index_fin, heures_marche,
                puissance_moyenne_kw, quantite_produite, unite_production,
                operateur_id, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *
        """,
            d["equipement_id"],
            int(d["atelier_id"]) if d.get("atelier_id") else None,
            d["date_releve"], d.get("shift","journee"),
            idx_debut, idx_fin, heures, puissance_moy,
            float(d.get("quantite_produite",0) or 0) or None,
            d.get("unite_production"),
            d.get("operateur_id") or user.get("id"),
            d.get("notes")
        )
        return dict(row)

@app.get("/api/gmao/energie/mensuel")
async def api_conso_mensuelle(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM vue_conso_mensuelle LIMIT 100")
        return [dict(r) for r in rows]

@app.get("/api/gmao/energie/parametres")
async def api_get_parametres_energie(user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM parametres_energie LIMIT 1")
        return dict(row) if row else {"tarif_kwh": 105.0}

@app.put("/api/gmao/energie/parametres")
async def api_update_parametres_energie(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        tarif = float(payload.get("tarif_kwh", 105))
        await conn.execute(
            "UPDATE parametres_energie SET tarif_kwh=$1, updated_at=NOW()",
            tarif
        )
        return {"tarif_kwh": tarif, "message": "Tarif mis à jour"}

# ══════════════════════════════════════════════════════════════
# ROUTES RH
# ══════════════════════════════════════════════════════════════

@app.get("/api/rh/dashboard")
async def api_rh_dashboard(user=Depends(get_current_user)):
    return await rh_dashboard(pool)

@app.get("/api/rh/postes")
async def api_get_postes(user=Depends(get_current_user)):
    return await get_postes(pool)

@app.post("/api/rh/postes")
async def api_create_poste(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO postes (code,intitule,departement,niveau,description)
            VALUES ($1,$2,$3,$4,$5) RETURNING *
        """, d["code"].upper(), d["intitule"], d.get("departement"),
            d.get("niveau"), d.get("description"))
        return dict(row)

@app.get("/api/rh/employes")
async def api_get_employes(search: Optional[str]=None, statut: Optional[str]=None,
                            atelier_id: Optional[str]=None, poste_id: Optional[str]=None,
                            user=Depends(get_current_user)):
    return await get_employes(pool, search, statut, atelier_id, poste_id)

@app.get("/api/rh/employes/{emp_id}")
async def api_get_employe(emp_id: str, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT e.*, p.intitule AS poste_libelle, p.departement,
                at.libelle AS atelier_libelle
            FROM employes e
            LEFT JOIN postes p ON p.id=e.poste_id
            LEFT JOIN ateliers at ON at.id=e.atelier_id
            WHERE e.id=$1
        """, emp_id)
        if not row: raise HTTPException(404, "Employé introuvable")
        return dict(row)

@app.post("/api/rh/employes")
async def api_create_employe(payload: dict, user=Depends(get_current_user)):
    try: return await create_employe(pool, payload, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))

@app.put("/api/rh/employes/{emp_id}")
async def api_update_employe(emp_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        sets, vals = [], []
        def add(col, val): vals.append(val); sets.append(f"{col}=${len(vals)}")
        for f in ["nom","prenom","telephone","email","adresse","statut","poste_id","atelier_id","notes"]:
            if f in d: add(f, d[f] if f not in ("poste_id","atelier_id") else (int(d[f]) if d[f] else None))
        if not sets: return {"message": "Rien à modifier"}
        vals.append(emp_id)
        row = await conn.fetchrow(f"UPDATE employes SET {','.join(sets)} WHERE id=${len(vals)} RETURNING *", *vals)
        return dict(row)

@app.get("/api/rh/contrats")
async def api_get_contrats(employe_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_contrats(pool, employe_id)

@app.post("/api/rh/contrats")
async def api_create_contrat(payload: dict, user=Depends(get_current_user)):
    try: return await create_contrat(pool, payload)
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/rh/conges")
async def api_get_conges(employe_id: Optional[str]=None, statut: Optional[str]=None,
                          annee: Optional[str]=None, user=Depends(get_current_user)):
    return await get_conges(pool, employe_id, statut, annee)

@app.post("/api/rh/conges")
async def api_create_conge(payload: dict, user=Depends(get_current_user)):
    try: return await create_conge(pool, payload, user.get("id"))
    except Exception as e: raise HTTPException(400, str(e))

@app.put("/api/rh/conges/{conge_id}/valider")
async def api_valider_conge(conge_id: str, payload: dict, user=Depends(get_current_user)):
    try:
        return await valider_conge(pool, conge_id, payload["statut"],
                                   user.get("id"), payload.get("commentaire"))
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/rh/bulletins")
async def api_get_bulletins(employe_id: Optional[str]=None, periode: Optional[str]=None,
                             user=Depends(get_current_user)):
    return await get_bulletins(pool, employe_id, periode)

@app.post("/api/rh/bulletins")
async def api_generer_bulletin(payload: dict, user=Depends(get_current_user)):
    try: return await generer_bulletin(pool, payload, user.get("id"))
    except ValueError as e: raise HTTPException(400, str(e))
    except Exception as e: raise HTTPException(500, str(e))

@app.put("/api/rh/bulletins/{bul_id}/statut")
async def api_update_bulletin_statut(bul_id: str, payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE bulletins_paie SET statut=$1 WHERE id=$2 RETURNING *",
            payload["statut"], bul_id
        )
        return dict(row)

@app.get("/api/rh/presences")
async def api_get_presences(employe_id: Optional[str]=None,
                             date_debut: Optional[str]=None,
                             date_fin: Optional[str]=None,
                             user=Depends(get_current_user)):
    return await get_presences(pool, employe_id, date_debut, date_fin)

@app.post("/api/rh/presences")
async def api_saisir_presence(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        row = await conn.fetchrow("""
            INSERT INTO presences (employe_id,date_presence,heure_entree,heure_sortie,
                heures_travaillees,heures_supp,type_presence,notes,saisi_par)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (employe_id,date_presence)
            DO UPDATE SET heure_sortie=$4, heures_travaillees=$5, heures_supp=$6, notes=$8
            RETURNING *
        """,
            d["employe_id"], d["date_presence"],
            d.get("heure_entree") or None, d.get("heure_sortie") or None,
            float(d.get("heures_travaillees",8) or 8),
            float(d.get("heures_supp",0) or 0),
            d.get("type_presence","present"), d.get("notes"),
            user.get("id")
        )
        return dict(row)

@app.get("/api/rh/evaluations")
async def api_get_evaluations(employe_id: Optional[str]=None, user=Depends(get_current_user)):
    return await get_evaluations(pool, employe_id)

@app.post("/api/rh/evaluations")
async def api_create_evaluation(payload: dict, user=Depends(get_current_user)):
    async with pool.acquire() as conn:
        d = payload
        notes = [d.get(f"note_{k}") for k in ["qualite_travail","productivite","ponctualite","esprit_equipe","initiative","securite"]]
        notes_valides = [float(n) for n in notes if n]
        note_globale = sum(notes_valides)/len(notes_valides) if notes_valides else None
        row = await conn.fetchrow("""
            INSERT INTO evaluations (
                employe_id, evaluateur_id, periode, date_evaluation,
                note_qualite_travail, note_productivite, note_ponctualite,
                note_esprit_equipe, note_initiative, note_securite, note_globale,
                points_forts, axes_amelioration, objectifs_prochaine_periode, statut
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'brouillon')
            RETURNING *
        """,
            d["employe_id"], d.get("evaluateur_id") or user.get("id"),
            d.get("periode"), d.get("date_evaluation") or date.today().isoformat(),
            float(d.get("note_qualite_travail",0) or 0) or None,
            float(d.get("note_productivite",0) or 0) or None,
            float(d.get("note_ponctualite",0) or 0) or None,
            float(d.get("note_esprit_equipe",0) or 0) or None,
            float(d.get("note_initiative",0) or 0) or None,
            float(d.get("note_securite",0) or 0) or None,
            round(note_globale, 2) if note_globale else None,
            d.get("points_forts"), d.get("axes_amelioration"),
            d.get("objectifs_prochaine_periode")
        )
        return dict(row)

# RH dans nginx aussi
# ── HEALTH CHECK ───────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "api": "NAIdo Python FastAPI v4.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False)
