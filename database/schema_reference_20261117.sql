--
-- PostgreSQL database dump
--

\restrict mo2algwgI873ZSIVmltA7gbfkINZIvQlg98q2cR3S50rehhYFXpEKqQpJ3XEnKQ

-- Dumped from database version 16.16
-- Dumped by pg_dump version 16.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: calcul_duree_arret(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcul_duree_arret() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.heure_fin IS NOT NULL AND OLD.heure_fin IS NULL THEN
    NEW.duree_min := EXTRACT(EPOCH FROM (NEW.heure_fin - NEW.heure_debut)) / 60;
    NEW.statut := 'clos';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: gen_matricule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_matricule() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.matricule IS NULL OR NEW.matricule = '' THEN
        NEW.matricule := 'NAI-' || LPAD(nextval('matricule_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: gen_numero_accident(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_accident() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.numero := 'ACC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('accident_seq')::TEXT,3,'0');
    RETURN NEW;
END;
$$;


--
-- Name: gen_numero_achat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_achat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_commande := 'CMD-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('achat_seq')::TEXT,5,'0');
  RETURN NEW;
END;
$$;


--
-- Name: gen_numero_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.numero_audit := 'AUD-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('audit_seq')::TEXT,3,'0');
    RETURN NEW;
END;
$$;


--
-- Name: gen_numero_bobine(character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_bobine(p_of_num character varying, p_machine_code character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'BOB-' || p_of_num || '-' ||
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         p_machine_code || '-' ||
         LPAD(nextval('seq_bobine_num')::text, 3, '0');
END;
$$;


--
-- Name: gen_numero_cession_at3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_cession_at3() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'CES-AT3-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_cession_at3_num')::text, 4, '0');
END;
$$;


--
-- Name: gen_numero_dbm(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_dbm() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'DBM-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_dbm_num')::text, 4, '0');
END;
$$;


--
-- Name: gen_numero_decl(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_decl() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'DECL-AT3-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_mvt_stock_at3_num')::text, 4, '0');
END;
$$;


--
-- Name: gen_numero_mvt_at3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_mvt_at3() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'MVT-AT3-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_mvt_at3_num')::text, 4, '0');
END;
$$;


--
-- Name: gen_numero_nc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_nc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.numero_nc := 'NC-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('nc_seq')::TEXT,4,'0');
    RETURN NEW;
END;
$$;


--
-- Name: gen_numero_ol(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_ol() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_ol := 'OL-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('ol_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: gen_numero_ot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_ot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.numero_ot := 'OT-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('ot_seq')::TEXT,4,'0');
    RETURN NEW;
END;
$$;


--
-- Name: gen_numero_palette(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_palette(p_of_num character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN 'PAL-' || p_of_num || '-' ||
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(nextval('seq_palette_num')::text, 3, '0');
END;
$$;


--
-- Name: gen_numero_vente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_numero_vente() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_vente := 'VTE-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('vente_seq')::TEXT,5,'0');
  RETURN NEW;
END;
$$;


--
-- Name: generer_numero_incident(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generer_numero_incident() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_incident := 'INC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('incident_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generer_numero_mouvement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generer_numero_mouvement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  prefix TEXT;
BEGIN
  prefix := CASE NEW.type_mouvement
    WHEN 'cession_atelier'      THEN 'BC'   -- Bon de Cession
    WHEN 'livraison_mp'         THEN 'BL'   -- Bon de Livraison MP
    WHEN 'livraison_pf_interne' THEN 'BLI'  -- Bon Livraison Interne
    WHEN 'reception_achat'      THEN 'BR'   -- Bon de Réception
    WHEN 'expedition_vente'     THEN 'BE'   -- Bon d'Expédition
    WHEN 'retour_atelier'       THEN 'BRA'  -- Bon de Retour Atelier
    WHEN 'ajustement_positif'   THEN 'AP'
    WHEN 'ajustement_negatif'   THEN 'AN'
    ELSE 'MV'
  END;
  NEW.numero_bon := prefix || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('mouvement_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generer_numero_nc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generer_numero_nc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_nc := 'NC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('nc_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generer_numero_ot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generer_numero_ot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_ot := 'OT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('ot_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generer_numero_rapport(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generer_numero_rapport() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_rapport := 'RJ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('rapport_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$;


--
-- Name: generer_numero_ticket(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generer_numero_ticket() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.numero_ticket := 'TK' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('ticket_seq')::TEXT, 4, '0');
  NEW.qr_code_contenu := (
    SELECT o.numero_of || '|' ||
           TO_CHAR(NOW(), 'DDMMYY') || '|' ||
           m.code || '|' ||
           NEW.poids_net_kg::TEXT || '|' ||
           NEW.numero_ticket
    FROM ordres_fabrication o, machines m
    WHERE o.id = NEW.of_id AND m.id = NEW.machine_id
  );
  RETURN NEW;
END;
$$;


--
-- Name: sync_stock_articles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_stock_articles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO stock_articles (article_id, qte_disponible, derniere_entree)
  VALUES (COALESCE(NEW.article_id, OLD.article_id),
    (SELECT COALESCE(SUM(qte_disponible),0) FROM lots_stock
     WHERE article_id=COALESCE(NEW.article_id, OLD.article_id) AND statut='disponible'),
    NOW())
  ON CONFLICT (article_id) DO UPDATE SET
    qte_disponible = EXCLUDED.qte_disponible,
    derniere_entree = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: trigger_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: verifier_alertes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verifier_alertes() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  seuil_rebus NUMERIC;
  seuil_trs NUMERIC;
  seuil_arret NUMERIC;
BEGIN
  SELECT seuil INTO seuil_rebus FROM config_alertes WHERE type='rebus_eleve' AND actif=true;
  SELECT seuil INTO seuil_trs   FROM config_alertes WHERE type='trs_bas'     AND actif=true;
  SELECT seuil INTO seuil_arret FROM config_alertes WHERE type='arret_long'  AND actif=true;

  INSERT INTO alertes (type, machine_id, message, valeur_declenchante, seuil)
  SELECT 'rebus_eleve', t.machine_id,
    'Taux de rebus élevé sur ' || t.machine_code || ' : ' || t.taux_rebus_pct || '%',
    t.taux_rebus_pct, seuil_rebus
  FROM vue_trs t
  WHERE t.date_session = CURRENT_DATE
    AND t.taux_rebus_pct > seuil_rebus
    AND NOT EXISTS (
      SELECT 1 FROM alertes a
      WHERE a.type='rebus_eleve' AND a.machine_id = t.machine_id AND DATE(a.created_at)=CURRENT_DATE
    );

  INSERT INTO alertes (type, machine_id, message, valeur_declenchante, seuil)
  SELECT 'trs_bas', t.machine_id,
    'TRS bas sur ' || t.machine_code || ' : ' || t.trs_pct || '%',
    t.trs_pct, seuil_trs
  FROM vue_trs t
  WHERE t.date_session = CURRENT_DATE
    AND t.trs_pct < seuil_trs AND t.trs_pct > 0
    AND NOT EXISTS (
      SELECT 1 FROM alertes a
      WHERE a.type='trs_bas' AND a.machine_id = t.machine_id AND DATE(a.created_at)=CURRENT_DATE
    );

  INSERT INTO alertes (type, machine_id, message, valeur_declenchante, seuil)
  SELECT 'arret_long', am.machine_id,
    'Arrêt long en cours : ' || ROUND((EXTRACT(EPOCH FROM (NOW() - am.heure_debut))/60)::numeric, 0) || ' min',
    EXTRACT(EPOCH FROM (NOW() - am.heure_debut))/60,
    seuil_arret
  FROM arrêts_machine am
  WHERE am.statut = 'en_cours'
    AND EXTRACT(EPOCH FROM (NOW() - am.heure_debut))/60 > seuil_arret
    AND NOT EXISTS (
      SELECT 1 FROM alertes a
      WHERE a.type='arret_long' AND a.machine_id = am.machine_id AND a.created_at >= am.heure_debut
    );
END;
$$;


--
-- Name: accident_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accident_seq
    START WITH 100
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accidents_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accidents_incidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero character varying(30),
    type character varying(20) NOT NULL,
    gravite_sst character varying(20) DEFAULT 'leger'::character varying,
    titre character varying(255) NOT NULL,
    description text NOT NULL,
    atelier_id integer,
    machine_id integer,
    victime_nom character varying(200),
    victime_id uuid,
    temoins text,
    date_accident timestamp with time zone DEFAULT now() NOT NULL,
    heure_accident time without time zone,
    date_reprise_travail date,
    nb_jours_arret integer DEFAULT 0,
    cause_immediate text,
    cause_profonde text,
    facteurs_aggravants text,
    action_immediate text,
    action_corrective text,
    declare_inspection boolean DEFAULT false,
    date_declaration date,
    cout_estime numeric(12,2) DEFAULT 0,
    statut character varying(20) DEFAULT 'ouvert'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accidents_incidents_gravite_sst_check CHECK (((gravite_sst)::text = ANY (ARRAY[('leger'::character varying)::text, ('moyen'::character varying)::text, ('grave'::character varying)::text, ('mortel'::character varying)::text, ('sans_arret'::character varying)::text]))),
    CONSTRAINT accidents_incidents_statut_check CHECK (((statut)::text = ANY (ARRAY[('ouvert'::character varying)::text, ('en_cours'::character varying)::text, ('clos'::character varying)::text]))),
    CONSTRAINT accidents_incidents_type_check CHECK (((type)::text = ANY (ARRAY[('accident'::character varying)::text, ('incident'::character varying)::text, ('presqu_accident'::character varying)::text, ('maladie_pro'::character varying)::text, ('danger_grave'::character varying)::text])))
);


--
-- Name: achat_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.achat_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alertes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(50) NOT NULL,
    machine_id integer,
    of_id uuid,
    message text NOT NULL,
    valeur_declenchante numeric(10,2),
    seuil numeric(10,2),
    lue boolean DEFAULT false,
    destinataires jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alertes_type_check CHECK (((type)::text = ANY (ARRAY[('trs_bas'::character varying)::text, ('rebus_eleve'::character varying)::text, ('arret_long'::character varying)::text, ('stock_bas'::character varying)::text, ('of_retard'::character varying)::text, ('objectif_atteint'::character varying)::text])))
);


--
-- Name: arrêts_machine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."arrêts_machine" (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id uuid,
    machine_id integer,
    operateur_id uuid,
    heure_debut timestamp with time zone DEFAULT now() NOT NULL,
    heure_fin timestamp with time zone,
    duree_min integer,
    cause character varying(50) NOT NULL,
    details text,
    statut character varying(20) DEFAULT 'en_cours'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT "arrêts_machine_cause_check" CHECK (((cause)::text = ANY (ARRAY[('panne_mecanique'::character varying)::text, ('panne_electrique'::character varying)::text, ('changement_matiere'::character varying)::text, ('reglage'::character varying)::text, ('coupure_electricite'::character varying)::text, ('manque_personnel'::character varying)::text, ('autre'::character varying)::text]))),
    CONSTRAINT "arrêts_machine_statut_check" CHECK (((statut)::text = ANY (ARRAY[('en_cours'::character varying)::text, ('clos'::character varying)::text])))
);


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    designation text,
    type_produit character varying(100),
    dimensions character varying(100),
    couleur character varying(50),
    cadence_heure numeric(10,2) DEFAULT 0,
    temps_reglage_min integer DEFAULT 30,
    poids_mandrin_kg numeric(6,3) DEFAULT 0,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    famille_id integer,
    sous_famille_id integer,
    categorie_id integer,
    unite_mesure_id integer,
    unite_mesure_achat_id integer,
    unite_mesure_vente_id integer,
    longueur_mm numeric(10,2),
    largeur_mm numeric(10,2),
    hauteur_mm numeric(10,2),
    dimensions_libelle character varying(100),
    poids_theorique_kg numeric(10,4),
    poids_reel_kg numeric(10,4),
    poids_tare_kg numeric(10,4),
    matiere character varying(100),
    epaisseur_mm numeric(8,3),
    cadence_theorique_kg_h numeric(10,2) DEFAULT 0,
    prix_achat numeric(12,4) DEFAULT 0,
    prix_vente numeric(12,4) DEFAULT 0,
    prix_cession_interne numeric(12,4) DEFAULT 0,
    devise character varying(10) DEFAULT 'DZD'::character varying,
    stock_mini numeric(12,3) DEFAULT 0,
    stock_maxi numeric(12,3),
    stock_securite numeric(12,3) DEFAULT 0,
    delai_appro_jours integer DEFAULT 0,
    dlc_jours integer,
    dluo_jours integer,
    temperature_stockage_min numeric(5,2),
    temperature_stockage_max numeric(5,2),
    allergenes text,
    points_ccp boolean DEFAULT false,
    description_ccp text,
    tracabilite_type character varying(20) DEFAULT 'lot'::character varying,
    type_article character varying(20) DEFAULT 'produit_fini'::character varying,
    normes_iso text,
    fiche_technique_path character varying(255),
    plan_path character varying(255),
    photo_path character varying(255),
    code_barre character varying(100),
    designation_fr character varying(255),
    designation_ar character varying(255),
    updated_at timestamp with time zone DEFAULT now(),
    fournisseur character varying(200),
    reference_fournisseur character varying(100),
    densite numeric(8,4),
    temperature_fusion numeric(6,1),
    temperature_traitement numeric(6,1),
    conditions_stockage text,
    risques_securite text,
    epi_requis text,
    certifications text,
    fiche_securite_path character varying(255),
    format_lot character varying(100) DEFAULT 'LOT-YYYYMMDD-001'::character varying,
    notes text,
    composition jsonb DEFAULT '[]'::jsonb,
    matieres_principales jsonb DEFAULT '[]'::jsonb,
    atelier_production_id integer,
    machines_ids jsonb DEFAULT '[]'::jsonb,
    temps_cycle_min numeric(8,3),
    conso_mp_kg numeric(10,4),
    poids_piece_kg numeric(10,4),
    taux_rebut_std numeric(5,2) DEFAULT 2.0,
    composition_familles jsonb DEFAULT '[]'::jsonb
);


--
-- Name: aspects_environnementaux; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aspects_environnementaux (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    processus_id uuid,
    activite character varying(255) NOT NULL,
    aspect character varying(255) NOT NULL,
    impact character varying(255) NOT NULL,
    condition character varying(20) DEFAULT 'normale'::character varying,
    frequence integer DEFAULT 1,
    gravite_env integer DEFAULT 1,
    maitrise integer DEFAULT 1,
    significatif boolean DEFAULT false,
    mesure_maitrise text,
    objectif_env text,
    responsable_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT aspects_environnementaux_condition_check CHECK (((condition)::text = ANY (ARRAY[('normale'::character varying)::text, ('anormale'::character varying)::text, ('urgence'::character varying)::text]))),
    CONSTRAINT aspects_environnementaux_frequence_check CHECK (((frequence >= 1) AND (frequence <= 5))),
    CONSTRAINT aspects_environnementaux_gravite_env_check CHECK (((gravite_env >= 1) AND (gravite_env <= 5))),
    CONSTRAINT aspects_environnementaux_maitrise_check CHECK (((maitrise >= 1) AND (maitrise <= 5)))
);


--
-- Name: ateliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ateliers (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    libelle character varying(100) NOT NULL,
    type character varying(30) DEFAULT 'production'::character varying,
    responsable_id uuid,
    localisation character varying(100),
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    parent_code character varying(20),
    CONSTRAINT ateliers_type_check CHECK (((type)::text = ANY (ARRAY[('production'::character varying)::text, ('technique'::character varying)::text, ('mecanique'::character varying)::text, ('achat'::character varying)::text, ('vente'::character varying)::text, ('transit'::character varying)::text, ('qhse'::character varying)::text, ('magasin'::character varying)::text, ('direction'::character varying)::text, ('rh'::character varying)::text])))
);


--
-- Name: ateliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ateliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ateliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ateliers_id_seq OWNED BY public.ateliers.id;


--
-- Name: audit_constats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_constats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    audit_id uuid,
    clause_iso character varying(20),
    type character varying(20),
    description text NOT NULL,
    evidence text,
    action_requise text,
    responsable uuid,
    echeance date,
    statut character varying(20) DEFAULT 'ouvert'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_constats_type_check CHECK (((type)::text = ANY (ARRAY[('conformite'::character varying)::text, ('non_conformite'::character varying)::text, ('observation'::character varying)::text, ('point_fort'::character varying)::text])))
);


--
-- Name: audit_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_seq
    START WITH 100
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_audit character varying(30) NOT NULL,
    type character varying(20) DEFAULT 'interne'::character varying,
    norme character varying(50),
    atelier_id integer,
    auditeur_id uuid,
    date_audit date NOT NULL,
    date_rapport date,
    statut character varying(20) DEFAULT 'planifie'::character varying,
    synthese text,
    created_at timestamp with time zone DEFAULT now(),
    date_planifiee date,
    date_realisation date,
    duree_jours numeric(4,1) DEFAULT 1,
    nb_ecarts_majeurs integer DEFAULT 0,
    nb_ecarts_mineurs integer DEFAULT 0,
    nb_observations integer DEFAULT 0,
    nb_points_forts integer DEFAULT 0,
    conclusion text,
    norme_auditee character varying(20),
    processus_audites jsonb DEFAULT '[]'::jsonb,
    ateliers_audites jsonb DEFAULT '[]'::jsonb,
    auditeur_chef_id uuid,
    auditeurs jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT audits_statut_check CHECK (((statut)::text = ANY (ARRAY[('planifie'::character varying)::text, ('en_cours'::character varying)::text, ('clos'::character varying)::text]))),
    CONSTRAINT audits_type_check CHECK (((type)::text = ANY (ARRAY[('interne'::character varying)::text, ('externe'::character varying)::text, ('certification'::character varying)::text, ('surveillance'::character varying)::text])))
);


--
-- Name: bc_lignes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bc_lignes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bc_id uuid,
    article_id uuid,
    designation character varying(200),
    quantite_pieces integer DEFAULT 0,
    quantite_kg numeric(12,3) DEFAULT 0,
    prix_unitaire_ht numeric(12,2) DEFAULT 0,
    remise_pct numeric(5,2) DEFAULT 0,
    taux_tva numeric(5,2) DEFAULT 18,
    montant_ht numeric(14,2) DEFAULT 0,
    montant_tva numeric(14,2) DEFAULT 0,
    montant_ttc numeric(14,2) DEFAULT 0,
    ordre integer DEFAULT 0
);


--
-- Name: bc_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bc_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bobines_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bobines_production (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_bobine character varying(60) NOT NULL,
    numero_lot character varying(60),
    of_id uuid,
    article_id uuid,
    machine_id integer,
    operateur_id uuid,
    poids_brut_kg numeric(10,3) DEFAULT 0,
    poids_net_kg numeric(10,3) DEFAULT 0,
    poids_mandrin_kg numeric(10,3) DEFAULT 0,
    longueur_m numeric(10,2),
    temperature_c numeric(6,1),
    vitesse_m_min numeric(8,2),
    pression_bar numeric(6,2),
    zone_actuelle_id integer,
    statut character varying(30) DEFAULT 'extrusion'::character varying,
    qc_quarantaine jsonb DEFAULT '{}'::jsonb,
    qc_impression jsonb DEFAULT '{}'::jsonb,
    heure_fin_extrusion timestamp with time zone,
    heure_entree_quar timestamp with time zone,
    heure_sortie_quar timestamp with time zone,
    heure_entree_impr timestamp with time zone,
    heure_sortie_impr timestamp with time zone,
    heure_entree_embl timestamp with time zone,
    heure_fin_embl timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: bons_commande; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bons_commande (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_bc character varying(30) DEFAULT ((('BC-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('public.bc_seq'::regclass))::text, 4, '0'::text)) NOT NULL,
    devis_id uuid,
    client_id uuid,
    article_id uuid,
    quantite numeric(12,3),
    quantite_pieces integer,
    prix_unitaire_fcfa numeric(12,2),
    montant_total_fcfa numeric(14,2),
    date_livraison_souhaitee date,
    adresse_livraison text,
    reference_client character varying(100),
    notes text,
    statut character varying(20) DEFAULT 'recu'::character varying,
    commercial_id uuid,
    df_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    taux_tva numeric(5,2) DEFAULT 18,
    remise_pct numeric(5,2) DEFAULT 0,
    montant_ht numeric(14,2),
    montant_tva numeric(14,2)
);


--
-- Name: bulletins_paie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulletins_paie (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employe_id uuid,
    periode date NOT NULL,
    salaire_base numeric(12,2) DEFAULT 0,
    prime_transport numeric(10,2) DEFAULT 0,
    prime_logement numeric(10,2) DEFAULT 0,
    prime_performance numeric(10,2) DEFAULT 0,
    prime_anciennete numeric(10,2) DEFAULT 0,
    autres_primes numeric(10,2) DEFAULT 0,
    heures_supp numeric(5,2) DEFAULT 0,
    taux_heures_supp numeric(10,2) DEFAULT 0,
    montant_heures_supp numeric(10,2) DEFAULT 0,
    salaire_brut numeric(12,2) DEFAULT 0,
    cotisation_cnps numeric(10,2) DEFAULT 0,
    impot_sur_salaire numeric(10,2) DEFAULT 0,
    autres_retenues numeric(10,2) DEFAULT 0,
    salaire_net numeric(12,2) DEFAULT 0,
    cotisation_patronale numeric(10,2) DEFAULT 0,
    date_paiement date,
    mode_paiement character varying(20) DEFAULT 'virement'::character varying,
    reference_paiement character varying(100),
    bulletin_path character varying(500),
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    cree_par uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bulletins_paie_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('valide'::character varying)::text, ('paye'::character varying)::text])))
);


--
-- Name: categories_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories_articles (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    libelle character varying(100) NOT NULL,
    actif boolean DEFAULT true
);


--
-- Name: categories_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_articles_id_seq OWNED BY public.categories_articles.id;


--
-- Name: cessions_at3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cessions_at3 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_cession character varying(60) NOT NULL,
    of_id uuid,
    bon_cession_id uuid,
    palettes_ids jsonb DEFAULT '[]'::jsonb,
    nb_palettes integer DEFAULT 0,
    nb_sacs_total integer DEFAULT 0,
    poids_total_kg numeric(12,3) DEFAULT 0,
    chef_atelier_id uuid,
    receptionnaire_id uuid,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    date_cession timestamp with time zone DEFAULT now(),
    date_reception timestamp with time zone,
    pdf_path character varying(500),
    pdf_genere boolean DEFAULT false,
    notes_chef text,
    notes_magasin text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code_sage character varying(50) NOT NULL,
    nom character varying(200) NOT NULL,
    moyenne_livraison_mensuelle numeric(10,2) DEFAULT 0,
    actif boolean DEFAULT true,
    type character varying(20) DEFAULT 'client'::character varying,
    adresse text,
    ville character varying(100),
    pays character varying(100) DEFAULT 'Algérie'::character varying,
    telephone character varying(50),
    email character varying(100),
    contact_principal character varying(100),
    credit_limite numeric(15,2) DEFAULT 0,
    delai_paiement_jours integer DEFAULT 30
);


--
-- Name: clients_complet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients_complet (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(10) DEFAULT 'B2B'::character varying,
    raison_sociale character varying(255) NOT NULL,
    contact_nom character varying(200),
    telephone character varying(50),
    telephone2 character varying(50),
    email character varying(100),
    adresse text,
    ville character varying(100),
    pays character varying(100) DEFAULT 'Algérie'::character varying,
    nif character varying(50),
    rc character varying(50),
    ai character varying(50),
    nis character varying(50),
    condition_paiement character varying(20) DEFAULT '30_jours'::character varying,
    delai_paiement_jours integer DEFAULT 30,
    credit_limite numeric(15,2) DEFAULT 0,
    solde_actuel numeric(15,2) DEFAULT 0,
    notes text,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT clients_complet_condition_paiement_check CHECK (((condition_paiement)::text = ANY (ARRAY[('immediat'::character varying)::text, ('30_jours'::character varying)::text, ('60_jours'::character varying)::text, ('90_jours'::character varying)::text, ('custom'::character varying)::text]))),
    CONSTRAINT clients_complet_type_check CHECK (((type)::text = ANY (ARRAY[('B2B'::character varying)::text, ('B2C'::character varying)::text, ('B2G'::character varying)::text])))
);


--
-- Name: commandes_achat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commandes_achat (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_commande character varying(50) NOT NULL,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    fournisseur_id uuid,
    date_commande date DEFAULT CURRENT_DATE,
    date_livraison_prevue date,
    montant_ht numeric(15,2) DEFAULT 0,
    taux_tva numeric(5,2) DEFAULT 19,
    montant_tva numeric(15,2) DEFAULT 0,
    montant_ttc numeric(15,2) DEFAULT 0,
    date_reception date,
    montant_recu numeric(15,2) DEFAULT 0,
    reference_fournisseur character varying(100),
    notes text,
    cree_par uuid,
    created_at timestamp with time zone DEFAULT now(),
    confirme_par uuid,
    confirme_at timestamp with time zone,
    CONSTRAINT commandes_achat_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('envoye'::character varying)::text, ('confirme'::character varying)::text, ('receptionne_partiel'::character varying)::text, ('receptionne'::character varying)::text, ('annule'::character varying)::text])))
);


