"""
NAIdo RH — Routes FastAPI
Employés, Contrats, Congés, Paie, Présences, Formations, Évaluations
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, date
import json

router = APIRouter(prefix="/api/rh", tags=["rh"])

def int_or_none(v):
    if v is None or v == "": return None
    try: return int(v)
    except: return None

def num_or_none(v):
    if v is None or v == "": return None
    try: return float(v)
    except: return None

def safe_json(v, fb=None):
    if fb is None: fb = []
    if isinstance(v, (list, dict)): return v
    if not v: return fb
    try: return json.loads(v)
    except: return fb

# ── DASHBOARD RH ──────────────────────────────────────────────
async def rh_dashboard(pool):
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow("SELECT * FROM vue_rh_dashboard")
            return dict(row) if row else {}
        except Exception as e:
            print(f"RH dashboard: {e}")
            return {}

# ── POSTES ────────────────────────────────────────────────────
async def get_postes(pool):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM postes WHERE actif=true ORDER BY departement,intitule")
        return [dict(r) for r in rows]

# ── EMPLOYÉS ──────────────────────────────────────────────────
async def get_employes(pool, search=None, statut=None, atelier_id=None, poste_id=None):
    async with pool.acquire() as conn:
        q = """
            SELECT e.*,
                p.intitule AS poste_libelle, p.departement,
                at.libelle AS atelier_libelle, at.code AS atelier_code,
                c.type_contrat, c.salaire_base, c.date_fin AS fin_contrat,
                sc.jours_restants AS solde_conges,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.date_embauche))::INTEGER AS anciennete_ans
            FROM employes e
            LEFT JOIN postes p ON p.id = e.poste_id
            LEFT JOIN ateliers at ON at.id = e.atelier_id
            LEFT JOIN contrats c ON c.employe_id = e.id AND c.statut = 'actif'
            LEFT JOIN soldes_conges sc ON sc.employe_id = e.id AND sc.annee = EXTRACT(YEAR FROM NOW())
            WHERE e.actif = true
        """
        params = []
        if statut:
            params.append(statut)
            q += f" AND e.statut = ${len(params)}"
        if atelier_id:
            params.append(int(atelier_id))
            q += f" AND e.atelier_id = ${len(params)}"
        if poste_id:
            params.append(int(poste_id))
            q += f" AND e.poste_id = ${len(params)}"
        if search:
            params.append(f"%{search}%")
            q += f" AND (e.nom ILIKE ${len(params)} OR e.prenom ILIKE ${len(params)} OR e.matricule ILIKE ${len(params)})"
        q += " ORDER BY e.nom, e.prenom"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_employe(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow("""
                INSERT INTO employes (
                    matricule, nom, prenom, date_naissance, lieu_naissance,
                    nationalite, sexe, situation_familiale, nb_enfants,
                    telephone, telephone2, email, adresse, ville,
                    num_cni, num_cnps, num_passport,
                    poste_id, atelier_id,
                    date_embauche, statut, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
                RETURNING *
            """,
                data.get("matricule") or None,
                data["nom"].upper(), data["prenom"],
                data.get("date_naissance") or None,
                data.get("lieu_naissance"),
                data.get("nationalite","Ivoirienne"),
                data.get("sexe"),
                data.get("situation_familiale"),
                int(data.get("nb_enfants",0) or 0),
                data.get("telephone"), data.get("telephone2"),
                data.get("email"), data.get("adresse"), data.get("ville"),
                data.get("num_cni"), data.get("num_cnps"), data.get("num_passport"),
                int_or_none(data.get("poste_id")),
                int_or_none(data.get("atelier_id")),
                data.get("date_embauche") or None,
                data.get("statut","actif"),
                data.get("notes")
            )
            # Créer le solde de congés pour l'année en cours
            await conn.execute("""
                INSERT INTO soldes_conges (employe_id, annee, jours_acquis, jours_pris)
                VALUES ($1, $2, 18, 0) ON CONFLICT DO NOTHING
            """, str(row["id"]), datetime.now().year)
            return dict(row)
        except Exception as e:
            raise ValueError(str(e))

# ── CONTRATS ──────────────────────────────────────────────────
async def get_contrats(pool, employe_id=None):
    async with pool.acquire() as conn:
        q = """
            SELECT c.*, e.nom||' '||e.prenom AS employe_nom, e.matricule
            FROM contrats c
            JOIN employes e ON e.id = c.employe_id
            WHERE 1=1
        """
        params = []
        if employe_id:
            params.append(employe_id)
            q += f" AND c.employe_id = ${len(params)}"
        q += " ORDER BY c.created_at DESC"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_contrat(pool, data: dict):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO contrats (
                employe_id, type_contrat, date_debut, date_fin, duree_mois,
                salaire_base, devise, temps_travail, heures_semaine,
                periode_essai_mois, date_fin_essai,
                prime_transport, prime_logement, autres_avantages, statut
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'actif')
            RETURNING *
        """,
            data["employe_id"], data.get("type_contrat","CDI"),
            data["date_debut"], data.get("date_fin") or None,
            int_or_none(data.get("duree_mois")),
            float(data.get("salaire_base",0) or 0),
            data.get("devise","FCFA"),
            data.get("temps_travail","plein"),
            float(data.get("heures_semaine",40) or 40),
            int(data.get("periode_essai_mois",0) or 0),
            data.get("date_fin_essai") or None,
            float(data.get("prime_transport",0) or 0),
            float(data.get("prime_logement",0) or 0),
            data.get("autres_avantages")
        )
        # Mettre à jour la date d'embauche si premier contrat
        await conn.execute("""
            UPDATE employes SET date_embauche = $1
            WHERE id = $2 AND date_embauche IS NULL
        """, data["date_debut"], data["employe_id"])
        return dict(row)

