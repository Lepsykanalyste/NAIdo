"""
NAIdo QHSE Import — Script d'import automatique de documents
Convention : CODE_vVERSION_TITRE.ext (ex: PRO-QUA-001_v2_Controle-reception.docx)
Dossiers par processus ET/OU par type (procedures/, formulaires/, instructions/)
"""
import os, re, json, asyncio, asyncpg
from pathlib import Path
from datetime import datetime

TYPE_MAP = {
    'PRO': 'procedure',
    'INS': 'instruction',
    'FOR': 'formulaire',
    'ENR': 'enregistrement',
    'MAN': 'manuel',
    'SPE': 'specification',
    'PLA': 'plan',
}

PROCESSUS_MAP = {
    'QUA': 'qualite',
    'PRO': 'production',
    'MAI': 'maintenance',
    'ACH': 'achat',
    'VTE': 'vente',
    'RH':  'ressources_humaines',
    'ENV': 'environnement',
    'SST': 'securite',
    'ALI': 'alimentaire',
    'LOG': 'logistique',
    'DIR': 'direction',
}

def parser_nom_fichier(filename: str) -> dict:
    """
    Parse le nom de fichier selon la convention NAI
    PRO-QUA-001_v2_Controle-reception.docx
    → {code:'PRO-QUA-001', version:'v2', titre:'Controle reception', type:'procedure'}
    """
    stem = Path(filename).stem
    ext = Path(filename).suffix.lower()
    
    # Pattern: CODE_vVERSION_TITRE ou CODE_TITRE
    pattern = r'^([A-Z]{2,3}-[A-Z]{2,3}-\d{3}(?:-\d+)?)(?:_v(\d+(?:\.\d+)?))?(?:_(.+))?$'
    match = re.match(pattern, stem, re.IGNORECASE)
    
    if match:
        code = match.group(1).upper()
        version = f"v{match.group(2)}" if match.group(2) else "v1"
        titre_raw = match.group(3) or code
        titre = titre_raw.replace('-', ' ').replace('_', ' ').strip()
        
        # Déduire le type depuis le code
        prefix = code.split('-')[0]
        type_doc = TYPE_MAP.get(prefix, 'autre')
        
        # Déduire le processus
        processus_code = code.split('-')[1] if len(code.split('-')) > 1 else ''
        
        return {
            'code': code,
            'version': version,
            'titre': titre.title(),
            'type_document': type_doc,
            'processus_code': processus_code,
            'extension': ext,
            'nom_fichier': filename,
        }
    else:
        # Fichier sans convention — créer un code auto
        return {
            'code': f"DOC-{stem[:20].upper().replace(' ','-')}",
            'version': 'v1',
            'titre': stem.replace('-', ' ').replace('_', ' ').title(),
            'type_document': 'autre',
            'processus_code': '',
            'extension': ext,
            'nom_fichier': filename,
        }

def detecter_normes(chemin: str, titre: str) -> list:
    """Détecte les normes applicables depuis le chemin et le titre"""
    normes = []
    texte = (chemin + " " + titre).lower()
    if any(w in texte for w in ['qualite','quality','9001','client']): normes.append('ISO9001')
    if any(w in texte for w in ['enviro','14001','dechet','pollution']): normes.append('ISO14001')
    if any(w in texte for w in ['securite','sst','45001','accident','epi']): normes.append('ISO45001')
    if any(w in texte for w in ['alimentaire','fssc','haccp','22000','hygiene']): normes.append('FSSC22000')
    return normes or ['ISO9001']  # Par défaut ISO9001