--
-- Name: composition_article; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.composition_article (
    id integer NOT NULL,
    article_id uuid,
    groupe_id integer,
    famille_id integer,
    pct numeric(6,2) DEFAULT 0,
    poids_kg numeric(10,3),
    ordre integer DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: composition_article_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.composition_article_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: composition_article_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.composition_article_id_seq OWNED BY public.composition_article.id;


--
-- Name: config_alertes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_alertes (
    id integer NOT NULL,
    type character varying(50) NOT NULL,
    seuil numeric(10,2) NOT NULL,
    actif boolean DEFAULT true,
    canal character varying(20) DEFAULT 'interface'::character varying
);


--
-- Name: config_alertes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.config_alertes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: config_alertes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.config_alertes_id_seq OWNED BY public.config_alertes.id;


--
-- Name: conges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employe_id uuid,
    type_conge character varying(30) NOT NULL,
    date_debut date NOT NULL,
    date_fin date NOT NULL,
    nb_jours integer NOT NULL,
    motif text,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    valideur_id uuid,
    date_validation timestamp with time zone,
    commentaire_valideur text,
    justificatif_path character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conges_statut_check CHECK (((statut)::text = ANY (ARRAY[('en_attente'::character varying)::text, ('approuve'::character varying)::text, ('refuse'::character varying)::text, ('annule'::character varying)::text]))),
    CONSTRAINT conges_type_conge_check CHECK (((type_conge)::text = ANY (ARRAY[('annuel'::character varying)::text, ('maladie'::character varying)::text, ('maternite'::character varying)::text, ('paternite'::character varying)::text, ('sans_solde'::character varying)::text, ('exceptionnel'::character varying)::text, ('recuperation'::character varying)::text])))
);


--
-- Name: consommations_matiere; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consommations_matiere (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lot_matiere_id uuid,
    of_id uuid,
    session_id uuid,
    quantite_kg numeric(12,3) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contrats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contrats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employe_id uuid,
    type_contrat character varying(20) NOT NULL,
    date_debut date NOT NULL,
    date_fin date,
    duree_mois integer,
    salaire_base numeric(12,2) DEFAULT 0,
    devise character varying(10) DEFAULT 'FCFA'::character varying,
    temps_travail character varying(20) DEFAULT 'plein'::character varying,
    heures_semaine numeric(5,2) DEFAULT 40,
    periode_essai_mois integer DEFAULT 0,
    date_fin_essai date,
    prime_transport numeric(10,2) DEFAULT 0,
    prime_logement numeric(10,2) DEFAULT 0,
    autres_avantages text,
    contrat_path character varying(500),
    statut character varying(20) DEFAULT 'actif'::character varying,
    motif_fin text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contrats_statut_check CHECK (((statut)::text = ANY (ARRAY[('actif'::character varying)::text, ('expire'::character varying)::text, ('resilie'::character varying)::text, ('suspendu'::character varying)::text]))),
    CONSTRAINT contrats_temps_travail_check CHECK (((temps_travail)::text = ANY (ARRAY[('plein'::character varying)::text, ('partiel'::character varying)::text, ('mi_temps'::character varying)::text]))),
    CONSTRAINT contrats_type_contrat_check CHECK (((type_contrat)::text = ANY (ARRAY[('CDI'::character varying)::text, ('CDD'::character varying)::text, ('Stage'::character varying)::text, ('Apprentissage'::character varying)::text, ('Interim'::character varying)::text, ('Prestation'::character varying)::text])))
);


--
-- Name: controles_impression; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.controles_impression (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bobine_id uuid,
    of_id uuid,
    operateur_id uuid,
    type_impression character varying(50),
    couleur_encre character varying(50),
    texte_imprime text,
    controle_ok boolean DEFAULT false,
    nb_reprises integer DEFAULT 0,
    motif_reprise text,
    observations text,
    heure_debut timestamp with time zone DEFAULT now(),
    heure_fin timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: controles_qualite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.controles_qualite (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    of_id uuid,
    controleur_id uuid,
    session_id uuid,
    decision character varying(20) NOT NULL,
    notes text,
    photos jsonb DEFAULT '[]'::jsonb,
    signature_base64 text,
    signature_at timestamp with time zone,
    pdf_path character varying(255),
    pdf_genere_at timestamp with time zone,
    quantite_approuvee numeric(12,2) DEFAULT 0,
    quantite_rejetee numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT controles_qualite_decision_check CHECK (((decision)::text = ANY (ARRAY[('approuve'::character varying)::text, ('rejete'::character varying)::text, ('en_attente'::character varying)::text])))
);


--
-- Name: dbm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dbm (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_dbm character varying(60) NOT NULL,
    of_id uuid,
    atelier_id integer,
    magasin_id integer,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    urgence boolean DEFAULT false,
    date_besoin date,
    demandeur_id uuid,
    approuve_par uuid,
    livre_par uuid,
    date_demande timestamp with time zone DEFAULT now(),
    date_approbation timestamp with time zone,
    date_livraison timestamp with time zone,
    notes_demandeur text,
    notes_magasin text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dbm_lignes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dbm_lignes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dbm_id uuid,
    article_id uuid,
    famille_id integer,
    qte_demandee numeric(12,3) NOT NULL,
    qte_livree numeric(12,3) DEFAULT 0,
    qte_restante numeric(12,3) GENERATED ALWAYS AS ((qte_demandee - qte_livree)) STORED,
    unite character varying(20) DEFAULT 'kg'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    qte_en_transit numeric(12,3) DEFAULT 0,
    numero_lot character varying(100) DEFAULT ''::character varying
);


--
-- Name: dbm_livraisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dbm_livraisons (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dbm_id uuid,
    ligne_id uuid,
    article_id uuid,
    numero_lot character varying(80),
    qte_livree numeric(12,3) NOT NULL,
    date_livraison timestamp with time zone DEFAULT now(),
    livre_par uuid,
    numero_livraison character varying(60),
    receptionne boolean DEFAULT false,
    qte_recue numeric(12,3),
    observation_reception text,
    date_reception timestamp with time zone
);


--
-- Name: declaration_lignes_mp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.declaration_lignes_mp (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    declaration_id uuid,
    article_id uuid,
    famille_id integer,
    qte_prevue_kg numeric(12,3) DEFAULT 0,
    qte_reelle_kg numeric(12,3) DEFAULT 0,
    qte_restante_kg numeric(12,3) DEFAULT 0,
    ecart_kg numeric(12,3) GENERATED ALWAYS AS ((qte_reelle_kg - qte_prevue_kg)) STORED,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: declarations_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.declarations_production (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_decl character varying(60) NOT NULL,
    of_id uuid,
    atelier_id integer,
    poids_produit_kg numeric(12,3) DEFAULT 0,
    poids_dechets_kg numeric(12,3) DEFAULT 0,
    poids_rebuts_kg numeric(12,3) DEFAULT 0,
    temps_reel_min integer DEFAULT 0,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    declare_par uuid,
    valide_par uuid,
    date_declaration timestamp with time zone DEFAULT now(),
    date_validation timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: demandes_achat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_achat (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_demande character varying(30),
    demandeur_id uuid,
    atelier_id integer,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    notes text,
    commande_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    traite_par uuid,
    traite_at timestamp with time zone
);


--
-- Name: df_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.df_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: demandes_fabrication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_fabrication (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_df character varying(30) DEFAULT ((('DF-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('public.df_seq'::regclass))::text, 4, '0'::text)) NOT NULL,
    client_id uuid,
    article_id uuid,
    quantite_demandee numeric(12,3) NOT NULL,
    unite_id integer,
    description text,
    specifications text,
    date_livraison_souhaitee date,
    priorite integer DEFAULT 3,
    demandeur_id uuid,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    validee_par uuid,
    validee_at timestamp with time zone,
    motif_refus text,
    of_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bc_id uuid,
    devis_id uuid,
    quantite_pieces integer DEFAULT 0,
    CONSTRAINT demandes_fabrication_statut_check CHECK (((statut)::text = ANY (ARRAY[('en_attente'::character varying)::text, ('validee'::character varying)::text, ('refusee'::character varying)::text, ('annulee'::character varying)::text, ('annulation_demandee'::character varying)::text, ('modification_demandee'::character varying)::text])))
);


--
-- Name: devis_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devis_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devis (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_devis character varying(30) DEFAULT ((('DEV-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('public.devis_seq'::regclass))::text, 4, '0'::text)) NOT NULL,
    client_id uuid,
    article_id uuid,
    quantite numeric(12,3),
    quantite_pieces integer,
    prix_unitaire_fcfa numeric(12,2),
    montant_total_fcfa numeric(14,2),
    date_validite date,
    conditions_livraison text,
    notes text,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    commercial_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    taux_tva numeric(5,2) DEFAULT 18,
    remise_pct numeric(5,2) DEFAULT 0,
    montant_ht numeric(14,2),
    montant_tva numeric(14,2),
    email_envoye_at timestamp with time zone,
    validee_par_client_at timestamp with time zone
);


--
-- Name: devis_lignes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devis_lignes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    devis_id uuid,
    article_id uuid,
    designation character varying(200),
    quantite_pieces integer DEFAULT 0,
    quantite_kg numeric(12,3) DEFAULT 0,
    prix_unitaire_ht numeric(12,2) DEFAULT 0,
    remise_pct numeric(5,2) DEFAULT 0,
    taux_tva numeric(5,2) DEFAULT 18,
    montant_ht numeric(14,2) DEFAULT 0,
    montant_tva numeric(14,2) DEFAULT 0,
    montant_ttc numeric(14,2) DEFAULT 0,
    ordre integer DEFAULT 0
);


--
-- Name: documents_processus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents_processus (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    processus_id uuid,
    type_doc character varying(30),
    titre character varying(200) NOT NULL,
    contenu_html text,
    fichier_path character varying(255),
    version character varying(10) DEFAULT '1.0'::character varying,
    approuve_par uuid,
    date_approbation date,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT documents_processus_type_doc_check CHECK (((type_doc)::text = ANY (ARRAY[('procedure'::character varying)::text, ('instruction_travail'::character varying)::text, ('formulaire'::character varying)::text, ('enregistrement'::character varying)::text, ('plan_controle'::character varying)::text])))
);


--
-- Name: documents_qhse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents_qhse (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    titre character varying(255) NOT NULL,
    type_document character varying(30) NOT NULL,
    processus_id uuid,
    normes_applicables jsonb DEFAULT '[]'::jsonb,
    version character varying(10) DEFAULT 'v1'::character varying,
    version_precedente_id uuid,
    description text,
    file_path character varying(500),
    file_name character varying(255),
    file_size integer,
    mime_type character varying(100),
    redacteur_id uuid,
    verificateur_id uuid,
    approbateur_id uuid,
    date_redaction date,
    date_verification date,
    date_approbation date,
    date_prochaine_revision date,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    diffusion_liste jsonb DEFAULT '[]'::jsonb,
    mots_cles text,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contenu_texte text,
    resume_ia text,
    mots_cles_auto text[],
    nb_mots integer,
    CONSTRAINT documents_qhse_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('en_verification'::character varying)::text, ('en_approbation'::character varying)::text, ('approuve'::character varying)::text, ('obsolete'::character varying)::text, ('archive'::character varying)::text]))),
    CONSTRAINT documents_qhse_type_document_check CHECK (((type_document)::text = ANY (ARRAY[('procedure'::character varying)::text, ('instruction'::character varying)::text, ('formulaire'::character varying)::text, ('enregistrement'::character varying)::text, ('plan'::character varying)::text, ('manuel'::character varying)::text, ('specification'::character varying)::text, ('autre'::character varying)::text])))
);


--
-- Name: ecarts_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecarts_audit (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    audit_id uuid,
    type_ecart character varying(20) NOT NULL,
    processus_id uuid,
    norme_ref character varying(50),
    description text NOT NULL,
    exigence_ref character varying(100),
    preuve text,
    nc_id uuid,
    statut character varying(20) DEFAULT 'ouvert'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ecarts_audit_statut_check CHECK (((statut)::text = ANY (ARRAY[('ouvert'::character varying)::text, ('en_cours'::character varying)::text, ('clos'::character varying)::text]))),
    CONSTRAINT ecarts_audit_type_ecart_check CHECK (((type_ecart)::text = ANY (ARRAY[('majeur'::character varying)::text, ('mineur'::character varying)::text, ('observation'::character varying)::text, ('point_fort'::character varying)::text])))
);


--
-- Name: emplacements_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emplacements_stock (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    libelle character varying(100) NOT NULL,
    atelier_id integer,
    type character varying(30) DEFAULT 'stockage'::character varying,
    capacite_max_kg numeric(12,2),
    actif boolean DEFAULT true,
    CONSTRAINT emplacements_stock_type_check CHECK (((type)::text = ANY (ARRAY[('stockage'::character varying)::text, ('production'::character varying)::text, ('reception'::character varying)::text, ('expedition'::character varying)::text, ('quarantaine'::character varying)::text, ('rebut'::character varying)::text])))
);


--
-- Name: emplacements_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emplacements_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emplacements_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emplacements_stock_id_seq OWNED BY public.emplacements_stock.id;


--
-- Name: employes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    matricule character varying(30) NOT NULL,
    nom character varying(100) NOT NULL,
    prenom character varying(100) NOT NULL,
    date_naissance date,
    lieu_naissance character varying(200),
    nationalite character varying(100) DEFAULT 'Ivoirienne'::character varying,
    sexe character varying(10),
    situation_familiale character varying(20),
    nb_enfants integer DEFAULT 0,
    telephone character varying(50),
    telephone2 character varying(50),
    email character varying(100),
    adresse text,
    ville character varying(100),
    num_cni character varying(50),
    num_cnps character varying(50),
    num_passport character varying(50),
    poste_id integer,
    atelier_id integer,
    responsable_id uuid,
    date_embauche date,
    date_fin_contrat date,
    user_id uuid,
    photo_path character varying(500),
    statut character varying(20) DEFAULT 'actif'::character varying,
    actif boolean DEFAULT true,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employes_sexe_check CHECK (((sexe)::text = ANY (ARRAY[('M'::character varying)::text, ('F'::character varying)::text]))),
    CONSTRAINT employes_situation_familiale_check CHECK (((situation_familiale)::text = ANY (ARRAY[('celibataire'::character varying)::text, ('marie'::character varying)::text, ('divorce'::character varying)::text, ('veuf'::character varying)::text]))),
    CONSTRAINT employes_statut_check CHECK (((statut)::text = ANY (ARRAY[('actif'::character varying)::text, ('conge'::character varying)::text, ('suspendu'::character varying)::text, ('demissionne'::character varying)::text, ('licencie'::character varying)::text, ('retraite'::character varying)::text])))
);


--
-- Name: equipements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(30) NOT NULL,
    designation character varying(200) NOT NULL,
    type character varying(50),
    marque character varying(100),
    modele character varying(100),
    numero_serie character varying(100),
    atelier_id integer,
    puissance_kw numeric(8,2),
    tension_v integer,
    annee_fabrication integer,
    date_mise_service date,
    valeur_achat numeric(12,2),
    fournisseur_id uuid,
    manuel_path character varying(255),
    photo_path character varying(255),
    statut character varying(20) DEFAULT 'operationnel'::character varying,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    criticite character varying(20) DEFAULT 'normale'::character varying,
    type_equipement character varying(50) DEFAULT 'machine'::character varying,
    responsable_id uuid,
    localisation character varying(200),
    puissance character varying(50),
    tension character varying(50),
    date_acquisition date,
    date_mise_en_service date,
    date_fin_garantie date,
    duree_vie_ans integer,
    valeur_acquisition numeric(15,2) DEFAULT 0,
    valeur_actuelle numeric(15,2) DEFAULT 0,
    compteur_heures numeric(12,2) DEFAULT 0,
    compteur_cycles integer DEFAULT 0,
    famille character varying(100),
    notes text,
    facteur_puissance numeric(4,3) DEFAULT 0.85,
    intensite_a numeric(8,2),
    CONSTRAINT equipements_statut_check CHECK (((statut)::text = ANY (ARRAY[('operationnel'::character varying)::text, ('en_panne'::character varying)::text, ('maintenance'::character varying)::text, ('rebut'::character varying)::text])))
);


--
-- Name: evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employe_id uuid,
    evaluateur_id uuid,
    periode character varying(20),
    date_evaluation date DEFAULT CURRENT_DATE,
    note_qualite_travail numeric(3,1),
    note_productivite numeric(3,1),
    note_ponctualite numeric(3,1),
    note_esprit_equipe numeric(3,1),
    note_initiative numeric(3,1),
    note_securite numeric(3,1),
    note_globale numeric(3,1),
    points_forts text,
    axes_amelioration text,
    objectifs_prochaine_periode text,
    commentaire_employe text,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT evaluations_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('signe_evaluateur'::character varying)::text, ('signe_employe'::character varying)::text, ('valide'::character varying)::text])))
);


--
-- Name: familles_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.familles_articles (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    libelle character varying(100) NOT NULL,
    description text,
    actif boolean DEFAULT true
);


--
-- Name: familles_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.familles_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: familles_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.familles_articles_id_seq OWNED BY public.familles_articles.id;


--
-- Name: formations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    titre character varying(255) NOT NULL,
    type_formation character varying(30) DEFAULT 'interne'::character varying,
    norme_associee character varying(20),
    objectifs text,
    contenu text,
    duree_heures numeric(5,1),
    formateur character varying(200),
    organisme_formation character varying(200),
    lieu character varying(200),
    date_planifiee date,
    date_realisation date,
    date_prochaine_session date,
    validite_mois integer DEFAULT 12,
    participants jsonb DEFAULT '[]'::jsonb,
    support_path character varying(500),
    attestation_path character varying(500),
    statut character varying(20) DEFAULT 'planifie'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT formations_statut_check CHECK (((statut)::text = ANY (ARRAY[('planifie'::character varying)::text, ('realise'::character varying)::text, ('annule'::character varying)::text]))),
    CONSTRAINT formations_type_formation_check CHECK (((type_formation)::text = ANY (ARRAY[('interne'::character varying)::text, ('externe'::character varying)::text, ('e_learning'::character varying)::text, ('habilitation'::character varying)::text, ('recyclage'::character varying)::text])))
);


--
-- Name: fournisseurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fournisseurs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    raison_sociale character varying(255) NOT NULL,
    contact_nom character varying(200),
    telephone character varying(50),
    email character varying(100),
    adresse text,
    ville character varying(100),
    pays character varying(100) DEFAULT 'Algérie'::character varying,
    nif character varying(50),
    condition_paiement character varying(20) DEFAULT '30_jours'::character varying,
    delai_paiement_jours integer DEFAULT 30,
    credit_limite numeric(15,2) DEFAULT 0,
    solde_actuel numeric(15,2) DEFAULT 0,
    notes text,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: habilitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habilitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    utilisateur_id uuid,
    type_habilitation character varying(100) NOT NULL,
    numero character varying(100),
    organisme_delivrant character varying(200),
    date_obtention date,
    date_expiration date,
    statut character varying(20) DEFAULT 'valide'::character varying,
    document_path character varying(500),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT habilitations_statut_check CHECK (((statut)::text = ANY (ARRAY[('valide'::character varying)::text, ('expire'::character varying)::text, ('suspendu'::character varying)::text, ('en_cours'::character varying)::text])))
);


--
-- Name: historique_pannes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historique_pannes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    equipement_id uuid,
    ot_id uuid,
    date_panne timestamp with time zone DEFAULT now() NOT NULL,
    date_remise_service timestamp with time zone,
    symptomes text NOT NULL,
    cause text,
    type_defaillance character varying(50),
    duree_arret_h numeric(8,2) DEFAULT 0,
    cout_panne numeric(12,2) DEFAULT 0,
    production_perdue numeric(12,2) DEFAULT 0,
    mtbf_avant numeric(10,2),
    mttr numeric(8,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ia_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ia_conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    utilisateur_id uuid,
    atelier_id integer,
    type_contexte character varying(30),
    entite_type character varying(30),
    entite_id uuid,
    messages jsonb DEFAULT '[]'::jsonb,
    modele_ia character varying(100) DEFAULT 'qwen2.5-coder:7b'::character varying,
    resume text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ia_conversations_type_contexte_check CHECK (((type_contexte)::text = ANY (ARRAY[('qhse'::character varying)::text, ('production'::character varying)::text, ('gmao'::character varying)::text, ('processus'::character varying)::text, ('stock'::character varying)::text, ('general'::character varying)::text])))
);


--
-- Name: ia_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ia_suggestions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(30),
    entite_type character varying(30),
    entite_id uuid,
    suggestion text NOT NULL,
    confiance numeric(4,2),
    appliquee boolean DEFAULT false,
    rejetee boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ia_suggestions_type_check CHECK (((type)::text = ANY (ARRAY[('action_corrective'::character varying)::text, ('analyse_nc'::character varying)::text, ('optimisation_production'::character varying)::text, ('alerte_predictive'::character varying)::text, ('documentation'::character varying)::text])))
);