# ── CONGÉS ────────────────────────────────────────────────────
async def get_conges(pool, employe_id=None, statut=None, annee=None):
    async with pool.acquire() as conn:
        q = """
            SELECT c.*, e.nom||' '||e.prenom AS employe_nom, e.matricule,
                v.nom||' '||v.prenom AS valideur_nom
            FROM conges c
            JOIN employes e ON e.id = c.employe_id
            LEFT JOIN employes v ON v.id = c.valideur_id
            WHERE 1=1
        """
        params = []
        if employe_id:
            params.append(employe_id)
            q += f" AND c.employe_id = ${len(params)}"
        if statut:
            params.append(statut)
            q += f" AND c.statut = ${len(params)}"
        if annee:
            params.append(int(annee))
            q += f" AND EXTRACT(YEAR FROM c.date_debut) = ${len(params)}"
        q += " ORDER BY c.date_debut DESC LIMIT 200"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def create_conge(pool, data: dict, user_id: str):
    async with pool.acquire() as conn:
        # Calculer nb_jours
        debut = date.fromisoformat(data["date_debut"])
        fin = date.fromisoformat(data["date_fin"])
        nb_jours = (fin - debut).days + 1
        row = await conn.fetchrow("""
            INSERT INTO conges (employe_id, type_conge, date_debut, date_fin, nb_jours, motif, statut)
            VALUES ($1,$2,$3,$4,$5,$6,'en_attente') RETURNING *
        """,
            data["employe_id"], data.get("type_conge","annuel"),
            data["date_debut"], data["date_fin"],
            nb_jours, data.get("motif")
        )
        return dict(row)

async def valider_conge(pool, conge_id: str, statut: str, valideur_id: str, commentaire: str = None):
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("""
                UPDATE conges SET statut=$1, valideur_id=$2,
                    date_validation=NOW(), commentaire_valideur=$3
                WHERE id=$4 RETURNING *
            """, statut, valideur_id, commentaire, conge_id)
            # Mettre à jour le solde si approuvé
            if statut == 'approuve' and row["type_conge"] == 'annuel':
                annee = row["date_debut"].year
                await conn.execute("""
                    UPDATE soldes_conges SET jours_pris = jours_pris + $1
                    WHERE employe_id = $2 AND annee = $3
                """, row["nb_jours"], str(row["employe_id"]), annee)
            return dict(row)

# ── BULLETINS DE PAIE ─────────────────────────────────────────
async def get_bulletins(pool, employe_id=None, periode=None):
    async with pool.acquire() as conn:
        q = """
            SELECT b.*, e.nom||' '||e.prenom AS employe_nom, e.matricule
            FROM bulletins_paie b
            JOIN employes e ON e.id = b.employe_id
            WHERE 1=1
        """
        params = []
        if employe_id:
            params.append(employe_id)
            q += f" AND b.employe_id = ${len(params)}"
        if periode:
            params.append(periode)
            q += f" AND b.periode = ${len(params)}"
        q += " ORDER BY b.periode DESC, e.nom"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