async def importer_zip(zip_path: str, upload_dir: str = "/app/uploads/qhse"):
    """Import d'un ZIP de documents QHSE"""
    import zipfile, shutil
    
    DB_URL = os.environ.get("DATABASE_URL", "postgresql://naido_user:naido_pass_2026@localhost:5436/naido_db")
    conn = await asyncpg.connect(DB_URL)
    
    zip_path = Path(zip_path)
    if not zip_path.exists():
        print(f"❌ Fichier ZIP introuvable: {zip_path}")
        return
    
    upload_dir = Path(upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    resultats = {'importes': [], 'ignores': [], 'erreurs': []}
    
    with zipfile.ZipFile(zip_path, 'r') as zf:
        print(f"📦 ZIP: {zip_path.name} — {len(zf.namelist())} fichiers")
        
        for nom_dans_zip in zf.namelist():
            if nom_dans_zip.endswith('/'):  # Dossier
                continue
            
            chemin_parts = Path(nom_dans_zip)
            filename = chemin_parts.name
            ext = chemin_parts.suffix.lower()
            
            # Fichiers supportés
            if ext not in ['.docx', '.xlsx', '.pdf', '.doc', '.xls', '.pptx']:
                print(f"  ⏭ Ignoré (format): {filename}")
                resultats['ignores'].append(filename)
                continue
            
            print(f"  📄 Import: {filename}")
            
            # Parser le nom
            info = parser_nom_fichier(filename)
            
            # Dossier parent → contexte processus
            dossier = str(chemin_parts.parent)
            normes = detecter_normes(dossier, info['titre'])
            
            try:
                # Extraire vers upload_dir
                dest_path = upload_dir / filename
                with zf.open(nom_dans_zip) as src, open(dest_path, 'wb') as dst:
                    dst.write(src.read())
                
                # Trouver le processus en base
                processus_id = None
                if info['processus_code']:
                    proc = await conn.fetchrow(
                        "SELECT id FROM processus WHERE code ILIKE $1 OR code ILIKE $2 LIMIT 1",
                        f"%{info['processus_code']}%",
                        f"%-{info['processus_code']}%"
                    )
                    if proc:
                        processus_id = proc['id']
                
                # Insérer en base
                existing = await conn.fetchrow(
                    "SELECT id FROM documents_qhse WHERE code=$1",
                    info['code']
                )
                
                if existing:
                    # Mettre à jour la version
                    await conn.execute("""
                        UPDATE documents_qhse SET
                            version=$1, file_path=$2, file_name=$3,
                            normes_applicables=$4, updated_at=NOW()
                        WHERE id=$5
                    """,
                        info['version'],
                        str(dest_path),
                        filename,
                        json.dumps(normes),
                        str(existing['id'])
                    )
                    print(f"    ✓ MIS À JOUR: {info['code']} {info['version']}")
                else:
                    await conn.execute("""
                        INSERT INTO documents_qhse (
                            code, titre, type_document, processus_id,
                            version, file_path, file_name,
                            normes_applicables, statut, actif
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approuve',true)
                        ON CONFLICT (code) DO UPDATE SET
                            version=EXCLUDED.version,
                            file_path=EXCLUDED.file_path,
                            updated_at=NOW()
                    """,
                        info['code'], info['titre'], info['type_document'],
                        processus_id, info['version'],
                        str(dest_path), filename,
                        json.dumps(normes)
                    )
                    print(f"    ✓ IMPORTÉ: {info['code']} — {info['titre']} ({info['type_document']})")
                
                resultats['importes'].append(info)
                
            except Exception as e:
                print(f"    ❌ ERREUR: {filename} — {e}")
                resultats['erreurs'].append({'fichier': filename, 'erreur': str(e)})
    
    await conn.close()
    
    print(f"\n{'='*50}")
    print(f"✅ IMPORT TERMINÉ")
    print(f"   Importés  : {len(resultats['importes'])}")
    print(f"   Ignorés   : {len(resultats['ignores'])}")
    print(f"   Erreurs   : {len(resultats['erreurs'])}")
    
    return resultats

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python qhse_import.py <chemin_du_zip>")
        sys.exit(1)
    asyncio.run(importer_zip(sys.argv[1]))