--
-- Name: imports_sage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imports_sage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nom_fichier character varying(255),
    nb_of_importes integer DEFAULT 0,
    nb_articles_importes integer DEFAULT 0,
    statut character varying(20) DEFAULT 'succes'::character varying,
    erreurs jsonb DEFAULT '[]'::jsonb,
    importe_par uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: incident_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incident_seq
    START WITH 100
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidents_securite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents_securite (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_incident character varying(30) NOT NULL,
    type character varying(30) NOT NULL,
    gravite character varying(20) DEFAULT 'sans_arret'::character varying,
    atelier_id integer,
    personne_impliquee character varying(200),
    description text NOT NULL,
    causes text,
    "actions_immédiates" text,
    actions_correctives text,
    temoins text,
    photos jsonb DEFAULT '[]'::jsonb,
    arret_travail_jours integer DEFAULT 0,
    cout_estime numeric(12,2) DEFAULT 0,
    declare_par uuid,
    statut character varying(20) DEFAULT 'ouvert'::character varying,
    date_incident timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT incidents_securite_gravite_check CHECK (((gravite)::text = ANY (ARRAY[('sans_arret'::character varying)::text, ('avec_arret'::character varying)::text, ('grave'::character varying)::text, ('mortel'::character varying)::text]))),
    CONSTRAINT incidents_securite_type_check CHECK (((type)::text = ANY (ARRAY[('accident'::character varying)::text, ('presque_accident'::character varying)::text, ('situation_dangereuse'::character varying)::text, ('maladie_pro'::character varying)::text, ('dommage_materiel'::character varying)::text])))
);


--
-- Name: indicateurs_qhse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indicateurs_qhse (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(30) NOT NULL,
    libelle character varying(255) NOT NULL,
    processus_id uuid,
    norme_associee character varying(20),
    formule text,
    unite character varying(50),
    frequence_mesure character varying(20) DEFAULT 'mensuel'::character varying,
    objectif_valeur numeric(12,4),
    seuil_alerte numeric(12,4),
    sens character varying(10) DEFAULT 'hausse'::character varying,
    responsable_id uuid,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT indicateurs_qhse_frequence_mesure_check CHECK (((frequence_mesure)::text = ANY (ARRAY[('journalier'::character varying)::text, ('hebdo'::character varying)::text, ('mensuel'::character varying)::text, ('trimestriel'::character varying)::text, ('annuel'::character varying)::text]))),
    CONSTRAINT indicateurs_qhse_sens_check CHECK (((sens)::text = ANY (ARRAY[('hausse'::character varying)::text, ('baisse'::character varying)::text])))
);


--
-- Name: interactions_processus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interactions_processus (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    processus_source_id uuid,
    processus_dest_id uuid,
    description character varying(255)
);


--
-- Name: interventions_externes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interventions_externes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    equipement_id uuid,
    ot_id uuid,
    fournisseur_id uuid,
    titre character varying(255) NOT NULL,
    description text,
    date_demande date,
    date_intervention date,
    date_fin date,
    cout_ht numeric(12,2) DEFAULT 0,
    cout_ttc numeric(12,2) DEFAULT 0,
    numero_facture character varying(100),
    statut character varying(20) DEFAULT 'demande'::character varying,
    rapport text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT interventions_externes_statut_check CHECK (((statut)::text = ANY (ARRAY[('demande'::character varying)::text, ('planifie'::character varying)::text, ('en_cours'::character varying)::text, ('termine'::character varying)::text, ('facture'::character varying)::text])))
);


--
-- Name: journal_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    article_id uuid,
    emplacement_id integer,
    type character varying(10) NOT NULL,
    qte numeric(12,3) NOT NULL,
    prix_unitaire numeric(12,4) DEFAULT 0,
    numero_lot character varying(100),
    notes text,
    cree_par uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lignes_achat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lignes_achat (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    commande_id uuid,
    article_id uuid,
    designation character varying(255) NOT NULL,
    quantite_commandee numeric(12,3) NOT NULL,
    quantite_recue numeric(12,3) DEFAULT 0,
    unite_id integer,
    prix_unitaire_ht numeric(12,4) NOT NULL,
    taux_tva numeric(5,2) DEFAULT 19,
    montant_ht numeric(15,2) DEFAULT 0,
    montant_ttc numeric(15,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lignes_demande_achat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lignes_demande_achat (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    demande_id uuid,
    article_id uuid,
    designation character varying(255),
    quantite_demandee numeric(12,3) NOT NULL,
    notes text
);


--
-- Name: lignes_mouvement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lignes_mouvement (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    mouvement_id uuid,
    article_id uuid,
    lot_id uuid,
    qte_prevue numeric(15,3) NOT NULL,
    qte_reelle numeric(15,3),
    unite_id integer,
    poids_theorique_kg numeric(12,4),
    poids_reel_kg numeric(12,4),
    prix_unitaire numeric(12,4) DEFAULT 0,
    montant_total numeric(15,4) DEFAULT 0,
    ecart_qte numeric(15,3) GENERATED ALWAYS AS ((qte_reelle - qte_prevue)) STORED,
    motif_ecart text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lignes_reception_achat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lignes_reception_achat (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reception_id uuid,
    ligne_achat_id uuid,
    quantite_recue numeric(14,3) NOT NULL,
    prix_unitaire_ht numeric(14,2)
);


--
-- Name: lignes_vente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lignes_vente (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vente_id uuid,
    article_id uuid,
    designation character varying(255) NOT NULL,
    quantite numeric(12,3) NOT NULL,
    unite_id integer,
    prix_unitaire_ht numeric(12,4) NOT NULL,
    taux_remise numeric(5,2) DEFAULT 0,
    taux_tva numeric(5,2) DEFAULT 19,
    montant_ht numeric(15,2) DEFAULT 0,
    montant_tva numeric(15,2) DEFAULT 0,
    montant_ttc numeric(15,2) DEFAULT 0,
    lot_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: logs_activite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs_activite (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    utilisateur_id uuid,
    action character varying(100) NOT NULL,
    module character varying(50),
    ressource_id character varying(100),
    details jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lots_matiere; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lots_matiere (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    matiere_id uuid,
    numero_lot character varying(50) NOT NULL,
    fournisseur character varying(200),
    date_reception date DEFAULT CURRENT_DATE,
    quantite_recue_kg numeric(12,3) NOT NULL,
    quantite_restante_kg numeric(12,3) NOT NULL,
    certificat_path character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lots_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lots_stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    article_id uuid,
    emplacement_id integer,
    numero_lot character varying(80) NOT NULL,
    numero_serie character varying(80),
    fournisseur_id uuid,
    date_reception date DEFAULT CURRENT_DATE,
    date_fabrication date,
    date_dlc date,
    date_dluo date,
    qte_initiale numeric(15,3) NOT NULL,
    qte_disponible numeric(15,3) NOT NULL,
    prix_unitaire numeric(12,4) DEFAULT 0,
    certificat_path character varying(255),
    statut character varying(20) DEFAULT 'disponible'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    fournisseur_nom character varying(200),
    emplacement_atelier character varying(20) DEFAULT 'AT3'::character varying,
    CONSTRAINT lots_stock_statut_check CHECK (((statut)::text = ANY (ARRAY[('disponible'::character varying)::text, ('quarantaine'::character varying)::text, ('bloque'::character varying)::text, ('perime'::character varying)::text, ('epuise'::character varying)::text])))
);


--
-- Name: machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machines (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    nom character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    numero integer NOT NULL,
    actif boolean DEFAULT true,
    imprimante_type character varying(20),
    imprimante_adresse character varying(100),
    atelier_id character varying(20) DEFAULT 'AT3'::character varying,
    CONSTRAINT machines_imprimante_type_check CHECK (((imprimante_type)::text = ANY (ARRAY[('bluetooth'::character varying)::text, ('wifi'::character varying)::text, ('ethernet'::character varying)::text]))),
    CONSTRAINT machines_type_check CHECK (((type)::text = ANY (ARRAY[('extrudeuse'::character varying)::text, ('soudeuse'::character varying)::text, ('impression'::character varying)::text])))
);


--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- Name: matieres_premieres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matieres_premieres (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reference character varying(50) NOT NULL,
    designation character varying(200) NOT NULL,
    type character varying(50) DEFAULT 'granules'::character varying,
    unite character varying(20) DEFAULT 'kg'::character varying,
    stock_actuel numeric(12,3) DEFAULT 0,
    stock_minimum numeric(12,3) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: matricule_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.matricule_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mouvement_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mouvement_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mouvements_at3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mouvements_at3 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_ticket character varying(60) NOT NULL,
    of_id uuid,
    zone_source_id integer,
    zone_dest_id integer,
    type_mouvement character varying(30) NOT NULL,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    bobines_ids jsonb DEFAULT '[]'::jsonb,
    nb_bobines integer DEFAULT 0,
    poids_total_kg numeric(12,3) DEFAULT 0,
    cree_par uuid,
    valide_par uuid,
    date_mouvement timestamp with time zone DEFAULT now(),
    date_validation timestamp with time zone,
    notes text,
    ticket_genere boolean DEFAULT false,
    ticket_path character varying(500),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: mouvements_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mouvements_stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_bon character varying(30) NOT NULL,
    type_mouvement character varying(30) NOT NULL,
    atelier_source_id integer,
    emplacement_source_id integer,
    atelier_dest_id integer,
    emplacement_dest_id integer,
    client_id uuid,
    of_id uuid,
    session_id uuid,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    date_mouvement date DEFAULT CURRENT_DATE,
    date_validation timestamp with time zone,
    date_reception timestamp with time zone,
    cree_par uuid,
    valide_par uuid,
    receptionne_par uuid,
    notes text,
    motif_annulation text,
    pdf_path character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mouvements_stock_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('valide'::character varying)::text, ('expedie'::character varying)::text, ('receptionne'::character varying)::text, ('annule'::character varying)::text]))),
    CONSTRAINT mouvements_stock_type_mouvement_check CHECK (((type_mouvement)::text = ANY (ARRAY[('cession_atelier'::character varying)::text, ('livraison_mp'::character varying)::text, ('livraison_pf_interne'::character varying)::text, ('reception_achat'::character varying)::text, ('expedition_vente'::character varying)::text, ('retour_atelier'::character varying)::text, ('ajustement_positif'::character varying)::text, ('ajustement_negatif'::character varying)::text, ('production'::character varying)::text, ('consommation_mp'::character varying)::text])))
);


--
-- Name: mouvements_stock_at3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mouvements_stock_at3 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_mvt character varying(60) NOT NULL,
    type_mvt character varying(20) NOT NULL,
    article_id uuid,
    quantite numeric(12,3) NOT NULL,
    unite character varying(20) DEFAULT 'kg'::character varying,
    dbm_id uuid,
    of_id uuid,
    stock_at3_id uuid,
    operateur_id uuid,
    notes text,
    date_mvt timestamp with time zone DEFAULT now()
);


--
-- Name: nc_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nc_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: non_conformites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.non_conformites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_nc character varying(30) NOT NULL,
    type character varying(30) NOT NULL,
    gravite character varying(20) DEFAULT 'mineure'::character varying,
    atelier_id integer,
    of_id uuid,
    article_id uuid,
    machine_id integer,
    titre character varying(255) NOT NULL,
    description text NOT NULL,
    causes_identifiees text,
    qte_impactee numeric(12,3),
    valeur_impactee numeric(12,4),
    action_immediate text,
    action_corrective text,
    action_preventive text,
    detecte_par uuid,
    responsable_traitement uuid,
    gravite_amdec integer,
    occurrence_amdec integer,
    detectabilite_amdec integer,
    ipr_amdec integer GENERATED ALWAYS AS (COALESCE(((gravite_amdec * occurrence_amdec) * detectabilite_amdec), 0)) STORED,
    photos jsonb DEFAULT '[]'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb,
    analyse_ia text,
    statut character varying(20) DEFAULT 'ouvert'::character varying,
    date_detection date DEFAULT CURRENT_DATE,
    date_cloture date,
    delai_traitement_jours integer,
    created_at timestamp with time zone DEFAULT now(),
    type_nc character varying(30) DEFAULT 'qualite'::character varying,
    produit_concerne character varying(200),
    lot_concerne character varying(100),
    detecteur_id uuid,
    responsable_traitement_id uuid,
    cause_principale text,
    cause_matiere text,
    cause_milieu text,
    cause_machine text,
    cause_methode text,
    cause_main_oeuvre text,
    verification_efficacite text,
    date_verification date,
    efficacite_confirmee boolean,
    cout_nc numeric(12,2) DEFAULT 0,
    gravite_score integer DEFAULT 1,
    occurrence_score integer DEFAULT 1,
    detectabilite_score integer DEFAULT 1,
    normes_applicables jsonb DEFAULT '[]'::jsonb,
    pieces_jointes jsonb DEFAULT '[]'::jsonb,
    notes text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT non_conformites_detectabilite_amdec_check CHECK (((detectabilite_amdec >= 1) AND (detectabilite_amdec <= 10))),
    CONSTRAINT non_conformites_gravite_amdec_check CHECK (((gravite_amdec >= 1) AND (gravite_amdec <= 10))),
    CONSTRAINT non_conformites_gravite_check CHECK (((gravite)::text = ANY (ARRAY[('mineure'::character varying)::text, ('majeure'::character varying)::text, ('critique'::character varying)::text, ('bloquante'::character varying)::text]))),
    CONSTRAINT non_conformites_occurrence_amdec_check CHECK (((occurrence_amdec >= 1) AND (occurrence_amdec <= 10))),
    CONSTRAINT non_conformites_statut_check CHECK (((statut)::text = ANY (ARRAY[('ouvert'::character varying)::text, ('en_cours'::character varying)::text, ('clos'::character varying)::text, ('annule'::character varying)::text]))),
    CONSTRAINT non_conformites_type_check CHECK (((type)::text = ANY (ARRAY[('interne'::character varying)::text, ('client'::character varying)::text, ('fournisseur'::character varying)::text, ('produit'::character varying)::text, ('processus'::character varying)::text, ('equipement'::character varying)::text, ('securite'::character varying)::text])))
);


--
-- Name: normes_qhse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.normes_qhse (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    libelle character varying(200) NOT NULL,
    version character varying(20),
    organisme character varying(100),
    actif boolean DEFAULT true
);


--
-- Name: normes_qhse_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.normes_qhse_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: normes_qhse_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.normes_qhse_id_seq OWNED BY public.normes_qhse.id;


--
-- Name: objectifs_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectifs_production (
    id integer NOT NULL,
    machine_id integer,
    shift_id integer,
    objectif_trs_pct numeric(5,2) DEFAULT 80,
    objectif_kg_par_shift numeric(10,2),
    objectif_rebus_max_pct numeric(5,2) DEFAULT 3,
    actif boolean DEFAULT true
);


--
-- Name: objectifs_production_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objectifs_production_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objectifs_production_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objectifs_production_id_seq OWNED BY public.objectifs_production.id;


--
-- Name: of_composition_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.of_composition_lots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    of_id uuid,
    article_mp_id uuid,
    lot_id uuid,
    nom_matiere character varying(200),
    numero_lot character varying(100),
    qte_prevue numeric(12,3),
    qte_reelle numeric(12,3) DEFAULT 0,
    unite_id integer,
    pourcentage numeric(5,2),
    statut character varying(20) DEFAULT 'planifie'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: of_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.of_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ol_lignes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ol_lignes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ol_id uuid,
    bc_ligne_id uuid,
    article_id uuid,
    designation character varying(255),
    quantite_commandee numeric(12,3),
    quantite_livrer numeric(12,3) NOT NULL,
    quantite_livree numeric(12,3) DEFAULT 0,
    ordre integer DEFAULT 0
);


--
-- Name: ol_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ol_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordres_fabrication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordres_fabrication (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_of character varying(50) DEFAULT ((('OF-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('public.of_seq'::regclass))::text, 4, '0'::text)) NOT NULL,
    client_id uuid,
    article_id uuid,
    quantite_cible numeric(12,2) NOT NULL,
    quantite_produite numeric(12,2) DEFAULT 0,
    date_livraison_prevue date,
    priorite integer DEFAULT 5,
    statut character varying(30) DEFAULT 'planifie'::character varying,
    machine_id integer,
    temps_prevu_min integer,
    date_import timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    atelier_id character varying(20),
    unite_id integer,
    poids_theorique_total_kg numeric(12,4),
    poids_reel_total_kg numeric(12,4) DEFAULT 0,
    temps_reel_min integer DEFAULT 0,
    date_lancement date,
    date_livraison_reelle date,
    reference_sage character varying(100),
    instructions text,
    date_debut_prevue date,
    date_debut_reel timestamp with time zone,
    date_fin_reel timestamp with time zone,
    df_id uuid,
    motif_pause text,
    nb_pauses integer DEFAULT 0,
    at3_statut_zone character varying(30) DEFAULT 'nouveau'::character varying,
    at3_composition_validee boolean DEFAULT false,
    at3_poids_cible_kg numeric(12,3),
    at3_nb_bobines_cibles integer,
    at3_notes_regleur text,
    at3_notes_chef text,
    at3_valide_par uuid,
    at3_valide_le timestamp with time zone,
    at3_machine_assignee_id integer,
    at3_composition_of jsonb DEFAULT '[]'::jsonb,
    at3_composition_familles jsonb DEFAULT '[]'::jsonb,
    quantite_pieces integer DEFAULT 0,
    regleur_valide boolean DEFAULT false,
    regleur_valide_at timestamp with time zone,
    regleur_id uuid,
    numero_ticket_reglage character varying(30),
    regleur_temperature numeric(6,2),
    regleur_pression numeric(6,2),
    regleur_vitesse numeric(6,2),
    regleur_notes text,
    statut_reglage character varying(20) DEFAULT 'non_regle'::character varying,
    CONSTRAINT ordres_fabrication_statut_check CHECK (((statut)::text = ANY (ARRAY[('planifie'::character varying)::text, ('lance'::character varying)::text, ('en_attente_regleur'::character varying)::text, ('en_cours'::character varying)::text, ('pause'::character varying)::text, ('termine'::character varying)::text, ('annule'::character varying)::text, ('pret_livraison'::character varying)::text])))
);


--
-- Name: ordres_livraison; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordres_livraison (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_ol character varying(20),
    df_id uuid,
    of_id uuid,
    bc_id uuid,
    client_id uuid,
    client_destination_id uuid,
    article_id uuid,
    quantite_livrer numeric(12,3) DEFAULT 0 NOT NULL,
    quantite_livree numeric(12,3) DEFAULT 0,
    date_livraison_prevue date,
    date_livraison_reelle date,
    adresse_livraison text,
    notes text,
    statut character varying(30) DEFAULT 'brouillon'::character varying,
    est_derogatoire boolean DEFAULT false,
    demandeur_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    numero_suivi character varying(100),
    transporteur character varying(100)
);


--
-- Name: ordres_travail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordres_travail (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_ot character varying(30) NOT NULL,
    equipement_id uuid,
    plan_id uuid,
    type character varying(20) DEFAULT 'correctif'::character varying,
    priorite character varying(20) DEFAULT 'normale'::character varying,
    titre character varying(255) NOT NULL,
    description text,
    cause_panne text,
    symptomes text,
    travaux_effectues text,
    pieces_utilisees jsonb DEFAULT '[]'::jsonb,
    temps_prevu_min integer,
    temps_reel_min integer DEFAULT 0,
    cout_main_oeuvre numeric(10,2) DEFAULT 0,
    cout_pieces numeric(10,2) DEFAULT 0,
    cout_total numeric(10,2) GENERATED ALWAYS AS ((cout_main_oeuvre + cout_pieces)) STORED,
    technicien_id uuid,
    valide_par uuid,
    date_signalement timestamp with time zone DEFAULT now(),
    date_debut timestamp with time zone,
    date_fin timestamp with time zone,
    date_planifiee date,
    statut character varying(20) DEFAULT 'ouvert'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    type_ot character varying(20) DEFAULT 'curatif'::character varying,
    arret_machine boolean DEFAULT false,
    duree_arret_h numeric(5,2) DEFAULT 0,
    travaux_realises text,
    solution_appliquee text,
    duree_estimee_h numeric(5,2),
    duree_reelle_h numeric(5,2),
    plan_maintenance_id uuid,
    demandeur_id uuid,
    date_debut_reel timestamp with time zone,
    date_fin_reel timestamp with time zone,
    notes text,
    updated_at timestamp with time zone DEFAULT now(),
    date_demande timestamp with time zone DEFAULT now(),
    CONSTRAINT ordres_travail_priorite_check CHECK (((priorite)::text = ANY (ARRAY[('faible'::character varying)::text, ('normale'::character varying)::text, ('haute'::character varying)::text, ('urgente'::character varying)::text]))),
    CONSTRAINT ordres_travail_statut_check CHECK (((statut)::text = ANY (ARRAY[('ouvert'::character varying)::text, ('en_cours'::character varying)::text, ('suspendu'::character varying)::text, ('clos'::character varying)::text, ('annule'::character varying)::text]))),
    CONSTRAINT ordres_travail_type_check CHECK (((type)::text = ANY (ARRAY[('preventif'::character varying)::text, ('correctif'::character varying)::text, ('amelioratif'::character varying)::text])))
);


--
-- Name: ot_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ot_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: paiements_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paiements_clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_id uuid,
    vente_id uuid,
    montant numeric(15,2) NOT NULL,
    mode_paiement character varying(30) DEFAULT 'virement'::character varying,
    date_paiement date DEFAULT CURRENT_DATE,
    reference character varying(100),
    notes text,
    cree_par uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: palettes_emballage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.palettes_emballage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_palette character varying(60) NOT NULL,
    of_id uuid,
    article_id uuid,
    numero_lot character varying(60),
    bobines_ids jsonb DEFAULT '[]'::jsonb,
    nb_sacs integer DEFAULT 0,
    poids_sacs_kg numeric(12,3) DEFAULT 0,
    poids_palette_kg numeric(12,3) DEFAULT 0,
    poids_total_kg numeric(12,3) DEFAULT 0,
    type_emballage character varying(50),
    nb_couches integer,
    sacs_par_couche integer,
    etiquette_imprimee boolean DEFAULT false,
    qr_code character varying(255),
    zone_id integer,
    statut character varying(20) DEFAULT 'emballage'::character varying,
    emballeur_id uuid,
    controleur_id uuid,
    ticket_imprime boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: parametres_energie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametres_energie (
    id integer NOT NULL,
    tarif_kwh numeric(10,4) DEFAULT 105.0,
    devise character varying(10) DEFAULT 'FCFA'::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: parametres_energie_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parametres_energie_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parametres_energie_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parametres_energie_id_seq OWNED BY public.parametres_energie.id;


--
-- Name: parametres_systeme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametres_systeme (
    cle character varying(100) NOT NULL,
    valeur text,
    type_valeur character varying(20) DEFAULT 'string'::character varying,
    description text,
    modifiable_par character varying(50) DEFAULT 'super_admin'::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: permissions_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions_roles (
    id integer NOT NULL,
    role character varying(50) NOT NULL,
    module character varying(50) NOT NULL,
    peut_voir boolean DEFAULT true,
    peut_creer boolean DEFAULT false,
    peut_modifier boolean DEFAULT false,
    peut_supprimer boolean DEFAULT false,
    voir_finance boolean DEFAULT false
);


--
-- Name: permissions_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_roles_id_seq OWNED BY public.permissions_roles.id;


--
-- Name: pieces_detachees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pieces_detachees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(30) NOT NULL,
    designation character varying(255) NOT NULL,
    famille character varying(100),
    unite character varying(20) DEFAULT 'pcs'::character varying,
    qte_stock integer DEFAULT 0,
    qte_minimum integer DEFAULT 0,
    qte_maximum integer DEFAULT 100,
    prix_unitaire numeric(12,2) DEFAULT 0,
    fournisseur_id uuid,
    reference_fournisseur character varying(100),
    delai_livraison_jours integer DEFAULT 7,
    emplacement_magasin character varying(100),
    equipements_compatibles jsonb DEFAULT '[]'::jsonb,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: plan_formation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_formation (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    titre character varying(255) NOT NULL,
    type_formation character varying(30) DEFAULT 'interne'::character varying,
    organisme character varying(200),
    date_debut date,
    date_fin date,
    duree_heures numeric(5,1),
    cout numeric(12,2) DEFAULT 0,
    lieu character varying(200),
    objectifs text,
    participants jsonb DEFAULT '[]'::jsonb,
    nb_participants integer DEFAULT 0,
    statut character varying(20) DEFAULT 'planifie'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT plan_formation_statut_check CHECK (((statut)::text = ANY (ARRAY[('planifie'::character varying)::text, ('en_cours'::character varying)::text, ('realise'::character varying)::text, ('annule'::character varying)::text])))
);


--
-- Name: planning_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_machines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    of_id uuid,
    machine_id integer,
    shift_id integer,
    date_planifiee date NOT NULL,
    heure_debut_prevue time without time zone,
    heure_fin_prevue time without time zone,
    duree_prevue_min integer,
    statut character varying(20) DEFAULT 'planifie'::character varying,
    ordre_priorite integer DEFAULT 0,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT planning_machines_statut_check CHECK (((statut)::text = ANY (ARRAY[('planifie'::character varying)::text, ('en_cours'::character varying)::text, ('termine'::character varying)::text, ('reporte'::character varying)::text])))
);


--
-- Name: plans_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans_maintenance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    equipement_id uuid,
    type character varying(20) DEFAULT 'preventive'::character varying,
    designation character varying(200) NOT NULL,
    description text,
    frequence character varying(20),
    duree_prevue_min integer,
    responsable_id uuid,
    actif boolean DEFAULT true,
    prochaine_echeance date,
    created_at timestamp with time zone DEFAULT now(),
    periodicite_type character varying(20) DEFAULT 'jours'::character varying,
    periodicite_valeur integer DEFAULT 30,
    duree_estimee_h numeric(5,2) DEFAULT 1,
    technicien_id uuid,
    nb_techniciens integer DEFAULT 1,
    pieces_necessaires jsonb DEFAULT '[]'::jsonb,
    checklist jsonb DEFAULT '[]'::jsonb,
    cout_estime numeric(12,2) DEFAULT 0,
    derniere_realisation date,
    type_maintenance character varying(30) DEFAULT 'preventive'::character varying,
    CONSTRAINT plans_maintenance_frequence_check CHECK (((frequence)::text = ANY (ARRAY[('quotidien'::character varying)::text, ('hebdo'::character varying)::text, ('mensuel'::character varying)::text, ('trimestriel'::character varying)::text, ('semestriel'::character varying)::text, ('annuel'::character varying)::text]))),
    CONSTRAINT plans_maintenance_type_check CHECK (((type)::text = ANY (ARRAY[('preventive'::character varying)::text, ('predictive'::character varying)::text, ('corrective'::character varying)::text])))
);


--
-- Name: postes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postes (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    intitule character varying(200) NOT NULL,
    departement character varying(100),
    niveau character varying(50),
    description text,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: postes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.postes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: postes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.postes_id_seq OWNED BY public.postes.id;


--
-- Name: presences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employe_id uuid,
    date_presence date NOT NULL,
    heure_entree time without time zone,
    heure_sortie time without time zone,
    heures_travaillees numeric(5,2),
    heures_supp numeric(5,2) DEFAULT 0,
    type_presence character varying(20) DEFAULT 'present'::character varying,
    notes text,
    saisi_par uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT presences_type_presence_check CHECK (((type_presence)::text = ANY (ARRAY[('present'::character varying)::text, ('absent'::character varying)::text, ('conge'::character varying)::text, ('maladie'::character varying)::text, ('mission'::character varying)::text, ('ferie'::character varying)::text])))
);


--
-- Name: processus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processus (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(30) NOT NULL,
    titre character varying(200) NOT NULL,
    type character varying(30) DEFAULT 'production'::character varying,
    atelier_id integer,
    proprietaire_id uuid,
    version character varying(10) DEFAULT '1.0'::character varying,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    objectif text,
    description text,
    risques text,
    indicateurs text,
    clause_iso character varying(50),
    points_ccp boolean DEFAULT false,
    resume_ia text,
    derniere_analyse_ia timestamp with time zone,
    date_creation date DEFAULT CURRENT_DATE,
    date_approbation date,
    date_revision date,
    created_at timestamp with time zone DEFAULT now(),
    actif boolean DEFAULT true,
    pilote_id uuid,
    copilote_id uuid,
    type_processus character varying(30) DEFAULT 'realisation'::character varying,
    finalite text,
    normes_applicables jsonb DEFAULT '[]'::jsonb,
    donnees_entree text,
    donnees_sortie text,
    ressources text,
    CONSTRAINT processus_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('en_revue'::character varying)::text, ('approuve'::character varying)::text, ('obsolete'::character varying)::text]))),
    CONSTRAINT processus_type_check CHECK (((type)::text = ANY (ARRAY[('production'::character varying)::text, ('qualite'::character varying)::text, ('maintenance'::character varying)::text, ('securite'::character varying)::text, ('achat'::character varying)::text, ('vente'::character varying)::text, ('rh'::character varying)::text, ('direction'::character varying)::text])))
);