async def generer_bulletin(pool, data: dict, user_id: str):
    """Génère un bulletin de paie avec calculs automatiques"""
    async with pool.acquire() as conn:
        employe_id = data["employe_id"]
        periode = data.get("periode") or date.today().replace(day=1).isoformat()

        # Récupérer le contrat actif
        contrat = await conn.fetchrow(
            "SELECT * FROM contrats WHERE employe_id=$1 AND statut='actif' ORDER BY date_debut DESC LIMIT 1",
            employe_id
        )

        salaire_base = float(data.get("salaire_base") or (contrat["salaire_base"] if contrat else 0))
        prime_transport = float(data.get("prime_transport") or (contrat["prime_transport"] if contrat else 0))
        prime_logement = float(data.get("prime_logement") or (contrat["prime_logement"] if contrat else 0))
        prime_performance = float(data.get("prime_performance",0) or 0)
        prime_anciennete = float(data.get("prime_anciennete",0) or 0)
        autres_primes = float(data.get("autres_primes",0) or 0)
        heures_supp = float(data.get("heures_supp",0) or 0)
        taux_hs = float(data.get("taux_heures_supp",0) or 0)
        montant_hs = heures_supp * taux_hs

        # Calculs
        salaire_brut = salaire_base + prime_transport + prime_logement + prime_performance + prime_anciennete + autres_primes + montant_hs

        # CNPS salarié : 6.3% sur salaire brut plafonné
        cnps_plafond = 1647315  # Plafond CNPS Côte d'Ivoire
        cotisation_cnps = min(salaire_brut, cnps_plafond) * 0.063

        # Impôt sur salaire simplifié (ITS)
        salaire_imposable = salaire_brut - cotisation_cnps
        if salaire_imposable <= 75000: its = 0
        elif salaire_imposable <= 240000: its = salaire_imposable * 0.05
        elif salaire_imposable <= 750000: its = salaire_imposable * 0.10
        else: its = salaire_imposable * 0.15

        autres_retenues = float(data.get("autres_retenues",0) or 0)
        salaire_net = salaire_brut - cotisation_cnps - its - autres_retenues

        # Cotisation patronale CNPS : 14.75%
        cotisation_patronale = min(salaire_brut, cnps_plafond) * 0.1475

        try:
            row = await conn.fetchrow("""
                INSERT INTO bulletins_paie (
                    employe_id, periode,
                    salaire_base, prime_transport, prime_logement,
                    prime_performance, prime_anciennete, autres_primes,
                    heures_supp, taux_heures_supp, montant_heures_supp,
                    salaire_brut, cotisation_cnps, impot_sur_salaire,
                    autres_retenues, salaire_net, cotisation_patronale,
                    mode_paiement, statut, cree_par
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'brouillon',$19)
                RETURNING *
            """,
                employe_id, periode,
                salaire_base, prime_transport, prime_logement,
                prime_performance, prime_anciennete, autres_primes,
                heures_supp, taux_hs, montant_hs,
                salaire_brut, round(cotisation_cnps,2), round(its,2),
                autres_retenues, round(salaire_net,2), round(cotisation_patronale,2),
                data.get("mode_paiement","virement"), user_id
            )
            return dict(row)
        except Exception as e:
            if "unique" in str(e).lower():
                raise ValueError(f"Bulletin déjà existant pour cette période")
            raise

# ── PRÉSENCES ─────────────────────────────────────────────────
async def get_presences(pool, employe_id=None, date_debut=None, date_fin=None):
    async with pool.acquire() as conn:
        q = """
            SELECT pr.*, e.nom||' '||e.prenom AS employe_nom, e.matricule
            FROM presences pr
            JOIN employes e ON e.id = pr.employe_id
            WHERE 1=1
        """
        params = []
        if employe_id:
            params.append(employe_id)
            q += f" AND pr.employe_id = ${len(params)}"
        if date_debut:
            params.append(date_debut)
            q += f" AND pr.date_presence >= ${len(params)}"
        if date_fin:
            params.append(date_fin)
            q += f" AND pr.date_presence <= ${len(params)}"
        q += " ORDER BY pr.date_presence DESC LIMIT 500"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]

# ── ÉVALUATIONS ───────────────────────────────────────────────
async def get_evaluations(pool, employe_id=None):
    async with pool.acquire() as conn:
        q = """
            SELECT ev.*, e.nom||' '||e.prenom AS employe_nom,
                ev2.nom||' '||ev2.prenom AS evaluateur_nom
            FROM evaluations ev
            JOIN employes e ON e.id = ev.employe_id
            LEFT JOIN employes ev2 ON ev2.id = ev.evaluateur_id
            WHERE 1=1
        """
        params = []
        if employe_id:
            params.append(employe_id)
            q += f" AND ev.employe_id = ${len(params)}"
        q += " ORDER BY ev.date_evaluation DESC LIMIT 100"
        rows = await conn.fetch(q, *params)
        return [dict(r) for r in rows]