--
-- Name: rapport_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rapport_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rapports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rapports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(30) NOT NULL,
    periode_debut date,
    periode_fin date,
    genere_par uuid,
    pdf_path character varying(255),
    excel_path character varying(255),
    envoye_par_email boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rapports_type_check CHECK (((type)::text = ANY (ARRAY[('hebdo'::character varying)::text, ('mensuel'::character varying)::text, ('of'::character varying)::text])))
);


--
-- Name: rapports_journaliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rapports_journaliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_rapport character varying(30) NOT NULL,
    date_rapport date DEFAULT CURRENT_DATE NOT NULL,
    atelier_id integer,
    shift_id integer,
    chef_atelier_id uuid,
    of_id uuid,
    article_id uuid,
    machine_id integer,
    qte_produite numeric(12,3) DEFAULT 0,
    poids_net_kg numeric(12,4) DEFAULT 0,
    poids_brut_kg numeric(12,4) DEFAULT 0,
    matiere_prevue_kg numeric(12,4) DEFAULT 0,
    matiere_reelle_kg numeric(12,4) DEFAULT 0,
    ecart_matiere_kg numeric(12,4) GENERATED ALWAYS AS ((matiere_reelle_kg - matiere_prevue_kg)) STORED,
    qte_dechets numeric(12,3) DEFAULT 0,
    poids_dechets_kg numeric(12,4) DEFAULT 0,
    motif_dechets character varying(200),
    qte_pertes numeric(12,3) DEFAULT 0,
    poids_pertes_kg numeric(12,4) DEFAULT 0,
    motif_pertes character varying(200),
    qte_rebus numeric(12,3) DEFAULT 0,
    poids_rebus_kg numeric(12,4) DEFAULT 0,
    motif_rebus character varying(200),
    temps_prod_prevu_min integer DEFAULT 0,
    temps_prod_reel_min integer DEFAULT 0,
    temps_arret_min integer DEFAULT 0,
    temps_reglage_min integer DEFAULT 0,
    trs_calcule numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN ((temps_prod_reel_min + temps_arret_min) > 0) THEN round((((temps_prod_reel_min)::numeric / ((temps_prod_reel_min + temps_arret_min))::numeric) * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    taux_rebus_calcule numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (poids_net_kg > (0)::numeric) THEN round((((poids_rebus_kg + poids_dechets_kg) / poids_net_kg) * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    rendement_matiere_pct numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (matiere_reelle_kg > (0)::numeric) THEN round(((poids_net_kg / matiere_reelle_kg) * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    nb_operateurs integer DEFAULT 0,
    heures_travaillees numeric(6,2) DEFAULT 0,
    observations text,
    problemes_rencontres text,
    actions_correctives text,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    valide_par uuid,
    valide_at timestamp with time zone,
    pdf_path character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rapports_journaliers_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('soumis'::character varying)::text, ('valide'::character varying)::text, ('rejete'::character varying)::text])))
);


--
-- Name: receptions_achat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receptions_achat (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    commande_id uuid,
    date_reception date DEFAULT CURRENT_DATE,
    reference_bl character varying(100),
    notes text,
    cree_par uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: releves_energie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.releves_energie (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    equipement_id uuid,
    atelier_id integer,
    date_releve date NOT NULL,
    shift character varying(20) DEFAULT 'journee'::character varying,
    index_debut numeric(12,3) DEFAULT 0,
    index_fin numeric(12,3) DEFAULT 0,
    consommation_kwh numeric(12,3) GENERATED ALWAYS AS ((index_fin - index_debut)) STORED,
    heures_marche numeric(5,2) DEFAULT 0,
    puissance_moyenne_kw numeric(8,3),
    quantite_produite numeric(12,3),
    unite_production character varying(20),
    operateur_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT releves_energie_shift_check CHECK (((shift)::text = ANY (ARRAY[('matin'::character varying)::text, ('apres_midi'::character varying)::text, ('nuit'::character varying)::text, ('journee'::character varying)::text])))
);


--
-- Name: risques_opportunites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risques_opportunites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(20) NOT NULL,
    categorie character varying(30) DEFAULT 'qualite'::character varying,
    titre character varying(255) NOT NULL,
    description text,
    processus_id uuid,
    norme_ref character varying(20),
    probabilite integer DEFAULT 1,
    gravite integer DEFAULT 1,
    detectabilite integer DEFAULT 1,
    criticite integer GENERATED ALWAYS AS ((probabilite * gravite)) STORED,
    ipr integer GENERATED ALWAYS AS (((probabilite * gravite) * detectabilite)) STORED,
    plan_traitement text,
    responsable_id uuid,
    date_echeance date,
    probabilite_residuelle integer DEFAULT 1,
    gravite_residuelle integer DEFAULT 1,
    criticite_residuelle integer,
    statut character varying(20) DEFAULT 'identifie'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT risques_opportunites_categorie_check CHECK (((categorie)::text = ANY (ARRAY[('qualite'::character varying)::text, ('securite'::character varying)::text, ('environnement'::character varying)::text, ('alimentaire'::character varying)::text, ('strategique'::character varying)::text, ('operationnel'::character varying)::text]))),
    CONSTRAINT risques_opportunites_detectabilite_check CHECK (((detectabilite >= 1) AND (detectabilite <= 5))),
    CONSTRAINT risques_opportunites_gravite_check CHECK (((gravite >= 1) AND (gravite <= 5))),
    CONSTRAINT risques_opportunites_probabilite_check CHECK (((probabilite >= 1) AND (probabilite <= 5))),
    CONSTRAINT risques_opportunites_statut_check CHECK (((statut)::text = ANY (ARRAY[('identifie'::character varying)::text, ('en_traitement'::character varying)::text, ('traite'::character varying)::text, ('accepte'::character varying)::text, ('surveille'::character varying)::text]))),
    CONSTRAINT risques_opportunites_type_check CHECK (((type)::text = ANY (ARRAY[('risque'::character varying)::text, ('opportunite'::character varying)::text])))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nom character varying(50) NOT NULL,
    description text
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: seq_bobine_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_bobine_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_cession_at3_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_cession_at3_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_dbm_livraison_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_dbm_livraison_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_dbm_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_dbm_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_demande_achat_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_demande_achat_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_mvt_at3_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_mvt_at3_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_mvt_stock_at3_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_mvt_stock_at3_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_palette_num; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_palette_num
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_ticket_reglage; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seq_ticket_reglage
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions_production (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    of_id uuid,
    operateur_id uuid,
    regleur_id uuid,
    machine_id integer,
    shift_id integer,
    date_session date DEFAULT CURRENT_DATE,
    heure_debut timestamp with time zone,
    heure_fin timestamp with time zone,
    statut character varying(20) DEFAULT 'en_cours'::character varying,
    regleur_valide boolean DEFAULT false,
    regleur_validation_at timestamp with time zone,
    regleur_temperature numeric(6,2),
    regleur_pression numeric(6,2),
    regleur_vitesse numeric(6,2),
    regleur_notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sessions_production_statut_check CHECK (((statut)::text = ANY (ARRAY[('en_cours'::character varying)::text, ('pause'::character varying)::text, ('termine'::character varying)::text])))
);


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    nom character varying(20) NOT NULL,
    heure_debut time without time zone NOT NULL,
    heure_fin time without time zone NOT NULL
);


--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: soldes_conges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.soldes_conges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employe_id uuid,
    annee integer NOT NULL,
    jours_acquis numeric(5,1) DEFAULT 0,
    jours_pris numeric(5,1) DEFAULT 0,
    jours_restants numeric(5,1) GENERATED ALWAYS AS ((jours_acquis - jours_pris)) STORED
);


--
-- Name: sous_familles_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sous_familles_articles (
    id integer NOT NULL,
    famille_id integer,
    code character varying(30) NOT NULL,
    libelle character varying(100) NOT NULL,
    actif boolean DEFAULT true
);


--
-- Name: sous_familles_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sous_familles_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sous_familles_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sous_familles_articles_id_seq OWNED BY public.sous_familles_articles.id;


--
-- Name: stock_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_articles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    article_id uuid,
    emplacement_id integer,
    qte_disponible numeric(15,3) DEFAULT 0,
    qte_reservee numeric(15,3) DEFAULT 0,
    qte_en_commande numeric(15,3) DEFAULT 0,
    valeur_stock numeric(15,4) DEFAULT 0,
    derniere_entree timestamp with time zone,
    derniere_sortie timestamp with time zone
);


--
-- Name: stock_at3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_at3 (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    article_id uuid,
    famille_id integer,
    qte_disponible numeric(12,3) DEFAULT 0,
    qte_reservee numeric(12,3) DEFAULT 0,
    qte_consommee numeric(12,3) DEFAULT 0,
    numero_lot character varying(60),
    date_entree timestamp with time zone DEFAULT now(),
    date_peremption timestamp with time zone,
    dbm_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_produits_finis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_produits_finis (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    article_id uuid,
    of_id uuid,
    controle_id uuid,
    quantite numeric(12,2) NOT NULL,
    poids_total_kg numeric(12,3),
    date_entree timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets_production (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_ticket character varying(30) DEFAULT ('TK-'::text || lpad((nextval('public.ticket_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
    session_id uuid,
    of_id uuid,
    machine_id integer,
    operateur_id uuid,
    poids_brut_kg numeric(8,3) NOT NULL,
    poids_mandrin_kg numeric(6,3) DEFAULT 0,
    poids_net_kg numeric(8,3) NOT NULL,
    poids_dechets_kg numeric(8,3) DEFAULT 0,
    motif_dechet character varying(100),
    qr_code_contenu text NOT NULL,
    imprime boolean DEFAULT false,
    imprime_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    lot_matiere_id uuid,
    type_ticket character varying(20) DEFAULT 'extrusion'::character varying,
    etape_source character varying(20),
    etape_dest character varying(20),
    numero_sequence integer DEFAULT 1,
    qte_pieces integer DEFAULT 0,
    numero_colis character varying(50),
    poids_carton_kg numeric(10,3) DEFAULT 0,
    ticket_parent_id uuid,
    article_id uuid,
    qte_rebuts integer DEFAULT 0,
    poids_rebuts_kg numeric(10,3) DEFAULT 0,
    motif_rebut text,
    client_nom character varying(200),
    zone_actuelle character varying(20) DEFAULT 'AT3-EXT'::character varying,
    valide_par uuid,
    valide_at timestamp with time zone
);


--
-- Name: unites_mesure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unites_mesure (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    libelle character varying(100) NOT NULL,
    type character varying(20) DEFAULT 'masse'::character varying,
    actif boolean DEFAULT true,
    CONSTRAINT unites_mesure_type_check CHECK (((type)::text = ANY (ARRAY[('masse'::character varying)::text, ('volume'::character varying)::text, ('longueur'::character varying)::text, ('surface'::character varying)::text, ('piece'::character varying)::text, ('temps'::character varying)::text])))
);


--
-- Name: unites_mesure_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unites_mesure_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unites_mesure_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unites_mesure_id_seq OWNED BY public.unites_mesure.id;


--
-- Name: utilisateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilisateurs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nom character varying(100) NOT NULL,
    prenom character varying(100) NOT NULL,
    login character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id integer,
    badge_qr character varying(100),
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    matricule character varying(30),
    email character varying(100),
    telephone character varying(50),
    photo_path character varying(255),
    habilitations jsonb DEFAULT '[]'::jsonb,
    formations jsonb DEFAULT '[]'::jsonb,
    derniere_connexion timestamp with time zone,
    role_details jsonb DEFAULT '{}'::jsonb,
    atelier_id integer,
    role character varying(50) DEFAULT 'operateur'::character varying
);


--
-- Name: valeurs_indicateurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valeurs_indicateurs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    indicateur_id uuid,
    periode date NOT NULL,
    valeur numeric(12,4) NOT NULL,
    commentaire text,
    saisi_par uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vente_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ventes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ventes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    numero_vente character varying(50) NOT NULL,
    type_vente character varying(10) DEFAULT 'B2B'::character varying,
    statut character varying(20) DEFAULT 'brouillon'::character varying,
    date_vente timestamp with time zone DEFAULT now(),
    date_livraison_prevue date,
    client_id uuid,
    montant_ht numeric(15,2) DEFAULT 0,
    taux_tva numeric(5,2) DEFAULT 19,
    montant_tva numeric(15,2) DEFAULT 0,
    montant_ttc numeric(15,2) DEFAULT 0,
    montant_remise numeric(15,2) DEFAULT 0,
    mode_paiement character varying(30) DEFAULT 'virement'::character varying,
    montant_paye numeric(15,2) DEFAULT 0,
    solde_restant numeric(15,2) DEFAULT 0,
    reference_client character varying(100),
    notes text,
    cree_par uuid,
    valide_par uuid,
    date_validation timestamp with time zone,
    pdf_path character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ventes_mode_paiement_check CHECK (((mode_paiement)::text = ANY (ARRAY[('especes'::character varying)::text, ('cheque'::character varying)::text, ('virement'::character varying)::text, ('traite'::character varying)::text, ('mixte'::character varying)::text]))),
    CONSTRAINT ventes_statut_check CHECK (((statut)::text = ANY (ARRAY[('brouillon'::character varying)::text, ('confirme'::character varying)::text, ('livre'::character varying)::text, ('facture'::character varying)::text, ('paye'::character varying)::text, ('annule'::character varying)::text]))),
    CONSTRAINT ventes_type_vente_check CHECK (((type_vente)::text = ANY (ARRAY[('B2B'::character varying)::text, ('B2C'::character varying)::text, ('B2G'::character varying)::text])))
);


--
-- Name: vue_bilan_matiere; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_bilan_matiere AS
 SELECT sp.date_session AS date_jour,
    m.code AS machine_code,
    o.numero_of,
    a.designation AS article,
    COALESCE(sum(cm.quantite_kg), (0)::numeric) AS matiere_entree_kg,
    COALESCE(sum(tp.poids_net_kg), (0)::numeric) AS produit_fini_kg,
    COALESCE(sum(tp.poids_dechets_kg), (0)::numeric) AS dechets_kg,
        CASE
            WHEN (COALESCE(sum(cm.quantite_kg), (0)::numeric) > (0)::numeric) THEN round(((sum(tp.poids_net_kg) / sum(cm.quantite_kg)) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS taux_transformation_pct
   FROM (((((public.sessions_production sp
     JOIN public.ordres_fabrication o ON ((o.id = sp.of_id)))
     JOIN public.articles a ON ((a.id = o.article_id)))
     JOIN public.machines m ON ((m.id = sp.machine_id)))
     LEFT JOIN public.consommations_matiere cm ON ((cm.session_id = sp.id)))
     LEFT JOIN public.tickets_production tp ON ((tp.session_id = sp.id)))
  GROUP BY sp.date_session, m.code, o.numero_of, a.designation;


--
-- Name: zones_at3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones_at3 (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    libelle character varying(100) NOT NULL,
    type character varying(30) DEFAULT 'zone'::character varying NOT NULL,
    ordre integer DEFAULT 0,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vue_bobines_at3; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_bobines_at3 AS
 SELECT b.id,
    b.numero_bobine,
    b.numero_lot,
    b.statut,
    b.poids_net_kg,
    b.poids_brut_kg,
    b.created_at,
    o.numero_of,
    o.at3_statut_zone,
    a.code AS article_code,
    a.designation AS article_nom,
    m.code AS machine_code,
    z.code AS zone_code,
    z.libelle AS zone_libelle,
    (((u.nom)::text || ' '::text) || (u.prenom)::text) AS operateur_nom
   FROM (((((public.bobines_production b
     LEFT JOIN public.ordres_fabrication o ON ((o.id = b.of_id)))
     LEFT JOIN public.articles a ON ((a.id = b.article_id)))
     LEFT JOIN public.machines m ON ((m.id = b.machine_id)))
     LEFT JOIN public.zones_at3 z ON ((z.id = b.zone_actuelle_id)))
     LEFT JOIN public.utilisateurs u ON ((u.id = b.operateur_id)));


--
-- Name: vue_conso_mensuelle; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_conso_mensuelle AS
 SELECT date_trunc('month'::text, (r.date_releve)::timestamp with time zone) AS mois,
    e.id AS equipement_id,
    e.code AS equipement_code,
    e.designation AS equipement_designation,
    COALESCE(e.puissance, '—'::character varying) AS puissance_nominale,
    at.libelle AS atelier,
    sum(r.consommation_kwh) AS total_kwh,
    sum(r.heures_marche) AS total_heures,
        CASE
            WHEN (sum(r.heures_marche) > (0)::numeric) THEN (sum(r.consommation_kwh) / sum(r.heures_marche))
            ELSE (0)::numeric
        END AS puissance_moyenne_kw,
    (sum(r.consommation_kwh) * ( SELECT parametres_energie.tarif_kwh
           FROM public.parametres_energie
         LIMIT 1)) AS cout_fcfa,
    count(*) AS nb_releves
   FROM ((public.releves_energie r
     JOIN public.equipements e ON ((e.id = r.equipement_id)))
     LEFT JOIN public.ateliers at ON ((at.id = e.atelier_id)))
  GROUP BY (date_trunc('month'::text, (r.date_releve)::timestamp with time zone)), e.id, e.code, e.designation, e.puissance, at.libelle
  ORDER BY (date_trunc('month'::text, (r.date_releve)::timestamp with time zone)) DESC, (sum(r.consommation_kwh)) DESC;


--
-- Name: vue_dbm; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_dbm AS
SELECT
    NULL::uuid AS id,
    NULL::character varying(60) AS numero_dbm,
    NULL::uuid AS of_id,
    NULL::integer AS atelier_id,
    NULL::integer AS magasin_id,
    NULL::character varying(20) AS statut,
    NULL::boolean AS urgence,
    NULL::date AS date_besoin,
    NULL::uuid AS demandeur_id,
    NULL::uuid AS approuve_par,
    NULL::uuid AS livre_par,
    NULL::timestamp with time zone AS date_demande,
    NULL::timestamp with time zone AS date_approbation,
    NULL::timestamp with time zone AS date_livraison,
    NULL::text AS notes_demandeur,
    NULL::text AS notes_magasin,
    NULL::timestamp with time zone AS created_at,
    NULL::character varying(50) AS numero_of,
    NULL::character varying(100) AS atelier_libelle,
    NULL::character varying(100) AS magasin_libelle,
    NULL::text AS demandeur_nom,
    NULL::bigint AS nb_lignes,
    NULL::numeric AS poids_total_demande,
    NULL::numeric AS poids_total_livre;


--
-- Name: vue_disponibilite_equipements; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_disponibilite_equipements AS
 SELECT e.id,
    e.code,
    e.designation,
    e.statut,
    e.criticite,
    at.libelle AS atelier,
    COALESCE(e.compteur_heures, (0)::numeric) AS heures_fonctionnement,
    ( SELECT count(*) AS count
           FROM public.ordres_travail ot
          WHERE ((ot.equipement_id = e.id) AND ((ot.statut)::text = 'termine'::text))) AS nb_interventions,
    ( SELECT COALESCE(sum(ot.duree_arret_h), (0)::numeric) AS "coalesce"
           FROM public.ordres_travail ot
          WHERE ((ot.equipement_id = e.id) AND (ot.arret_machine = true))) AS total_heures_arret,
    ( SELECT COALESCE(avg(hp.duree_arret_h), (0)::numeric) AS "coalesce"
           FROM public.historique_pannes hp
          WHERE (hp.equipement_id = e.id)) AS mttr_moyen,
    ( SELECT max(hp.date_panne) AS max
           FROM public.historique_pannes hp
          WHERE (hp.equipement_id = e.id)) AS derniere_panne,
    ( SELECT min(pm.prochaine_echeance) AS min
           FROM public.plans_maintenance pm
          WHERE ((pm.equipement_id = e.id) AND (pm.actif = true))) AS prochaine_maintenance
   FROM (public.equipements e
     LEFT JOIN public.ateliers at ON ((at.id = e.atelier_id)))
  WHERE (e.actif = true)
  ORDER BY e.criticite DESC, e.designation;


--
-- Name: vue_effectifs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_effectifs AS
 SELECT e.id,
    e.matricule,
    e.nom,
    e.prenom,
    e.statut,
    e.date_embauche,
    e.sexe,
    p.intitule AS poste,
    p.departement,
    at.libelle AS atelier,
    c.type_contrat,
    c.salaire_base,
    c.date_fin AS fin_contrat,
    sc.jours_restants AS solde_conges,
    (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (e.date_embauche)::timestamp with time zone)))::integer AS anciennete_ans
   FROM ((((public.employes e
     LEFT JOIN public.postes p ON ((p.id = e.poste_id)))
     LEFT JOIN public.ateliers at ON ((at.id = e.atelier_id)))
     LEFT JOIN public.contrats c ON (((c.employe_id = e.id) AND ((c.statut)::text = 'actif'::text))))
     LEFT JOIN public.soldes_conges sc ON (((sc.employe_id = e.id) AND ((sc.annee)::numeric = EXTRACT(year FROM now())))))
  WHERE (e.actif = true);


--
-- Name: vue_flux_at3; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_flux_at3 AS
 SELECT o.id AS of_id,
    o.numero_of,
    o.at3_statut_zone,
    o.at3_composition_validee,
    o.at3_poids_cible_kg,
    a.code AS article_code,
    a.designation AS article_nom,
    o.quantite_cible AS quantite,
    count(DISTINCT b.id) AS nb_bobines_total,
    count(DISTINCT b.id) FILTER (WHERE ((b.statut)::text = 'quarantaine'::text)) AS nb_bobines_quar,
    count(DISTINCT b.id) FILTER (WHERE ((b.statut)::text = 'impression'::text)) AS nb_bobines_impr,
    count(DISTINCT b.id) FILTER (WHERE ((b.statut)::text = 'emballage'::text)) AS nb_bobines_embl,
    count(DISTINCT b.id) FILTER (WHERE ((b.statut)::text = 'stock_at3'::text)) AS nb_bobines_stock,
    COALESCE(sum(b.poids_net_kg), (0)::numeric) AS poids_produit_kg,
    count(DISTINCT p.id) AS nb_palettes,
    COALESCE(sum(p.nb_sacs), (0)::bigint) AS nb_sacs_total
   FROM (((public.ordres_fabrication o
     LEFT JOIN public.articles a ON ((a.id = o.article_id)))
     LEFT JOIN public.bobines_production b ON ((b.of_id = o.id)))
     LEFT JOIN public.palettes_emballage p ON ((p.of_id = o.id)))
  WHERE ((o.statut)::text <> ALL (ARRAY[('annule'::character varying)::text, ('archive'::character varying)::text]))
  GROUP BY o.id, o.numero_of, o.at3_statut_zone, o.at3_composition_validee, o.at3_poids_cible_kg, o.quantite_cible, a.code, a.designation;


--
-- Name: vue_gmao_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_gmao_dashboard AS
 SELECT ( SELECT count(*) AS count
           FROM public.equipements
          WHERE ((equipements.actif = true) AND ((equipements.statut)::text = 'en_service'::text))) AS equipements_en_service,
    ( SELECT count(*) AS count
           FROM public.equipements
          WHERE ((equipements.actif = true) AND ((equipements.statut)::text = 'en_panne'::text))) AS equipements_en_panne,
    ( SELECT count(*) AS count
           FROM public.equipements
          WHERE ((equipements.actif = true) AND ((equipements.statut)::text = 'en_maintenance'::text))) AS equipements_maintenance,
    ( SELECT count(*) AS count
           FROM public.ordres_travail
          WHERE ((ordres_travail.statut)::text = ANY (ARRAY[('ouvert'::character varying)::text, ('planifie'::character varying)::text, ('en_cours'::character varying)::text]))) AS ot_ouverts,
    ( SELECT count(*) AS count
           FROM public.ordres_travail
          WHERE (((ordres_travail.statut)::text = 'urgence'::text) OR (((ordres_travail.type_ot)::text = 'urgence'::text) AND ((ordres_travail.statut)::text <> ALL (ARRAY[('termine'::character varying)::text, ('annule'::character varying)::text]))))) AS ot_urgents,
    ( SELECT count(*) AS count
           FROM public.ordres_travail
          WHERE ((ordres_travail.statut)::text = 'en_attente_pieces'::text)) AS ot_attente_pieces,
    ( SELECT count(*) AS count
           FROM public.plans_maintenance
          WHERE ((plans_maintenance.actif = true) AND (plans_maintenance.prochaine_echeance <= (CURRENT_DATE + '7 days'::interval)))) AS maintenances_a_planifier,
    ( SELECT count(*) AS count
           FROM public.pieces_detachees
          WHERE ((pieces_detachees.qte_stock <= pieces_detachees.qte_minimum) AND (pieces_detachees.actif = true))) AS pieces_en_alerte,
    ( SELECT COALESCE(sum(ordres_travail.cout_total), (0)::numeric) AS "coalesce"
           FROM public.ordres_travail
          WHERE ((EXTRACT(year FROM ordres_travail.created_at) = EXTRACT(year FROM now())) AND ((ordres_travail.statut)::text = 'termine'::text))) AS cout_maintenance_annee;


--
-- Name: vue_mouvements; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_mouvements AS
SELECT
    NULL::uuid AS id,
    NULL::character varying(30) AS numero_bon,
    NULL::character varying(30) AS type_mouvement,
    NULL::character varying(20) AS statut,
    NULL::date AS date_mouvement,
    NULL::timestamp with time zone AS created_at,
    NULL::text AS notes,
    NULL::integer AS atelier_source_id,
    NULL::integer AS atelier_dest_id,
    NULL::uuid AS cree_par,
    NULL::uuid AS valide_par,
    NULL::character varying(255) AS pdf_path,
    NULL::uuid AS of_id,
    NULL::character varying(20) AS source_code,
    NULL::character varying(100) AS source_libelle,
    NULL::character varying(20) AS dest_code,
    NULL::character varying(100) AS dest_libelle,
    NULL::bigint AS nb_lignes,
    NULL::numeric AS poids_total_kg,
    NULL::numeric AS montant_total;


--
-- Name: vue_planning_jour; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_planning_jour AS
 SELECT pm.id,
    pm.date_planifiee,
    pm.heure_debut_prevue,
    pm.heure_fin_prevue,
    pm.duree_prevue_min,
    pm.statut AS statut_planning,
    pm.ordre_priorite,
    m.code AS machine_code,
    m.nom AS machine_nom,
    m.type AS machine_type,
    sh.nom AS shift_nom,
    o.numero_of,
    o.statut AS statut_of,
    o.quantite_cible,
    o.quantite_produite,
    round(((o.quantite_produite / NULLIF(o.quantite_cible, (0)::numeric)) * (100)::numeric), 1) AS avancement_pct,
    c.nom AS client_nom,
    a.designation AS article_nom,
    a.dimensions,
    a.couleur,
    o.date_livraison_prevue
   FROM (((((public.planning_machines pm
     JOIN public.machines m ON ((m.id = pm.machine_id)))
     JOIN public.shifts sh ON ((sh.id = pm.shift_id)))
     JOIN public.ordres_fabrication o ON ((o.id = pm.of_id)))
     LEFT JOIN public.clients c ON ((c.id = o.client_id)))
     LEFT JOIN public.articles a ON ((a.id = o.article_id)));


--
-- Name: vue_qhse_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_qhse_dashboard AS
 SELECT ( SELECT count(*) AS count
           FROM public.non_conformites
          WHERE ((non_conformites.statut)::text <> 'clos'::text)) AS nc_ouvertes,
    ( SELECT count(*) AS count
           FROM public.non_conformites
          WHERE (((non_conformites.gravite)::text = 'critique'::text) AND ((non_conformites.statut)::text <> 'clos'::text))) AS nc_critiques,
    ( SELECT count(*) AS count
           FROM public.audits
          WHERE (((audits.statut)::text = 'planifie'::text) AND (COALESCE(audits.date_planifiee, audits.date_audit) >= CURRENT_DATE))) AS audits_planifies,
    ( SELECT count(*) AS count
           FROM public.risques_opportunites
          WHERE ((risques_opportunites.criticite >= 12) AND ((risques_opportunites.statut)::text <> 'traite'::text))) AS risques_eleves,
    ( SELECT count(*) AS count
           FROM public.habilitations
          WHERE ((habilitations.date_expiration <= (CURRENT_DATE + '30 days'::interval)) AND ((habilitations.statut)::text = 'valide'::text))) AS habilitations_expiration,
    ( SELECT count(*) AS count
           FROM public.accidents_incidents
          WHERE (EXTRACT(year FROM accidents_incidents.date_accident) = EXTRACT(year FROM now()))) AS accidents_annee,
    ( SELECT count(*) AS count
           FROM public.documents_qhse
          WHERE ((documents_qhse.date_prochaine_revision <= (CURRENT_DATE + '30 days'::interval)) AND ((documents_qhse.statut)::text = 'approuve'::text))) AS docs_revision,
    ( SELECT count(*) AS count
           FROM public.processus
          WHERE (processus.actif = true)) AS nb_processus;


--
-- Name: vue_rapports_journaliers; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_rapports_journaliers AS
 SELECT rj.id,
    rj.numero_rapport,
    rj.date_rapport,
    rj.atelier_id,
    rj.shift_id,
    rj.chef_atelier_id,
    rj.of_id,
    rj.article_id,
    rj.machine_id,
    rj.qte_produite,
    rj.poids_net_kg,
    rj.poids_brut_kg,
    rj.matiere_prevue_kg,
    rj.matiere_reelle_kg,
    rj.ecart_matiere_kg,
    rj.qte_dechets,
    rj.poids_dechets_kg,
    rj.motif_dechets,
    rj.qte_pertes,
    rj.poids_pertes_kg,
    rj.motif_pertes,
    rj.qte_rebus,
    rj.poids_rebus_kg,
    rj.motif_rebus,
    rj.temps_prod_prevu_min,
    rj.temps_prod_reel_min,
    rj.temps_arret_min,
    rj.temps_reglage_min,
    rj.trs_calcule,
    rj.taux_rebus_calcule,
    rj.rendement_matiere_pct,
    rj.nb_operateurs,
    rj.heures_travaillees,
    rj.observations,
    rj.problemes_rencontres,
    rj.actions_correctives,
    rj.statut,
    rj.valide_par,
    rj.valide_at,
    rj.pdf_path,
    rj.created_at,
    at.libelle AS atelier_nom,
    a.code AS article_code,
    a.designation AS article_nom,
    o.numero_of
   FROM (((public.rapports_journaliers rj
     LEFT JOIN public.ateliers at ON ((at.id = rj.atelier_id)))
     LEFT JOIN public.articles a ON ((a.id = rj.article_id)))
     LEFT JOIN public.ordres_fabrication o ON ((o.id = rj.of_id)));


--
-- Name: vue_rh_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_rh_dashboard AS
 SELECT ( SELECT count(*) AS count
           FROM public.employes
          WHERE ((employes.actif = true) AND ((employes.statut)::text = 'actif'::text))) AS nb_employes,
    ( SELECT count(*) AS count
           FROM public.employes
          WHERE ((employes.actif = true) AND ((employes.sexe)::text = 'M'::text))) AS nb_hommes,
    ( SELECT count(*) AS count
           FROM public.employes
          WHERE ((employes.actif = true) AND ((employes.sexe)::text = 'F'::text))) AS nb_femmes,
    ( SELECT count(*) AS count
           FROM public.contrats
          WHERE (((contrats.statut)::text = 'actif'::text) AND ((contrats.type_contrat)::text = 'CDI'::text))) AS nb_cdi,
    ( SELECT count(*) AS count
           FROM public.contrats
          WHERE (((contrats.statut)::text = 'actif'::text) AND ((contrats.type_contrat)::text = 'CDD'::text))) AS nb_cdd,
    ( SELECT count(*) AS count
           FROM public.conges
          WHERE ((conges.statut)::text = 'en_attente'::text)) AS conges_en_attente,
    ( SELECT count(*) AS count
           FROM public.contrats
          WHERE ((contrats.date_fin <= (CURRENT_DATE + '30 days'::interval)) AND ((contrats.statut)::text = 'actif'::text))) AS contrats_expiration,
    ( SELECT COALESCE(sum(bulletins_paie.salaire_net), (0)::numeric) AS "coalesce"
           FROM public.bulletins_paie
          WHERE ((bulletins_paie.periode = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)) AND ((bulletins_paie.statut)::text = 'paye'::text))) AS masse_salariale_mois;


--
-- Name: vue_stock_at3; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_stock_at3 AS
 SELECT a.id AS article_id,
    a.code AS article_code,
    a.designation AS article_nom,
    count(p.id) AS nb_palettes,
    sum(p.nb_sacs) AS nb_sacs_total,
    sum(p.poids_sacs_kg) AS poids_net_total_kg,
    o.numero_of
   FROM ((public.palettes_emballage p
     JOIN public.articles a ON ((a.id = p.article_id)))
     JOIN public.ordres_fabrication o ON ((o.id = p.of_id)))
  WHERE ((p.statut)::text = 'stock_at3'::text)
  GROUP BY a.id, a.code, a.designation, o.numero_of;


--
-- Name: vue_stock_at3_consolidé; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public."vue_stock_at3_consolidé" AS
 SELECT a.id AS article_id,
    a.code,
    a.designation,
    a.type_article,
    f.libelle AS famille_libelle,
    f.code AS famille_code,
    COALESCE(sum(s.qte_disponible), (0)::numeric) AS qte_disponible,
    COALESCE(sum(s.qte_reservee), (0)::numeric) AS qte_reservee,
    COALESCE(sum(s.qte_consommee), (0)::numeric) AS qte_consommee
   FROM ((public.articles a
     LEFT JOIN public.familles_articles f ON ((f.id = a.famille_id)))
     LEFT JOIN public.stock_at3 s ON ((s.article_id = a.id)))
  WHERE ((a.type_article)::text = 'matiere_premiere'::text)
  GROUP BY a.id, a.code, a.designation, a.type_article, f.libelle, f.code;


--
-- Name: vue_stock_par_atelier; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_stock_par_atelier AS
 SELECT at.code AS atelier_code,
    at.libelle AS atelier_libelle,
    e.code AS emplacement_code,
    e.libelle AS emplacement_libelle,
    e.type AS emplacement_type,
    a.code AS article_code,
    a.designation,
    a.type_article,
    um.code AS unite,
    COALESCE(sa.qte_disponible, (0)::numeric) AS qte_disponible,
    COALESCE(sa.qte_reservee, (0)::numeric) AS qte_reservee,
    COALESCE(sa.valeur_stock, (0)::numeric) AS valeur_stock,
        CASE
            WHEN ((COALESCE(sa.qte_disponible, (0)::numeric) <= COALESCE(a.stock_mini, (0)::numeric)) AND (COALESCE(a.stock_mini, (0)::numeric) > (0)::numeric)) THEN true
            ELSE false
        END AS alerte_stock_bas,
    sa.derniere_entree,
    sa.derniere_sortie
   FROM ((((public.stock_articles sa
     JOIN public.articles a ON ((a.id = sa.article_id)))
     JOIN public.emplacements_stock e ON ((e.id = sa.emplacement_id)))
     LEFT JOIN public.ateliers at ON ((at.id = e.atelier_id)))
     LEFT JOIN public.unites_mesure um ON ((um.id = a.unite_mesure_id)))
  WHERE ((a.actif = true) AND (e.actif = true))
  ORDER BY at.code, e.code, a.type_article, a.code;


--
-- Name: vue_trs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_trs AS
 SELECT sp.machine_id,
    m.code AS machine_code,
    m.nom AS machine_nom,
    sp.date_session,
    sp.shift_id,
    sh.nom AS shift_nom,
    480 AS temps_total_min,
    COALESCE(sum(ar.duree_min), (0)::bigint) AS temps_arret_min,
    (480 - COALESCE(sum(ar.duree_min), (0)::bigint)) AS temps_prod_min,
    round(((((480 - COALESCE(sum(ar.duree_min), (0)::bigint)))::numeric / (480)::numeric) * (100)::numeric), 2) AS trs_pct,
    COALESCE(sum(tp.poids_net_kg), (0)::numeric) AS poids_net_total_kg,
    COALESCE(sum(tp.poids_dechets_kg), (0)::numeric) AS poids_dechets_kg,
        CASE
            WHEN (COALESCE(sum(tp.poids_net_kg), (0)::numeric) > (0)::numeric) THEN round(((sum(tp.poids_dechets_kg) / sum(tp.poids_net_kg)) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS taux_rebus_pct
   FROM ((((public.sessions_production sp
     JOIN public.machines m ON ((m.id = sp.machine_id)))
     JOIN public.shifts sh ON ((sh.id = sp.shift_id)))
     LEFT JOIN public."arrêts_machine" ar ON (((ar.session_id = sp.id) AND ((ar.statut)::text = 'clos'::text))))
     LEFT JOIN public.tickets_production tp ON ((tp.session_id = sp.id)))
  GROUP BY sp.machine_id, m.code, m.nom, sp.date_session, sp.shift_id, sh.nom;


--
-- Name: zones_at3_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zones_at3_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zones_at3_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zones_at3_id_seq OWNED BY public.zones_at3.id;


--
-- Name: ateliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ateliers ALTER COLUMN id SET DEFAULT nextval('public.ateliers_id_seq'::regclass);


--
-- Name: categories_articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories_articles ALTER COLUMN id SET DEFAULT nextval('public.categories_articles_id_seq'::regclass);


--
-- Name: composition_article id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_article ALTER COLUMN id SET DEFAULT nextval('public.composition_article_id_seq'::regclass);


--
-- Name: config_alertes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_alertes ALTER COLUMN id SET DEFAULT nextval('public.config_alertes_id_seq'::regclass);


--
-- Name: emplacements_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emplacements_stock ALTER COLUMN id SET DEFAULT nextval('public.emplacements_stock_id_seq'::regclass);


--
-- Name: familles_articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.familles_articles ALTER COLUMN id SET DEFAULT nextval('public.familles_articles_id_seq'::regclass);


--
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- Name: normes_qhse id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.normes_qhse ALTER COLUMN id SET DEFAULT nextval('public.normes_qhse_id_seq'::regclass);


--
-- Name: objectifs_production id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectifs_production ALTER COLUMN id SET DEFAULT nextval('public.objectifs_production_id_seq'::regclass);


--
-- Name: parametres_energie id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametres_energie ALTER COLUMN id SET DEFAULT nextval('public.parametres_energie_id_seq'::regclass);


--
-- Name: permissions_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions_roles ALTER COLUMN id SET DEFAULT nextval('public.permissions_roles_id_seq'::regclass);


--
-- Name: postes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postes ALTER COLUMN id SET DEFAULT nextval('public.postes_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: sous_familles_articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sous_familles_articles ALTER COLUMN id SET DEFAULT nextval('public.sous_familles_articles_id_seq'::regclass);


--
-- Name: unites_mesure id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unites_mesure ALTER COLUMN id SET DEFAULT nextval('public.unites_mesure_id_seq'::regclass);


--
-- Name: zones_at3 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones_at3 ALTER COLUMN id SET DEFAULT nextval('public.zones_at3_id_seq'::regclass);


--
-- Name: accidents_incidents accidents_incidents_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accidents_incidents
    ADD CONSTRAINT accidents_incidents_numero_key UNIQUE (numero);


--
-- Name: accidents_incidents accidents_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accidents_incidents
    ADD CONSTRAINT accidents_incidents_pkey PRIMARY KEY (id);


--
-- Name: alertes alertes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes
    ADD CONSTRAINT alertes_pkey PRIMARY KEY (id);


--
-- Name: arrêts_machine arrêts_machine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."arrêts_machine"
    ADD CONSTRAINT "arrêts_machine_pkey" PRIMARY KEY (id);


--
-- Name: articles articles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_code_key UNIQUE (code);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: articles articles_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_reference_key UNIQUE (code);


--
-- Name: aspects_environnementaux aspects_environnementaux_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aspects_environnementaux
    ADD CONSTRAINT aspects_environnementaux_pkey PRIMARY KEY (id);


--
-- Name: ateliers ateliers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ateliers
    ADD CONSTRAINT ateliers_code_key UNIQUE (code);


--
-- Name: ateliers ateliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ateliers
    ADD CONSTRAINT ateliers_pkey PRIMARY KEY (id);


--
-- Name: audit_constats audit_constats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_constats
    ADD CONSTRAINT audit_constats_pkey PRIMARY KEY (id);


--
-- Name: audits audits_numero_audit_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
    ADD CONSTRAINT audits_numero_audit_key UNIQUE (numero_audit);


--
-- Name: audits audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
    ADD CONSTRAINT audits_pkey PRIMARY KEY (id);


--
-- Name: bc_lignes bc_lignes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lignes
    ADD CONSTRAINT bc_lignes_pkey PRIMARY KEY (id);


--
-- Name: bobines_production bobines_production_numero_bobine_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bobines_production
    ADD CONSTRAINT bobines_production_numero_bobine_key UNIQUE (numero_bobine);


--
-- Name: bobines_production bobines_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bobines_production
    ADD CONSTRAINT bobines_production_pkey PRIMARY KEY (id);


--
-- Name: bons_commande bons_commande_numero_bc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bons_commande
    ADD CONSTRAINT bons_commande_numero_bc_key UNIQUE (numero_bc);


--
-- Name: bons_commande bons_commande_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bons_commande
    ADD CONSTRAINT bons_commande_pkey PRIMARY KEY (id);


--
-- Name: bulletins_paie bulletins_paie_employe_id_periode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletins_paie
    ADD CONSTRAINT bulletins_paie_employe_id_periode_key UNIQUE (employe_id, periode);


--
-- Name: bulletins_paie bulletins_paie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletins_paie
    ADD CONSTRAINT bulletins_paie_pkey PRIMARY KEY (id);


--
-- Name: categories_articles categories_articles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories_articles
    ADD CONSTRAINT categories_articles_code_key UNIQUE (code);


--
-- Name: categories_articles categories_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories_articles
    ADD CONSTRAINT categories_articles_pkey PRIMARY KEY (id);


--
-- Name: cessions_at3 cessions_at3_numero_cession_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cessions_at3
    ADD CONSTRAINT cessions_at3_numero_cession_key UNIQUE (numero_cession);


--
-- Name: cessions_at3 cessions_at3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cessions_at3
    ADD CONSTRAINT cessions_at3_pkey PRIMARY KEY (id);


--
-- Name: clients clients_code_sage_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_code_sage_key UNIQUE (code_sage);


--
-- Name: clients_complet clients_complet_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients_complet
    ADD CONSTRAINT clients_complet_code_key UNIQUE (code);


--
-- Name: clients_complet clients_complet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients_complet
    ADD CONSTRAINT clients_complet_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: commandes_achat commandes_achat_numero_commande_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes_achat
    ADD CONSTRAINT commandes_achat_numero_commande_key UNIQUE (numero_commande);


--
-- Name: commandes_achat commandes_achat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes_achat
    ADD CONSTRAINT commandes_achat_pkey PRIMARY KEY (id);


--
-- Name: composition_article composition_article_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_article
    ADD CONSTRAINT composition_article_pkey PRIMARY KEY (id);


--
-- Name: config_alertes config_alertes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_alertes
    ADD CONSTRAINT config_alertes_pkey PRIMARY KEY (id);


--
-- Name: conges conges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conges
    ADD CONSTRAINT conges_pkey PRIMARY KEY (id);


--
-- Name: consommations_matiere consommations_matiere_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consommations_matiere
    ADD CONSTRAINT consommations_matiere_pkey PRIMARY KEY (id);


--
-- Name: contrats contrats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contrats
    ADD CONSTRAINT contrats_pkey PRIMARY KEY (id);


--
-- Name: controles_impression controles_impression_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_impression
    ADD CONSTRAINT controles_impression_pkey PRIMARY KEY (id);


--
-- Name: controles_qualite controles_qualite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_qualite
    ADD CONSTRAINT controles_qualite_pkey PRIMARY KEY (id);


--
-- Name: dbm_lignes dbm_lignes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_lignes
    ADD CONSTRAINT dbm_lignes_pkey PRIMARY KEY (id);


--
-- Name: dbm_livraisons dbm_livraisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_livraisons
    ADD CONSTRAINT dbm_livraisons_pkey PRIMARY KEY (id);


--
-- Name: dbm dbm_numero_dbm_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_numero_dbm_key UNIQUE (numero_dbm);


--
-- Name: dbm dbm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_pkey PRIMARY KEY (id);


--
-- Name: declaration_lignes_mp declaration_lignes_mp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declaration_lignes_mp
    ADD CONSTRAINT declaration_lignes_mp_pkey PRIMARY KEY (id);


--
-- Name: declarations_production declarations_production_numero_decl_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declarations_production
    ADD CONSTRAINT declarations_production_numero_decl_key UNIQUE (numero_decl);


--
-- Name: declarations_production declarations_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declarations_production
    ADD CONSTRAINT declarations_production_pkey PRIMARY KEY (id);


--
-- Name: demandes_achat demandes_achat_numero_demande_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_achat
    ADD CONSTRAINT demandes_achat_numero_demande_key UNIQUE (numero_demande);


--
-- Name: demandes_achat demandes_achat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_achat
    ADD CONSTRAINT demandes_achat_pkey PRIMARY KEY (id);


--
-- Name: demandes_fabrication demandes_fabrication_numero_df_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_numero_df_key UNIQUE (numero_df);


--
-- Name: demandes_fabrication demandes_fabrication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_pkey PRIMARY KEY (id);


--
-- Name: devis_lignes devis_lignes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis_lignes
    ADD CONSTRAINT devis_lignes_pkey PRIMARY KEY (id);


--
-- Name: devis devis_numero_devis_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis
    ADD CONSTRAINT devis_numero_devis_key UNIQUE (numero_devis);


--
-- Name: devis devis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis
    ADD CONSTRAINT devis_pkey PRIMARY KEY (id);


--
-- Name: documents_processus documents_processus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_processus
    ADD CONSTRAINT documents_processus_pkey PRIMARY KEY (id);


--
-- Name: documents_qhse documents_qhse_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_qhse
    ADD CONSTRAINT documents_qhse_code_key UNIQUE (code);


--
-- Name: documents_qhse documents_qhse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_qhse
    ADD CONSTRAINT documents_qhse_pkey PRIMARY KEY (id);


--
-- Name: ecarts_audit ecarts_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecarts_audit
    ADD CONSTRAINT ecarts_audit_pkey PRIMARY KEY (id);


--
-- Name: emplacements_stock emplacements_stock_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emplacements_stock
    ADD CONSTRAINT emplacements_stock_code_key UNIQUE (code);


--
-- Name: emplacements_stock emplacements_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emplacements_stock
    ADD CONSTRAINT emplacements_stock_pkey PRIMARY KEY (id);


--
-- Name: employes employes_matricule_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employes
    ADD CONSTRAINT employes_matricule_key UNIQUE (matricule);


--
-- Name: employes employes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employes
    ADD CONSTRAINT employes_pkey PRIMARY KEY (id);


--
-- Name: equipements equipements_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipements
    ADD CONSTRAINT equipements_code_key UNIQUE (code);


--
-- Name: equipements equipements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipements
    ADD CONSTRAINT equipements_pkey PRIMARY KEY (id);


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_pkey PRIMARY KEY (id);


--
-- Name: familles_articles familles_articles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.familles_articles
    ADD CONSTRAINT familles_articles_code_key UNIQUE (code);


--
-- Name: familles_articles familles_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.familles_articles
    ADD CONSTRAINT familles_articles_pkey PRIMARY KEY (id);


--
-- Name: formations formations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formations
    ADD CONSTRAINT formations_pkey PRIMARY KEY (id);


--
-- Name: fournisseurs fournisseurs_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fournisseurs
    ADD CONSTRAINT fournisseurs_code_key UNIQUE (code);


--
-- Name: fournisseurs fournisseurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fournisseurs
    ADD CONSTRAINT fournisseurs_pkey PRIMARY KEY (id);


--
-- Name: habilitations habilitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habilitations
    ADD CONSTRAINT habilitations_pkey PRIMARY KEY (id);


--
-- Name: historique_pannes historique_pannes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_pannes
    ADD CONSTRAINT historique_pannes_pkey PRIMARY KEY (id);


--
-- Name: ia_conversations ia_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ia_conversations
    ADD CONSTRAINT ia_conversations_pkey PRIMARY KEY (id);


--
-- Name: ia_suggestions ia_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ia_suggestions
    ADD CONSTRAINT ia_suggestions_pkey PRIMARY KEY (id);


--
-- Name: imports_sage imports_sage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imports_sage
    ADD CONSTRAINT imports_sage_pkey PRIMARY KEY (id);


--
-- Name: incidents_securite incidents_securite_numero_incident_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents_securite
    ADD CONSTRAINT incidents_securite_numero_incident_key UNIQUE (numero_incident);


--
-- Name: incidents_securite incidents_securite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents_securite
    ADD CONSTRAINT incidents_securite_pkey PRIMARY KEY (id);


--
-- Name: indicateurs_qhse indicateurs_qhse_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicateurs_qhse
    ADD CONSTRAINT indicateurs_qhse_code_key UNIQUE (code);


--
-- Name: indicateurs_qhse indicateurs_qhse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicateurs_qhse
    ADD CONSTRAINT indicateurs_qhse_pkey PRIMARY KEY (id);


--
-- Name: interactions_processus interactions_processus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions_processus
    ADD CONSTRAINT interactions_processus_pkey PRIMARY KEY (id);


--
-- Name: interactions_processus interactions_processus_processus_source_id_processus_dest_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions_processus
    ADD CONSTRAINT interactions_processus_processus_source_id_processus_dest_i_key UNIQUE (processus_source_id, processus_dest_id);


--
-- Name: interventions_externes interventions_externes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interventions_externes
    ADD CONSTRAINT interventions_externes_pkey PRIMARY KEY (id);


--
-- Name: journal_stock journal_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_stock
    ADD CONSTRAINT journal_stock_pkey PRIMARY KEY (id);


--
-- Name: lignes_achat lignes_achat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_achat
    ADD CONSTRAINT lignes_achat_pkey PRIMARY KEY (id);


--
-- Name: lignes_demande_achat lignes_demande_achat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_demande_achat
    ADD CONSTRAINT lignes_demande_achat_pkey PRIMARY KEY (id);


--
-- Name: lignes_mouvement lignes_mouvement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_mouvement
    ADD CONSTRAINT lignes_mouvement_pkey PRIMARY KEY (id);


--
-- Name: lignes_reception_achat lignes_reception_achat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_reception_achat
    ADD CONSTRAINT lignes_reception_achat_pkey PRIMARY KEY (id);


--
-- Name: lignes_vente lignes_vente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_vente
    ADD CONSTRAINT lignes_vente_pkey PRIMARY KEY (id);


--
-- Name: logs_activite logs_activite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_activite
    ADD CONSTRAINT logs_activite_pkey PRIMARY KEY (id);


--
-- Name: lots_matiere lots_matiere_numero_lot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_matiere
    ADD CONSTRAINT lots_matiere_numero_lot_key UNIQUE (numero_lot);


--
-- Name: lots_matiere lots_matiere_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_matiere
    ADD CONSTRAINT lots_matiere_pkey PRIMARY KEY (id);


--
-- Name: lots_stock lots_stock_numero_lot_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_stock
    ADD CONSTRAINT lots_stock_numero_lot_unique UNIQUE (numero_lot);


--
-- Name: lots_stock lots_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_stock
    ADD CONSTRAINT lots_stock_pkey PRIMARY KEY (id);


--
-- Name: machines machines_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_code_key UNIQUE (code);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: matieres_premieres matieres_premieres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matieres_premieres
    ADD CONSTRAINT matieres_premieres_pkey PRIMARY KEY (id);


--
-- Name: mouvements_at3 mouvements_at3_numero_ticket_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_at3
    ADD CONSTRAINT mouvements_at3_numero_ticket_key UNIQUE (numero_ticket);


--
-- Name: mouvements_at3 mouvements_at3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_at3
    ADD CONSTRAINT mouvements_at3_pkey PRIMARY KEY (id);


--
-- Name: mouvements_stock_at3 mouvements_stock_at3_numero_mvt_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock_at3
    ADD CONSTRAINT mouvements_stock_at3_numero_mvt_key UNIQUE (numero_mvt);


--
-- Name: mouvements_stock_at3 mouvements_stock_at3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock_at3
    ADD CONSTRAINT mouvements_stock_at3_pkey PRIMARY KEY (id);


--
-- Name: mouvements_stock mouvements_stock_numero_bon_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock
    ADD CONSTRAINT mouvements_stock_numero_bon_key UNIQUE (numero_bon);


--
-- Name: mouvements_stock mouvements_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock
    ADD CONSTRAINT mouvements_stock_pkey PRIMARY KEY (id);


--
-- Name: non_conformites non_conformites_numero_nc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_conformites
    ADD CONSTRAINT non_conformites_numero_nc_key UNIQUE (numero_nc);


--
-- Name: non_conformites non_conformites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_conformites
    ADD CONSTRAINT non_conformites_pkey PRIMARY KEY (id);


--
-- Name: normes_qhse normes_qhse_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.normes_qhse
    ADD CONSTRAINT normes_qhse_code_key UNIQUE (code);


--
-- Name: normes_qhse normes_qhse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.normes_qhse
    ADD CONSTRAINT normes_qhse_pkey PRIMARY KEY (id);


--
-- Name: objectifs_production objectifs_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectifs_production
    ADD CONSTRAINT objectifs_production_pkey PRIMARY KEY (id);


--
-- Name: of_composition_lots of_composition_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.of_composition_lots
    ADD CONSTRAINT of_composition_lots_pkey PRIMARY KEY (id);


--
-- Name: ol_lignes ol_lignes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ol_lignes
    ADD CONSTRAINT ol_lignes_pkey PRIMARY KEY (id);


--
-- Name: ordres_fabrication ordres_fabrication_numero_of_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_numero_of_key UNIQUE (numero_of);


--
-- Name: ordres_fabrication ordres_fabrication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_pkey PRIMARY KEY (id);


--
-- Name: ordres_livraison ordres_livraison_numero_ol_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_livraison
    ADD CONSTRAINT ordres_livraison_numero_ol_key UNIQUE (numero_ol);


--
-- Name: ordres_livraison ordres_livraison_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_livraison
    ADD CONSTRAINT ordres_livraison_pkey PRIMARY KEY (id);


--
-- Name: ordres_travail ordres_travail_numero_ot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_travail
    ADD CONSTRAINT ordres_travail_numero_ot_key UNIQUE (numero_ot);


--
-- Name: ordres_travail ordres_travail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_travail
    ADD CONSTRAINT ordres_travail_pkey PRIMARY KEY (id);


--
-- Name: paiements_clients paiements_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_clients
    ADD CONSTRAINT paiements_clients_pkey PRIMARY KEY (id);


--
-- Name: palettes_emballage palettes_emballage_numero_palette_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.palettes_emballage
    ADD CONSTRAINT palettes_emballage_numero_palette_key UNIQUE (numero_palette);


--
-- Name: palettes_emballage palettes_emballage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.palettes_emballage
    ADD CONSTRAINT palettes_emballage_pkey PRIMARY KEY (id);


--
-- Name: parametres_energie parametres_energie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametres_energie
    ADD CONSTRAINT parametres_energie_pkey PRIMARY KEY (id);


--
-- Name: parametres_systeme parametres_systeme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametres_systeme
    ADD CONSTRAINT parametres_systeme_pkey PRIMARY KEY (cle);


--
-- Name: permissions_roles permissions_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions_roles
    ADD CONSTRAINT permissions_roles_pkey PRIMARY KEY (id);


--
-- Name: permissions_roles permissions_roles_role_module_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions_roles
    ADD CONSTRAINT permissions_roles_role_module_key UNIQUE (role, module);


--
-- Name: pieces_detachees pieces_detachees_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_detachees
    ADD CONSTRAINT pieces_detachees_code_key UNIQUE (code);


--
-- Name: pieces_detachees pieces_detachees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_detachees
    ADD CONSTRAINT pieces_detachees_pkey PRIMARY KEY (id);


--
-- Name: plan_formation plan_formation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_formation
    ADD CONSTRAINT plan_formation_pkey PRIMARY KEY (id);


--
-- Name: planning_machines planning_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_machines
    ADD CONSTRAINT planning_machines_pkey PRIMARY KEY (id);


--
-- Name: plans_maintenance plans_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_maintenance
    ADD CONSTRAINT plans_maintenance_pkey PRIMARY KEY (id);


--
-- Name: postes postes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postes
    ADD CONSTRAINT postes_code_key UNIQUE (code);


--
-- Name: postes postes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postes
    ADD CONSTRAINT postes_pkey PRIMARY KEY (id);


--
-- Name: presences presences_employe_id_date_presence_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presences
    ADD CONSTRAINT presences_employe_id_date_presence_key UNIQUE (employe_id, date_presence);


--
-- Name: presences presences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presences
    ADD CONSTRAINT presences_pkey PRIMARY KEY (id);


--
-- Name: processus processus_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processus
    ADD CONSTRAINT processus_code_key UNIQUE (code);


--
-- Name: processus processus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processus
    ADD CONSTRAINT processus_pkey PRIMARY KEY (id);


--
-- Name: rapports_journaliers rapports_journaliers_numero_rapport_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports_journaliers
    ADD CONSTRAINT rapports_journaliers_numero_rapport_key UNIQUE (numero_rapport);


--
-- Name: rapports_journaliers rapports_journaliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports_journaliers
    ADD CONSTRAINT rapports_journaliers_pkey PRIMARY KEY (id);


--
-- Name: rapports rapports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports
    ADD CONSTRAINT rapports_pkey PRIMARY KEY (id);


--
-- Name: receptions_achat receptions_achat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptions_achat
    ADD CONSTRAINT receptions_achat_pkey PRIMARY KEY (id);


--
-- Name: releves_energie releves_energie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releves_energie
    ADD CONSTRAINT releves_energie_pkey PRIMARY KEY (id);


--
-- Name: risques_opportunites risques_opportunites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risques_opportunites
    ADD CONSTRAINT risques_opportunites_pkey PRIMARY KEY (id);


--
-- Name: roles roles_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nom_key UNIQUE (nom);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions_production sessions_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_production
    ADD CONSTRAINT sessions_production_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: soldes_conges soldes_conges_employe_id_annee_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soldes_conges
    ADD CONSTRAINT soldes_conges_employe_id_annee_key UNIQUE (employe_id, annee);


--
-- Name: soldes_conges soldes_conges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soldes_conges
    ADD CONSTRAINT soldes_conges_pkey PRIMARY KEY (id);


--
-- Name: sous_familles_articles sous_familles_articles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sous_familles_articles
    ADD CONSTRAINT sous_familles_articles_code_key UNIQUE (code);


--
-- Name: sous_familles_articles sous_familles_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sous_familles_articles
    ADD CONSTRAINT sous_familles_articles_pkey PRIMARY KEY (id);


--
-- Name: stock_articles stock_articles_article_emplacement_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_articles
    ADD CONSTRAINT stock_articles_article_emplacement_unique UNIQUE (article_id, emplacement_id);


--
-- Name: stock_articles stock_articles_article_id_emplacement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_articles
    ADD CONSTRAINT stock_articles_article_id_emplacement_id_key UNIQUE (article_id, emplacement_id);


--
-- Name: stock_articles stock_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_articles
    ADD CONSTRAINT stock_articles_pkey PRIMARY KEY (id);


--
-- Name: stock_at3 stock_at3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_at3
    ADD CONSTRAINT stock_at3_pkey PRIMARY KEY (id);


--
-- Name: stock_produits_finis stock_produits_finis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_produits_finis
    ADD CONSTRAINT stock_produits_finis_pkey PRIMARY KEY (id);


--
-- Name: tickets_production tickets_production_numero_ticket_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_numero_ticket_key UNIQUE (numero_ticket);


--
-- Name: tickets_production tickets_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_pkey PRIMARY KEY (id);


--
-- Name: unites_mesure unites_mesure_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unites_mesure
    ADD CONSTRAINT unites_mesure_code_key UNIQUE (code);


--
-- Name: unites_mesure unites_mesure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unites_mesure
    ADD CONSTRAINT unites_mesure_pkey PRIMARY KEY (id);


--
-- Name: utilisateurs utilisateurs_badge_qr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_badge_qr_key UNIQUE (badge_qr);


--
-- Name: utilisateurs utilisateurs_login_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_login_key UNIQUE (login);


--
-- Name: utilisateurs utilisateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_pkey PRIMARY KEY (id);


--
-- Name: valeurs_indicateurs valeurs_indicateurs_ind_periode_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valeurs_indicateurs
    ADD CONSTRAINT valeurs_indicateurs_ind_periode_unique UNIQUE (indicateur_id, periode);


--
-- Name: valeurs_indicateurs valeurs_indicateurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valeurs_indicateurs
    ADD CONSTRAINT valeurs_indicateurs_pkey PRIMARY KEY (id);


--
-- Name: ventes ventes_numero_vente_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_numero_vente_key UNIQUE (numero_vente);


--
-- Name: ventes ventes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_pkey PRIMARY KEY (id);


--
-- Name: zones_at3 zones_at3_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones_at3
    ADD CONSTRAINT zones_at3_code_key UNIQUE (code);


--
-- Name: zones_at3 zones_at3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones_at3
    ADD CONSTRAINT zones_at3_pkey PRIMARY KEY (id);


--
-- Name: idx_achats_fourn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achats_fourn ON public.commandes_achat USING btree (fournisseur_id, statut);


--
-- Name: idx_bobines_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bobines_lot ON public.bobines_production USING btree (numero_lot);


--
-- Name: idx_bobines_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bobines_of ON public.bobines_production USING btree (of_id);


--
-- Name: idx_bobines_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bobines_statut ON public.bobines_production USING btree (statut);


--
-- Name: idx_bobines_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bobines_zone ON public.bobines_production USING btree (zone_actuelle_id);


--
-- Name: idx_ces_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ces_of ON public.cessions_at3 USING btree (of_id);


--
-- Name: idx_ces_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ces_statut ON public.cessions_at3 USING btree (statut);


--
-- Name: idx_compo_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compo_article ON public.composition_article USING btree (article_id);


--
-- Name: idx_compo_article_groupe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_compo_article_groupe ON public.composition_article USING btree (article_id, groupe_id);


--
-- Name: idx_ctrl_impr_bobine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ctrl_impr_bobine ON public.controles_impression USING btree (bobine_id);


--
-- Name: idx_ctrl_impr_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ctrl_impr_of ON public.controles_impression USING btree (of_id);


--
-- Name: idx_dbm_lignes_dbm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dbm_lignes_dbm ON public.dbm_lignes USING btree (dbm_id);


--
-- Name: idx_dbm_livraisons_dbm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dbm_livraisons_dbm ON public.dbm_livraisons USING btree (dbm_id);


--
-- Name: idx_dbm_livraisons_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dbm_livraisons_numero ON public.dbm_livraisons USING btree (numero_livraison);


--
-- Name: idx_dbm_mag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dbm_mag ON public.dbm USING btree (magasin_id);


--
-- Name: idx_dbm_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dbm_of ON public.dbm USING btree (of_id);


--
-- Name: idx_dbm_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dbm_statut ON public.dbm USING btree (statut);


--
-- Name: idx_decl_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_decl_of ON public.declarations_production USING btree (of_id);


--
-- Name: idx_demandes_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandes_statut ON public.demandes_achat USING btree (statut);


--
-- Name: idx_doc_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_code ON public.documents_qhse USING btree (code);


--
-- Name: idx_doc_fulltext; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_fulltext ON public.documents_qhse USING gin (to_tsvector('french'::regconfig, ((((COALESCE(contenu_texte, ''::text) || ' '::text) || (COALESCE(titre, ''::character varying))::text) || ' '::text) || COALESCE(mots_cles, ''::text))));


--
-- Name: idx_doc_titre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_titre ON public.documents_qhse USING btree (titre);


--
-- Name: idx_journal_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_article ON public.journal_stock USING btree (article_id, created_at DESC);


--
-- Name: idx_journal_empl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_empl ON public.journal_stock USING btree (emplacement_id);


--
-- Name: idx_journal_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_type ON public.journal_stock USING btree (type);


--
-- Name: idx_lignes_reception; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lignes_reception ON public.lignes_reception_achat USING btree (reception_id);


--
-- Name: idx_logs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_module ON public.logs_activite USING btree (module, created_at DESC);


--
-- Name: idx_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_user ON public.logs_activite USING btree (utilisateur_id, created_at DESC);


--
-- Name: idx_lots_stock_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lots_stock_article ON public.lots_stock USING btree (article_id);


--
-- Name: idx_lots_stock_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lots_stock_statut ON public.lots_stock USING btree (statut);


--
-- Name: idx_mouvements_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mouvements_date ON public.mouvements_stock USING btree (date_mouvement);


--
-- Name: idx_mouvements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mouvements_type ON public.mouvements_stock USING btree (type_mouvement, statut);


--
-- Name: idx_mvt_at3_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mvt_at3_of ON public.mouvements_at3 USING btree (of_id);


--
-- Name: idx_mvt_at3_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mvt_at3_statut ON public.mouvements_at3 USING btree (statut);


--
-- Name: idx_mvt_at3_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mvt_at3_type ON public.mouvements_at3 USING btree (type_mouvement);


--
-- Name: idx_nc_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nc_statut ON public.non_conformites USING btree (statut, gravite);


--
-- Name: idx_ot_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_statut ON public.ordres_travail USING btree (statut, priorite);


--
-- Name: idx_pal_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_lot ON public.palettes_emballage USING btree (numero_lot);


--
-- Name: idx_pal_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_of ON public.palettes_emballage USING btree (of_id);


--
-- Name: idx_pal_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_statut ON public.palettes_emballage USING btree (statut);


--
-- Name: idx_pal_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pal_zone ON public.palettes_emballage USING btree (zone_id);


--
-- Name: idx_planning_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_date ON public.planning_machines USING btree (date_planifiee);


--
-- Name: idx_planning_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planning_machine ON public.planning_machines USING btree (machine_id, date_planifiee);


--
-- Name: idx_rapports_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rapports_date ON public.rapports_journaliers USING btree (date_rapport, atelier_id);


--
-- Name: idx_receptions_commande; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receptions_commande ON public.receptions_achat USING btree (commande_id);


--
-- Name: idx_releves_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_releves_date ON public.releves_energie USING btree (date_releve DESC);


--
-- Name: idx_releves_equip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_releves_equip ON public.releves_energie USING btree (equipement_id, date_releve DESC);


--
-- Name: idx_stock_articles; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_articles ON public.stock_articles USING btree (article_id, emplacement_id);


--
-- Name: idx_stock_at3_article; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_at3_article ON public.stock_at3 USING btree (article_id);


--
-- Name: idx_stock_at3_famille; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_at3_famille ON public.stock_at3 USING btree (famille_id);


--
-- Name: idx_ventes_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventes_client ON public.ventes USING btree (client_id, statut);


--
-- Name: idx_ventes_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventes_date ON public.ventes USING btree (date_vente);


--
-- Name: lots_stock_numero_lot_article_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lots_stock_numero_lot_article_id_key ON public.lots_stock USING btree (numero_lot, article_id);


--
-- Name: vue_dbm _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.vue_dbm AS
 SELECT d.id,
    d.numero_dbm,
    d.of_id,
    d.atelier_id,
    d.magasin_id,
    d.statut,
    d.urgence,
    d.date_besoin,
    d.demandeur_id,
    d.approuve_par,
    d.livre_par,
    d.date_demande,
    d.date_approbation,
    d.date_livraison,
    d.notes_demandeur,
    d.notes_magasin,
    d.created_at,
    o.numero_of,
    at.libelle AS atelier_libelle,
    mag.libelle AS magasin_libelle,
    (((u.nom)::text || ' '::text) || (u.prenom)::text) AS demandeur_nom,
    count(dl.id) AS nb_lignes,
    COALESCE(sum(dl.qte_demandee), (0)::numeric) AS poids_total_demande,
    COALESCE(sum(dl.qte_livree), (0)::numeric) AS poids_total_livre
   FROM (((((public.dbm d
     LEFT JOIN public.ordres_fabrication o ON ((o.id = d.of_id)))
     LEFT JOIN public.ateliers at ON ((at.id = d.atelier_id)))
     LEFT JOIN public.ateliers mag ON ((mag.id = d.magasin_id)))
     LEFT JOIN public.utilisateurs u ON ((u.id = d.demandeur_id)))
     LEFT JOIN public.dbm_lignes dl ON ((dl.dbm_id = d.id)))
  GROUP BY d.id, o.numero_of, at.libelle, mag.libelle, u.nom, u.prenom;


--
-- Name: vue_mouvements _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.vue_mouvements AS
 SELECT ms.id,
    ms.numero_bon,
    ms.type_mouvement,
    ms.statut,
    ms.date_mouvement,
    ms.created_at,
    ms.notes,
    ms.atelier_source_id,
    ms.atelier_dest_id,
    ms.cree_par,
    ms.valide_par,
    ms.pdf_path,
    ms.of_id,
    as1.code AS source_code,
    as1.libelle AS source_libelle,
    as2.code AS dest_code,
    as2.libelle AS dest_libelle,
    count(lm.id) AS nb_lignes,
    COALESCE(sum(lm.poids_reel_kg), (0)::numeric) AS poids_total_kg,
    COALESCE(sum(lm.montant_total), (0)::numeric) AS montant_total
   FROM (((public.mouvements_stock ms
     LEFT JOIN public.ateliers as1 ON ((as1.id = ms.atelier_source_id)))
     LEFT JOIN public.ateliers as2 ON ((as2.id = ms.atelier_dest_id)))
     LEFT JOIN public.lignes_mouvement lm ON ((lm.mouvement_id = ms.id)))
  GROUP BY ms.id, as1.code, as1.libelle, as2.code, as2.libelle;


--
-- Name: bobines_production set_bobines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_bobines_updated_at BEFORE UPDATE ON public.bobines_production FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: palettes_emballage set_palettes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_palettes_updated_at BEFORE UPDATE ON public.palettes_emballage FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- Name: arrêts_machine trg_duree_arret; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_duree_arret BEFORE UPDATE ON public."arrêts_machine" FOR EACH ROW EXECUTE FUNCTION public.calcul_duree_arret();


--
-- Name: employes trg_matricule; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_matricule BEFORE INSERT ON public.employes FOR EACH ROW EXECUTE FUNCTION public.gen_matricule();


--
-- Name: accidents_incidents trg_numero_accident; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_accident BEFORE INSERT ON public.accidents_incidents FOR EACH ROW WHEN ((new.numero IS NULL)) EXECUTE FUNCTION public.gen_numero_accident();


--
-- Name: commandes_achat trg_numero_achat; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_achat BEFORE INSERT ON public.commandes_achat FOR EACH ROW EXECUTE FUNCTION public.gen_numero_achat();


--
-- Name: audits trg_numero_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_audit BEFORE INSERT ON public.audits FOR EACH ROW WHEN ((new.numero_audit IS NULL)) EXECUTE FUNCTION public.gen_numero_audit();


--
-- Name: incidents_securite trg_numero_incident; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_incident BEFORE INSERT ON public.incidents_securite FOR EACH ROW EXECUTE FUNCTION public.generer_numero_incident();


--
-- Name: mouvements_stock trg_numero_mouvement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_mouvement BEFORE INSERT ON public.mouvements_stock FOR EACH ROW EXECUTE FUNCTION public.generer_numero_mouvement();


--
-- Name: non_conformites trg_numero_nc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_nc BEFORE INSERT ON public.non_conformites FOR EACH ROW WHEN ((new.numero_nc IS NULL)) EXECUTE FUNCTION public.gen_numero_nc();


--
-- Name: ordres_livraison trg_numero_ol; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_ol BEFORE INSERT ON public.ordres_livraison FOR EACH ROW WHEN ((new.numero_ol IS NULL)) EXECUTE FUNCTION public.gen_numero_ol();


--
-- Name: ordres_travail trg_numero_ot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_ot BEFORE INSERT ON public.ordres_travail FOR EACH ROW WHEN ((new.numero_ot IS NULL)) EXECUTE FUNCTION public.gen_numero_ot();


--
-- Name: rapports_journaliers trg_numero_rapport; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_rapport BEFORE INSERT ON public.rapports_journaliers FOR EACH ROW EXECUTE FUNCTION public.generer_numero_rapport();


--
-- Name: ventes trg_numero_vente; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_numero_vente BEFORE INSERT ON public.ventes FOR EACH ROW EXECUTE FUNCTION public.gen_numero_vente();


--
-- Name: lots_stock trg_sync_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_stock AFTER INSERT OR DELETE OR UPDATE ON public.lots_stock FOR EACH ROW EXECUTE FUNCTION public.sync_stock_articles();


--
-- Name: tickets_production trg_ticket_numero; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ticket_numero BEFORE INSERT ON public.tickets_production FOR EACH ROW EXECUTE FUNCTION public.generer_numero_ticket();


--
-- Name: accidents_incidents accidents_incidents_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accidents_incidents
    ADD CONSTRAINT accidents_incidents_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: accidents_incidents accidents_incidents_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accidents_incidents
    ADD CONSTRAINT accidents_incidents_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: accidents_incidents accidents_incidents_victime_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accidents_incidents
    ADD CONSTRAINT accidents_incidents_victime_id_fkey FOREIGN KEY (victime_id) REFERENCES public.utilisateurs(id);


--
-- Name: alertes alertes_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes
    ADD CONSTRAINT alertes_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: alertes alertes_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertes
    ADD CONSTRAINT alertes_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: arrêts_machine arrêts_machine_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."arrêts_machine"
    ADD CONSTRAINT "arrêts_machine_machine_id_fkey" FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: arrêts_machine arrêts_machine_operateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."arrêts_machine"
    ADD CONSTRAINT "arrêts_machine_operateur_id_fkey" FOREIGN KEY (operateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: arrêts_machine arrêts_machine_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."arrêts_machine"
    ADD CONSTRAINT "arrêts_machine_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions_production(id);


--
-- Name: aspects_environnementaux aspects_environnementaux_processus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aspects_environnementaux
    ADD CONSTRAINT aspects_environnementaux_processus_id_fkey FOREIGN KEY (processus_id) REFERENCES public.processus(id);


--
-- Name: aspects_environnementaux aspects_environnementaux_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aspects_environnementaux
    ADD CONSTRAINT aspects_environnementaux_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.utilisateurs(id);


--
-- Name: audit_constats audit_constats_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_constats
    ADD CONSTRAINT audit_constats_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audits(id);


--
-- Name: audits audits_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audits
    ADD CONSTRAINT audits_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: bc_lignes bc_lignes_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lignes
    ADD CONSTRAINT bc_lignes_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: bc_lignes bc_lignes_bc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bc_lignes
    ADD CONSTRAINT bc_lignes_bc_id_fkey FOREIGN KEY (bc_id) REFERENCES public.bons_commande(id) ON DELETE CASCADE;


--
-- Name: bobines_production bobines_production_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bobines_production
    ADD CONSTRAINT bobines_production_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: bobines_production bobines_production_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bobines_production
    ADD CONSTRAINT bobines_production_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: bobines_production bobines_production_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bobines_production
    ADD CONSTRAINT bobines_production_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: bobines_production bobines_production_operateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bobines_production
    ADD CONSTRAINT bobines_production_operateur_id_fkey FOREIGN KEY (operateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: bobines_production bobines_production_zone_actuelle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bobines_production
    ADD CONSTRAINT bobines_production_zone_actuelle_id_fkey FOREIGN KEY (zone_actuelle_id) REFERENCES public.zones_at3(id);


--
-- Name: bons_commande bons_commande_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bons_commande
    ADD CONSTRAINT bons_commande_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: bons_commande bons_commande_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bons_commande
    ADD CONSTRAINT bons_commande_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients_complet(id);


--
-- Name: bons_commande bons_commande_commercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bons_commande
    ADD CONSTRAINT bons_commande_commercial_id_fkey FOREIGN KEY (commercial_id) REFERENCES public.utilisateurs(id);


--
-- Name: bons_commande bons_commande_devis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bons_commande
    ADD CONSTRAINT bons_commande_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id);


--
-- Name: bons_commande bons_commande_df_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bons_commande
    ADD CONSTRAINT bons_commande_df_id_fkey FOREIGN KEY (df_id) REFERENCES public.demandes_fabrication(id);


--
-- Name: bulletins_paie bulletins_paie_cree_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletins_paie
    ADD CONSTRAINT bulletins_paie_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES public.utilisateurs(id);


--
-- Name: bulletins_paie bulletins_paie_employe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletins_paie
    ADD CONSTRAINT bulletins_paie_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES public.employes(id);


--
-- Name: cessions_at3 cessions_at3_chef_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cessions_at3
    ADD CONSTRAINT cessions_at3_chef_atelier_id_fkey FOREIGN KEY (chef_atelier_id) REFERENCES public.utilisateurs(id);


--
-- Name: cessions_at3 cessions_at3_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cessions_at3
    ADD CONSTRAINT cessions_at3_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: cessions_at3 cessions_at3_receptionnaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cessions_at3
    ADD CONSTRAINT cessions_at3_receptionnaire_id_fkey FOREIGN KEY (receptionnaire_id) REFERENCES public.utilisateurs(id);


--
-- Name: commandes_achat commandes_achat_cree_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes_achat
    ADD CONSTRAINT commandes_achat_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES public.utilisateurs(id);


--
-- Name: commandes_achat commandes_achat_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commandes_achat
    ADD CONSTRAINT commandes_achat_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id);


--
-- Name: composition_article composition_article_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_article
    ADD CONSTRAINT composition_article_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: composition_article composition_article_famille_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_article
    ADD CONSTRAINT composition_article_famille_id_fkey FOREIGN KEY (famille_id) REFERENCES public.familles_articles(id);


--
-- Name: composition_article composition_article_groupe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.composition_article
    ADD CONSTRAINT composition_article_groupe_id_fkey FOREIGN KEY (groupe_id) REFERENCES public.sous_familles_articles(id);


--
-- Name: conges conges_employe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conges
    ADD CONSTRAINT conges_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES public.employes(id) ON DELETE CASCADE;


--
-- Name: conges conges_valideur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conges
    ADD CONSTRAINT conges_valideur_id_fkey FOREIGN KEY (valideur_id) REFERENCES public.employes(id);


--
-- Name: consommations_matiere consommations_matiere_lot_matiere_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consommations_matiere
    ADD CONSTRAINT consommations_matiere_lot_matiere_id_fkey FOREIGN KEY (lot_matiere_id) REFERENCES public.lots_matiere(id);


--
-- Name: consommations_matiere consommations_matiere_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consommations_matiere
    ADD CONSTRAINT consommations_matiere_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: consommations_matiere consommations_matiere_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consommations_matiere
    ADD CONSTRAINT consommations_matiere_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_production(id);


--
-- Name: contrats contrats_employe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contrats
    ADD CONSTRAINT contrats_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES public.employes(id) ON DELETE CASCADE;


--
-- Name: controles_impression controles_impression_bobine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_impression
    ADD CONSTRAINT controles_impression_bobine_id_fkey FOREIGN KEY (bobine_id) REFERENCES public.bobines_production(id);


--
-- Name: controles_impression controles_impression_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_impression
    ADD CONSTRAINT controles_impression_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: controles_impression controles_impression_operateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_impression
    ADD CONSTRAINT controles_impression_operateur_id_fkey FOREIGN KEY (operateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: controles_qualite controles_qualite_controleur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_qualite
    ADD CONSTRAINT controles_qualite_controleur_id_fkey FOREIGN KEY (controleur_id) REFERENCES public.utilisateurs(id);


--
-- Name: controles_qualite controles_qualite_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_qualite
    ADD CONSTRAINT controles_qualite_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: controles_qualite controles_qualite_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controles_qualite
    ADD CONSTRAINT controles_qualite_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_production(id);


--
-- Name: dbm dbm_approuve_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_approuve_par_fkey FOREIGN KEY (approuve_par) REFERENCES public.utilisateurs(id);


--
-- Name: dbm dbm_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: dbm dbm_demandeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_demandeur_id_fkey FOREIGN KEY (demandeur_id) REFERENCES public.utilisateurs(id);


--
-- Name: dbm_lignes dbm_lignes_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_lignes
    ADD CONSTRAINT dbm_lignes_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: dbm_lignes dbm_lignes_dbm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_lignes
    ADD CONSTRAINT dbm_lignes_dbm_id_fkey FOREIGN KEY (dbm_id) REFERENCES public.dbm(id) ON DELETE CASCADE;


--
-- Name: dbm_lignes dbm_lignes_famille_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_lignes
    ADD CONSTRAINT dbm_lignes_famille_id_fkey FOREIGN KEY (famille_id) REFERENCES public.familles_articles(id);


--
-- Name: dbm_livraisons dbm_livraisons_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_livraisons
    ADD CONSTRAINT dbm_livraisons_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: dbm_livraisons dbm_livraisons_dbm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_livraisons
    ADD CONSTRAINT dbm_livraisons_dbm_id_fkey FOREIGN KEY (dbm_id) REFERENCES public.dbm(id) ON DELETE CASCADE;


--
-- Name: dbm_livraisons dbm_livraisons_ligne_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm_livraisons
    ADD CONSTRAINT dbm_livraisons_ligne_id_fkey FOREIGN KEY (ligne_id) REFERENCES public.dbm_lignes(id) ON DELETE CASCADE;


--
-- Name: dbm dbm_livre_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_livre_par_fkey FOREIGN KEY (livre_par) REFERENCES public.utilisateurs(id);


--
-- Name: dbm dbm_magasin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_magasin_id_fkey FOREIGN KEY (magasin_id) REFERENCES public.ateliers(id);


--
-- Name: dbm dbm_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dbm
    ADD CONSTRAINT dbm_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: declaration_lignes_mp declaration_lignes_mp_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declaration_lignes_mp
    ADD CONSTRAINT declaration_lignes_mp_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: declaration_lignes_mp declaration_lignes_mp_declaration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declaration_lignes_mp
    ADD CONSTRAINT declaration_lignes_mp_declaration_id_fkey FOREIGN KEY (declaration_id) REFERENCES public.declarations_production(id) ON DELETE CASCADE;


--
-- Name: declaration_lignes_mp declaration_lignes_mp_famille_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declaration_lignes_mp
    ADD CONSTRAINT declaration_lignes_mp_famille_id_fkey FOREIGN KEY (famille_id) REFERENCES public.familles_articles(id);


--
-- Name: declarations_production declarations_production_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declarations_production
    ADD CONSTRAINT declarations_production_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: declarations_production declarations_production_declare_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declarations_production
    ADD CONSTRAINT declarations_production_declare_par_fkey FOREIGN KEY (declare_par) REFERENCES public.utilisateurs(id);


--
-- Name: declarations_production declarations_production_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declarations_production
    ADD CONSTRAINT declarations_production_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: declarations_production declarations_production_valide_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.declarations_production
    ADD CONSTRAINT declarations_production_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.utilisateurs(id);


--
-- Name: demandes_achat demandes_achat_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_achat
    ADD CONSTRAINT demandes_achat_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_achat(id);


--
-- Name: demandes_achat demandes_achat_demandeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_achat
    ADD CONSTRAINT demandes_achat_demandeur_id_fkey FOREIGN KEY (demandeur_id) REFERENCES public.utilisateurs(id);


--
-- Name: demandes_achat demandes_achat_traite_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_achat
    ADD CONSTRAINT demandes_achat_traite_par_fkey FOREIGN KEY (traite_par) REFERENCES public.utilisateurs(id);


--
-- Name: demandes_fabrication demandes_fabrication_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: demandes_fabrication demandes_fabrication_bc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_bc_id_fkey FOREIGN KEY (bc_id) REFERENCES public.bons_commande(id);


--
-- Name: demandes_fabrication demandes_fabrication_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients_complet(id) ON DELETE SET NULL;


--
-- Name: demandes_fabrication demandes_fabrication_demandeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_demandeur_id_fkey FOREIGN KEY (demandeur_id) REFERENCES public.utilisateurs(id);


--
-- Name: demandes_fabrication demandes_fabrication_devis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id);


--
-- Name: demandes_fabrication demandes_fabrication_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id) ON DELETE SET NULL;


--
-- Name: demandes_fabrication demandes_fabrication_validee_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_fabrication
    ADD CONSTRAINT demandes_fabrication_validee_par_fkey FOREIGN KEY (validee_par) REFERENCES public.utilisateurs(id);


--
-- Name: devis devis_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis
    ADD CONSTRAINT devis_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: devis devis_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis
    ADD CONSTRAINT devis_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients_complet(id);


--
-- Name: devis devis_commercial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis
    ADD CONSTRAINT devis_commercial_id_fkey FOREIGN KEY (commercial_id) REFERENCES public.utilisateurs(id);


--
-- Name: devis_lignes devis_lignes_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis_lignes
    ADD CONSTRAINT devis_lignes_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: devis_lignes devis_lignes_devis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devis_lignes
    ADD CONSTRAINT devis_lignes_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES public.devis(id) ON DELETE CASCADE;


--
-- Name: documents_processus documents_processus_processus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_processus
    ADD CONSTRAINT documents_processus_processus_id_fkey FOREIGN KEY (processus_id) REFERENCES public.processus(id);


--
-- Name: documents_qhse documents_qhse_approbateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_qhse
    ADD CONSTRAINT documents_qhse_approbateur_id_fkey FOREIGN KEY (approbateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: documents_qhse documents_qhse_processus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_qhse
    ADD CONSTRAINT documents_qhse_processus_id_fkey FOREIGN KEY (processus_id) REFERENCES public.processus(id);


--
-- Name: documents_qhse documents_qhse_redacteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_qhse
    ADD CONSTRAINT documents_qhse_redacteur_id_fkey FOREIGN KEY (redacteur_id) REFERENCES public.utilisateurs(id);


--
-- Name: documents_qhse documents_qhse_verificateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_qhse
    ADD CONSTRAINT documents_qhse_verificateur_id_fkey FOREIGN KEY (verificateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: documents_qhse documents_qhse_version_precedente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents_qhse
    ADD CONSTRAINT documents_qhse_version_precedente_id_fkey FOREIGN KEY (version_precedente_id) REFERENCES public.documents_qhse(id);


--
-- Name: ecarts_audit ecarts_audit_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecarts_audit
    ADD CONSTRAINT ecarts_audit_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audits(id) ON DELETE CASCADE;


--
-- Name: ecarts_audit ecarts_audit_nc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecarts_audit
    ADD CONSTRAINT ecarts_audit_nc_id_fkey FOREIGN KEY (nc_id) REFERENCES public.non_conformites(id);


--
-- Name: ecarts_audit ecarts_audit_processus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecarts_audit
    ADD CONSTRAINT ecarts_audit_processus_id_fkey FOREIGN KEY (processus_id) REFERENCES public.processus(id);


--
-- Name: emplacements_stock emplacements_stock_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emplacements_stock
    ADD CONSTRAINT emplacements_stock_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: employes employes_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employes
    ADD CONSTRAINT employes_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: employes employes_poste_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employes
    ADD CONSTRAINT employes_poste_id_fkey FOREIGN KEY (poste_id) REFERENCES public.postes(id);


--
-- Name: employes employes_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employes
    ADD CONSTRAINT employes_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.employes(id);


--
-- Name: employes employes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employes
    ADD CONSTRAINT employes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.utilisateurs(id);


--
-- Name: equipements equipements_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipements
    ADD CONSTRAINT equipements_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: equipements equipements_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipements
    ADD CONSTRAINT equipements_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.clients(id);


--
-- Name: evaluations evaluations_employe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES public.employes(id);


--
-- Name: evaluations evaluations_evaluateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_evaluateur_id_fkey FOREIGN KEY (evaluateur_id) REFERENCES public.employes(id);


--
-- Name: habilitations habilitations_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habilitations
    ADD CONSTRAINT habilitations_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id) ON DELETE CASCADE;


--
-- Name: historique_pannes historique_pannes_equipement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_pannes
    ADD CONSTRAINT historique_pannes_equipement_id_fkey FOREIGN KEY (equipement_id) REFERENCES public.equipements(id);


--
-- Name: historique_pannes historique_pannes_ot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_pannes
    ADD CONSTRAINT historique_pannes_ot_id_fkey FOREIGN KEY (ot_id) REFERENCES public.ordres_travail(id);


--
-- Name: ia_conversations ia_conversations_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ia_conversations
    ADD CONSTRAINT ia_conversations_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: imports_sage imports_sage_importe_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imports_sage
    ADD CONSTRAINT imports_sage_importe_par_fkey FOREIGN KEY (importe_par) REFERENCES public.utilisateurs(id);


--
-- Name: incidents_securite incidents_securite_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents_securite
    ADD CONSTRAINT incidents_securite_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: indicateurs_qhse indicateurs_qhse_processus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicateurs_qhse
    ADD CONSTRAINT indicateurs_qhse_processus_id_fkey FOREIGN KEY (processus_id) REFERENCES public.processus(id);


--
-- Name: indicateurs_qhse indicateurs_qhse_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicateurs_qhse
    ADD CONSTRAINT indicateurs_qhse_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.utilisateurs(id);


--
-- Name: interactions_processus interactions_processus_processus_dest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions_processus
    ADD CONSTRAINT interactions_processus_processus_dest_id_fkey FOREIGN KEY (processus_dest_id) REFERENCES public.processus(id) ON DELETE CASCADE;


--
-- Name: interactions_processus interactions_processus_processus_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions_processus
    ADD CONSTRAINT interactions_processus_processus_source_id_fkey FOREIGN KEY (processus_source_id) REFERENCES public.processus(id) ON DELETE CASCADE;


--
-- Name: interventions_externes interventions_externes_equipement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interventions_externes
    ADD CONSTRAINT interventions_externes_equipement_id_fkey FOREIGN KEY (equipement_id) REFERENCES public.equipements(id);


--
-- Name: interventions_externes interventions_externes_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interventions_externes
    ADD CONSTRAINT interventions_externes_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id);


--
-- Name: interventions_externes interventions_externes_ot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interventions_externes
    ADD CONSTRAINT interventions_externes_ot_id_fkey FOREIGN KEY (ot_id) REFERENCES public.ordres_travail(id);


--
-- Name: lignes_achat lignes_achat_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_achat
    ADD CONSTRAINT lignes_achat_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: lignes_achat lignes_achat_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_achat
    ADD CONSTRAINT lignes_achat_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_achat(id) ON DELETE CASCADE;


--
-- Name: lignes_achat lignes_achat_unite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_achat
    ADD CONSTRAINT lignes_achat_unite_id_fkey FOREIGN KEY (unite_id) REFERENCES public.unites_mesure(id);


--
-- Name: lignes_demande_achat lignes_demande_achat_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_demande_achat
    ADD CONSTRAINT lignes_demande_achat_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: lignes_demande_achat lignes_demande_achat_demande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_demande_achat
    ADD CONSTRAINT lignes_demande_achat_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES public.demandes_achat(id) ON DELETE CASCADE;


--
-- Name: lignes_mouvement lignes_mouvement_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_mouvement
    ADD CONSTRAINT lignes_mouvement_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: lignes_mouvement lignes_mouvement_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_mouvement
    ADD CONSTRAINT lignes_mouvement_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_stock(id);


--
-- Name: lignes_mouvement lignes_mouvement_mouvement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_mouvement
    ADD CONSTRAINT lignes_mouvement_mouvement_id_fkey FOREIGN KEY (mouvement_id) REFERENCES public.mouvements_stock(id) ON DELETE CASCADE;


--
-- Name: lignes_mouvement lignes_mouvement_unite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_mouvement
    ADD CONSTRAINT lignes_mouvement_unite_id_fkey FOREIGN KEY (unite_id) REFERENCES public.unites_mesure(id);


--
-- Name: lignes_reception_achat lignes_reception_achat_ligne_achat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_reception_achat
    ADD CONSTRAINT lignes_reception_achat_ligne_achat_id_fkey FOREIGN KEY (ligne_achat_id) REFERENCES public.lignes_achat(id) ON DELETE CASCADE;


--
-- Name: lignes_reception_achat lignes_reception_achat_reception_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_reception_achat
    ADD CONSTRAINT lignes_reception_achat_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES public.receptions_achat(id) ON DELETE CASCADE;


--
-- Name: lignes_vente lignes_vente_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_vente
    ADD CONSTRAINT lignes_vente_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: lignes_vente lignes_vente_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_vente
    ADD CONSTRAINT lignes_vente_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_stock(id);


--
-- Name: lignes_vente lignes_vente_unite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_vente
    ADD CONSTRAINT lignes_vente_unite_id_fkey FOREIGN KEY (unite_id) REFERENCES public.unites_mesure(id);


--
-- Name: lignes_vente lignes_vente_vente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lignes_vente
    ADD CONSTRAINT lignes_vente_vente_id_fkey FOREIGN KEY (vente_id) REFERENCES public.ventes(id) ON DELETE CASCADE;


--
-- Name: logs_activite logs_activite_utilisateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs_activite
    ADD CONSTRAINT logs_activite_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: lots_matiere lots_matiere_matiere_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_matiere
    ADD CONSTRAINT lots_matiere_matiere_id_fkey FOREIGN KEY (matiere_id) REFERENCES public.matieres_premieres(id);


--
-- Name: lots_stock lots_stock_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_stock
    ADD CONSTRAINT lots_stock_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: lots_stock lots_stock_emplacement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_stock
    ADD CONSTRAINT lots_stock_emplacement_id_fkey FOREIGN KEY (emplacement_id) REFERENCES public.emplacements_stock(id);


--
-- Name: lots_stock lots_stock_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lots_stock
    ADD CONSTRAINT lots_stock_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.clients(id);


--
-- Name: mouvements_at3 mouvements_at3_cree_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_at3
    ADD CONSTRAINT mouvements_at3_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES public.utilisateurs(id);


--
-- Name: mouvements_at3 mouvements_at3_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_at3
    ADD CONSTRAINT mouvements_at3_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: mouvements_at3 mouvements_at3_valide_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_at3
    ADD CONSTRAINT mouvements_at3_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.utilisateurs(id);


--
-- Name: mouvements_at3 mouvements_at3_zone_dest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_at3
    ADD CONSTRAINT mouvements_at3_zone_dest_id_fkey FOREIGN KEY (zone_dest_id) REFERENCES public.zones_at3(id);


--
-- Name: mouvements_at3 mouvements_at3_zone_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_at3
    ADD CONSTRAINT mouvements_at3_zone_source_id_fkey FOREIGN KEY (zone_source_id) REFERENCES public.zones_at3(id);


--
-- Name: mouvements_stock_at3 mouvements_stock_at3_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock_at3
    ADD CONSTRAINT mouvements_stock_at3_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: mouvements_stock_at3 mouvements_stock_at3_dbm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock_at3
    ADD CONSTRAINT mouvements_stock_at3_dbm_id_fkey FOREIGN KEY (dbm_id) REFERENCES public.dbm(id);


--
-- Name: mouvements_stock_at3 mouvements_stock_at3_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock_at3
    ADD CONSTRAINT mouvements_stock_at3_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: mouvements_stock_at3 mouvements_stock_at3_operateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock_at3
    ADD CONSTRAINT mouvements_stock_at3_operateur_id_fkey FOREIGN KEY (operateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: mouvements_stock_at3 mouvements_stock_at3_stock_at3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock_at3
    ADD CONSTRAINT mouvements_stock_at3_stock_at3_id_fkey FOREIGN KEY (stock_at3_id) REFERENCES public.stock_at3(id);


--
-- Name: mouvements_stock mouvements_stock_atelier_dest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock
    ADD CONSTRAINT mouvements_stock_atelier_dest_id_fkey FOREIGN KEY (atelier_dest_id) REFERENCES public.ateliers(id);


--
-- Name: mouvements_stock mouvements_stock_atelier_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock
    ADD CONSTRAINT mouvements_stock_atelier_source_id_fkey FOREIGN KEY (atelier_source_id) REFERENCES public.ateliers(id);


--
-- Name: mouvements_stock mouvements_stock_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock
    ADD CONSTRAINT mouvements_stock_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: mouvements_stock mouvements_stock_emplacement_dest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock
    ADD CONSTRAINT mouvements_stock_emplacement_dest_id_fkey FOREIGN KEY (emplacement_dest_id) REFERENCES public.emplacements_stock(id);


--
-- Name: mouvements_stock mouvements_stock_emplacement_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mouvements_stock
    ADD CONSTRAINT mouvements_stock_emplacement_source_id_fkey FOREIGN KEY (emplacement_source_id) REFERENCES public.emplacements_stock(id);


--
-- Name: non_conformites non_conformites_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_conformites
    ADD CONSTRAINT non_conformites_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: non_conformites non_conformites_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_conformites
    ADD CONSTRAINT non_conformites_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: non_conformites non_conformites_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_conformites
    ADD CONSTRAINT non_conformites_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: objectifs_production objectifs_production_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectifs_production
    ADD CONSTRAINT objectifs_production_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: objectifs_production objectifs_production_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectifs_production
    ADD CONSTRAINT objectifs_production_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: of_composition_lots of_composition_lots_article_mp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.of_composition_lots
    ADD CONSTRAINT of_composition_lots_article_mp_id_fkey FOREIGN KEY (article_mp_id) REFERENCES public.articles(id);


--
-- Name: of_composition_lots of_composition_lots_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.of_composition_lots
    ADD CONSTRAINT of_composition_lots_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_stock(id);


--
-- Name: of_composition_lots of_composition_lots_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.of_composition_lots
    ADD CONSTRAINT of_composition_lots_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id) ON DELETE CASCADE;


--
-- Name: ol_lignes ol_lignes_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ol_lignes
    ADD CONSTRAINT ol_lignes_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: ol_lignes ol_lignes_bc_ligne_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ol_lignes
    ADD CONSTRAINT ol_lignes_bc_ligne_id_fkey FOREIGN KEY (bc_ligne_id) REFERENCES public.bc_lignes(id);


--
-- Name: ol_lignes ol_lignes_ol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ol_lignes
    ADD CONSTRAINT ol_lignes_ol_id_fkey FOREIGN KEY (ol_id) REFERENCES public.ordres_livraison(id) ON DELETE CASCADE;


--
-- Name: ordres_fabrication ordres_fabrication_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: ordres_fabrication ordres_fabrication_at3_machine_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_at3_machine_assignee_id_fkey FOREIGN KEY (at3_machine_assignee_id) REFERENCES public.machines(id);


--
-- Name: ordres_fabrication ordres_fabrication_at3_valide_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_at3_valide_par_fkey FOREIGN KEY (at3_valide_par) REFERENCES public.utilisateurs(id);


--
-- Name: ordres_fabrication ordres_fabrication_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients_complet(id) ON DELETE SET NULL;


--
-- Name: ordres_fabrication ordres_fabrication_df_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_df_id_fkey FOREIGN KEY (df_id) REFERENCES public.demandes_fabrication(id);


--
-- Name: ordres_fabrication ordres_fabrication_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_fabrication
    ADD CONSTRAINT ordres_fabrication_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: ordres_livraison ordres_livraison_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_livraison
    ADD CONSTRAINT ordres_livraison_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: ordres_livraison ordres_livraison_bc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_livraison
    ADD CONSTRAINT ordres_livraison_bc_id_fkey FOREIGN KEY (bc_id) REFERENCES public.bons_commande(id);


--
-- Name: ordres_livraison ordres_livraison_df_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_livraison
    ADD CONSTRAINT ordres_livraison_df_id_fkey FOREIGN KEY (df_id) REFERENCES public.demandes_fabrication(id);


--
-- Name: ordres_livraison ordres_livraison_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_livraison
    ADD CONSTRAINT ordres_livraison_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: ordres_travail ordres_travail_equipement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_travail
    ADD CONSTRAINT ordres_travail_equipement_id_fkey FOREIGN KEY (equipement_id) REFERENCES public.equipements(id);


--
-- Name: ordres_travail ordres_travail_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordres_travail
    ADD CONSTRAINT ordres_travail_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_maintenance(id);


--
-- Name: paiements_clients paiements_clients_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_clients
    ADD CONSTRAINT paiements_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients_complet(id);


--
-- Name: paiements_clients paiements_clients_cree_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_clients
    ADD CONSTRAINT paiements_clients_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES public.utilisateurs(id);


--
-- Name: paiements_clients paiements_clients_vente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paiements_clients
    ADD CONSTRAINT paiements_clients_vente_id_fkey FOREIGN KEY (vente_id) REFERENCES public.ventes(id);


--
-- Name: palettes_emballage palettes_emballage_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.palettes_emballage
    ADD CONSTRAINT palettes_emballage_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: palettes_emballage palettes_emballage_controleur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.palettes_emballage
    ADD CONSTRAINT palettes_emballage_controleur_id_fkey FOREIGN KEY (controleur_id) REFERENCES public.utilisateurs(id);


--
-- Name: palettes_emballage palettes_emballage_emballeur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.palettes_emballage
    ADD CONSTRAINT palettes_emballage_emballeur_id_fkey FOREIGN KEY (emballeur_id) REFERENCES public.utilisateurs(id);


--
-- Name: palettes_emballage palettes_emballage_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.palettes_emballage
    ADD CONSTRAINT palettes_emballage_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: palettes_emballage palettes_emballage_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.palettes_emballage
    ADD CONSTRAINT palettes_emballage_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones_at3(id);


--
-- Name: pieces_detachees pieces_detachees_fournisseur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieces_detachees
    ADD CONSTRAINT pieces_detachees_fournisseur_id_fkey FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id);


--
-- Name: planning_machines planning_machines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_machines
    ADD CONSTRAINT planning_machines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.utilisateurs(id);


--
-- Name: planning_machines planning_machines_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_machines
    ADD CONSTRAINT planning_machines_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: planning_machines planning_machines_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_machines
    ADD CONSTRAINT planning_machines_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: planning_machines planning_machines_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_machines
    ADD CONSTRAINT planning_machines_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: plans_maintenance plans_maintenance_equipement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans_maintenance
    ADD CONSTRAINT plans_maintenance_equipement_id_fkey FOREIGN KEY (equipement_id) REFERENCES public.equipements(id);


--
-- Name: presences presences_employe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presences
    ADD CONSTRAINT presences_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES public.employes(id) ON DELETE CASCADE;


--
-- Name: presences presences_saisi_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presences
    ADD CONSTRAINT presences_saisi_par_fkey FOREIGN KEY (saisi_par) REFERENCES public.utilisateurs(id);


--
-- Name: processus processus_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processus
    ADD CONSTRAINT processus_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: rapports rapports_genere_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports
    ADD CONSTRAINT rapports_genere_par_fkey FOREIGN KEY (genere_par) REFERENCES public.utilisateurs(id);


--
-- Name: rapports_journaliers rapports_journaliers_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports_journaliers
    ADD CONSTRAINT rapports_journaliers_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: rapports_journaliers rapports_journaliers_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports_journaliers
    ADD CONSTRAINT rapports_journaliers_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: rapports_journaliers rapports_journaliers_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rapports_journaliers
    ADD CONSTRAINT rapports_journaliers_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: receptions_achat receptions_achat_commande_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptions_achat
    ADD CONSTRAINT receptions_achat_commande_id_fkey FOREIGN KEY (commande_id) REFERENCES public.commandes_achat(id) ON DELETE CASCADE;


--
-- Name: releves_energie releves_energie_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releves_energie
    ADD CONSTRAINT releves_energie_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: releves_energie releves_energie_equipement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releves_energie
    ADD CONSTRAINT releves_energie_equipement_id_fkey FOREIGN KEY (equipement_id) REFERENCES public.equipements(id);


--
-- Name: releves_energie releves_energie_operateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releves_energie
    ADD CONSTRAINT releves_energie_operateur_id_fkey FOREIGN KEY (operateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: risques_opportunites risques_opportunites_processus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risques_opportunites
    ADD CONSTRAINT risques_opportunites_processus_id_fkey FOREIGN KEY (processus_id) REFERENCES public.processus(id);


--
-- Name: risques_opportunites risques_opportunites_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risques_opportunites
    ADD CONSTRAINT risques_opportunites_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.utilisateurs(id);


--
-- Name: sessions_production sessions_production_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_production
    ADD CONSTRAINT sessions_production_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: sessions_production sessions_production_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_production
    ADD CONSTRAINT sessions_production_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: sessions_production sessions_production_operateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_production
    ADD CONSTRAINT sessions_production_operateur_id_fkey FOREIGN KEY (operateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: sessions_production sessions_production_regleur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_production
    ADD CONSTRAINT sessions_production_regleur_id_fkey FOREIGN KEY (regleur_id) REFERENCES public.utilisateurs(id);


--
-- Name: sessions_production sessions_production_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions_production
    ADD CONSTRAINT sessions_production_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: soldes_conges soldes_conges_employe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soldes_conges
    ADD CONSTRAINT soldes_conges_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES public.employes(id) ON DELETE CASCADE;


--
-- Name: sous_familles_articles sous_familles_articles_famille_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sous_familles_articles
    ADD CONSTRAINT sous_familles_articles_famille_id_fkey FOREIGN KEY (famille_id) REFERENCES public.familles_articles(id);


--
-- Name: stock_articles stock_articles_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_articles
    ADD CONSTRAINT stock_articles_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: stock_articles stock_articles_emplacement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_articles
    ADD CONSTRAINT stock_articles_emplacement_id_fkey FOREIGN KEY (emplacement_id) REFERENCES public.emplacements_stock(id);


--
-- Name: stock_at3 stock_at3_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_at3
    ADD CONSTRAINT stock_at3_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: stock_at3 stock_at3_famille_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_at3
    ADD CONSTRAINT stock_at3_famille_id_fkey FOREIGN KEY (famille_id) REFERENCES public.familles_articles(id);


--
-- Name: stock_produits_finis stock_produits_finis_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_produits_finis
    ADD CONSTRAINT stock_produits_finis_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: stock_produits_finis stock_produits_finis_controle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_produits_finis
    ADD CONSTRAINT stock_produits_finis_controle_id_fkey FOREIGN KEY (controle_id) REFERENCES public.controles_qualite(id);


--
-- Name: stock_produits_finis stock_produits_finis_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_produits_finis
    ADD CONSTRAINT stock_produits_finis_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: tickets_production tickets_production_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: tickets_production tickets_production_lot_matiere_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_lot_matiere_id_fkey FOREIGN KEY (lot_matiere_id) REFERENCES public.lots_matiere(id);


--
-- Name: tickets_production tickets_production_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: tickets_production tickets_production_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_of_id_fkey FOREIGN KEY (of_id) REFERENCES public.ordres_fabrication(id);


--
-- Name: tickets_production tickets_production_operateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_operateur_id_fkey FOREIGN KEY (operateur_id) REFERENCES public.utilisateurs(id);


--
-- Name: tickets_production tickets_production_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions_production(id);


--
-- Name: tickets_production tickets_production_ticket_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_ticket_parent_id_fkey FOREIGN KEY (ticket_parent_id) REFERENCES public.tickets_production(id);


--
-- Name: tickets_production tickets_production_valide_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets_production
    ADD CONSTRAINT tickets_production_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.utilisateurs(id);


--
-- Name: utilisateurs utilisateurs_atelier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_atelier_id_fkey FOREIGN KEY (atelier_id) REFERENCES public.ateliers(id);


--
-- Name: utilisateurs utilisateurs_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilisateurs
    ADD CONSTRAINT utilisateurs_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: valeurs_indicateurs valeurs_indicateurs_indicateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valeurs_indicateurs
    ADD CONSTRAINT valeurs_indicateurs_indicateur_id_fkey FOREIGN KEY (indicateur_id) REFERENCES public.indicateurs_qhse(id) ON DELETE CASCADE;


--
-- Name: valeurs_indicateurs valeurs_indicateurs_saisi_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valeurs_indicateurs
    ADD CONSTRAINT valeurs_indicateurs_saisi_par_fkey FOREIGN KEY (saisi_par) REFERENCES public.utilisateurs(id);


--
-- Name: ventes ventes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients_complet(id);


--
-- Name: ventes ventes_cree_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES public.utilisateurs(id);


--
-- Name: ventes ventes_valide_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventes
    ADD CONSTRAINT ventes_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.utilisateurs(id);


--
-- PostgreSQL database dump complete
--

\unrestrict mo2algwgI873ZSIVmltA7gbfkINZIvQlg98q2cR3S50rehhYFXpEKqQpJ3XEnKQ

