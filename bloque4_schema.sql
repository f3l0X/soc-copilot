-- ============================================================
--  BLOQUE 4 — BASE DE CONOCIMIENTO / MEMORIA DEL SISTEMA
--  PostgreSQL  |  Sin duplicidades  |  Historial + Acciones
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. HISTORIAL DE ALERTAS
--    Guarda cada alerta/log recibido.
--    content_hash (SHA-256) evita duplicados exactos.
-- ============================================================
CREATE TABLE kb_alerts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificación única del contenido (anti-duplicado)
    content_hash    TEXT        NOT NULL,
    CONSTRAINT uq_alert_hash UNIQUE (content_hash),

    -- Datos de la alerta
    source          VARCHAR(120),                  -- origen: firewall, EDR, SIEM…
    raw_content     TEXT        NOT NULL,          -- texto original del log/alerta
    severity        VARCHAR(20) NOT NULL DEFAULT 'unknown'
                        CHECK (severity IN ('critical','high','medium','low','info','unknown')),
    alert_type      VARCHAR(80),                   -- tipo detectado p.ej. brute_force
    event_timestamp TIMESTAMPTZ,                   -- cuándo ocurrió el evento
    source_ip       INET,
    dest_ip         INET,
    hostname        VARCHAR(255),
    status          VARCHAR(30) NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','analyzed','false_positive','archived')),

    -- Metadatos de ingesta
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_alerts_severity   ON kb_alerts(severity);
CREATE INDEX idx_kb_alerts_status     ON kb_alerts(status);
CREATE INDEX idx_kb_alerts_source_ip  ON kb_alerts(source_ip);
CREATE INDEX idx_kb_alerts_event_ts   ON kb_alerts(event_timestamp DESC);

-- ============================================================
-- 2. RESULTADOS DE ANÁLISIS IA
--    Qué dijo la IA sobre cada alerta (1 resultado por alerta).
-- ============================================================
CREATE TABLE kb_analysis (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id            UUID    NOT NULL UNIQUE REFERENCES kb_alerts(id) ON DELETE CASCADE,

    plain_explanation   TEXT    NOT NULL,           -- explicación en lenguaje claro
    attack_category     VARCHAR(120),               -- p.ej. "Credential Access"
    mitre_technique_id  VARCHAR(20),                -- p.ej. T1110
    mitre_technique_name VARCHAR(255),
    severity_assessed   VARCHAR(20) CHECK (severity_assessed IN
                            ('critical','high','medium','low','info','unknown')),
    confidence_score    NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
    is_false_positive   BOOLEAN DEFAULT FALSE,
    ai_model            VARCHAR(80),
    tokens_used         INTEGER,
    analysis_ms         INTEGER,                    -- duración del análisis
    raw_ai_response     JSONB   DEFAULT '{}',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_analysis_alert    ON kb_analysis(alert_id);
CREATE INDEX idx_kb_analysis_mitre    ON kb_analysis(mitre_technique_id);

-- ============================================================
-- 3. HISTORIAL DE ACCIONES REALIZADAS
--    Todo lo que se hizo como respuesta a una alerta.
--    Incluye acciones manuales y automatizadas.
-- ============================================================
CREATE TABLE kb_actions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id        UUID        NOT NULL REFERENCES kb_alerts(id) ON DELETE CASCADE,
    analysis_id     UUID        REFERENCES kb_analysis(id) ON DELETE SET NULL,

    -- Tipo y categoría de la acción
    action_type     VARCHAR(60) NOT NULL
                        CHECK (action_type IN (
                            'containment','eradication','recovery',
                            'investigation','hardening','notification',
                            'block_ip','isolate_host','reset_password',
                            'patch','escalation','other'
                        )),
    description     TEXT        NOT NULL,           -- qué se hizo exactamente
    outcome         TEXT,                           -- resultado obtenido
    is_automated    BOOLEAN     NOT NULL DEFAULT FALSE,
    executed_by     VARCHAR(120),                   -- usuario o sistema que ejecutó
    priority        SMALLINT    NOT NULL DEFAULT 3
                        CHECK (priority BETWEEN 1 AND 5),

    status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','completed','failed','skipped')),

    executed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_actions_alert     ON kb_actions(alert_id);
CREATE INDEX idx_kb_actions_type      ON kb_actions(action_type);
CREATE INDEX idx_kb_actions_status    ON kb_actions(status);

-- ============================================================
-- 4. BASE DE CONOCIMIENTO REUTILIZABLE
--    Patrones aprendidos, reglas y contexto acumulado.
--    El sistema puede consultarla para no repetir análisis.
-- ============================================================
CREATE TABLE kb_knowledge (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificación del conocimiento
    category        VARCHAR(80) NOT NULL,           -- p.ej. "brute_force_ssh"
    title           VARCHAR(255) NOT NULL,
    content         TEXT        NOT NULL,           -- descripción del patrón/regla
    source_type     VARCHAR(40) NOT NULL DEFAULT 'learned'
                        CHECK (source_type IN ('manual','learned','mitre','rule','template')),

    -- Indicadores relacionados (IoCs reutilizables)
    related_ips     INET[]      DEFAULT '{}',
    related_hashes  TEXT[]      DEFAULT '{}',
    related_domains TEXT[]      DEFAULT '{}',
    mitre_ids       TEXT[]      DEFAULT '{}',       -- técnicas MITRE asociadas

    -- Uso y relevancia
    times_used      INTEGER     NOT NULL DEFAULT 0,
    confidence      NUMERIC(5,2) CHECK (confidence BETWEEN 0 AND 100),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,                    -- NULL = nunca expira

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_knowledge_category ON kb_knowledge(category);
CREATE INDEX idx_kb_knowledge_active   ON kb_knowledge(is_active);

-- ============================================================
-- 5. HISTORIAL DE CHAT / CONVERSACIONES
--    Memoria de las interacciones del analista con la IA.
-- ============================================================
CREATE TABLE kb_chat_sessions (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id    UUID    REFERENCES kb_alerts(id) ON DELETE SET NULL,
    title       VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kb_chat_messages (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID    NOT NULL REFERENCES kb_chat_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT    NOT NULL,
    tokens_used INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_chat_msg_session ON kb_chat_messages(session_id);

-- ============================================================
-- TRIGGER — updated_at automático en todas las tablas
-- ============================================================
CREATE OR REPLACE FUNCTION kb_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kb_alerts','kb_analysis','kb_actions','kb_knowledge',
    'kb_chat_sessions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_upd BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION kb_set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- FUNCIÓN PRINCIPAL — insertar alerta sin duplicados
--    Retorna: (alert_id, is_duplicate)
--    Uso desde la app: SELECT * FROM kb_ingest_alert(...)
-- ============================================================
CREATE OR REPLACE FUNCTION kb_ingest_alert(
    p_raw       TEXT,
    p_source    VARCHAR  DEFAULT NULL,
    p_severity  VARCHAR  DEFAULT 'unknown',
    p_event_ts  TIMESTAMPTZ DEFAULT NULL,
    p_src_ip    INET     DEFAULT NULL,
    p_dst_ip    INET     DEFAULT NULL,
    p_hostname  VARCHAR  DEFAULT NULL
)
RETURNS TABLE(alert_id UUID, is_duplicate BOOLEAN) AS $$
DECLARE
    v_hash  TEXT;
    v_id    UUID;
    v_dup   BOOLEAN := FALSE;
BEGIN
    v_hash := encode(digest(p_raw, 'sha256'), 'hex');

    SELECT id INTO v_id FROM kb_alerts WHERE content_hash = v_hash;

    IF FOUND THEN
        v_dup := TRUE;
    ELSE
        INSERT INTO kb_alerts (
            raw_content, content_hash, source, severity,
            event_timestamp, source_ip, dest_ip, hostname
        ) VALUES (
            p_raw, v_hash, p_source, p_severity,
            p_event_ts, p_src_ip, p_dst_ip, p_hostname
        ) RETURNING id INTO v_id;
    END IF;

    RETURN QUERY SELECT v_id, v_dup;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN — registrar una acción realizada
-- ============================================================
CREATE OR REPLACE FUNCTION kb_log_action(
    p_alert_id    UUID,
    p_type        VARCHAR,
    p_description TEXT,
    p_executed_by VARCHAR  DEFAULT 'system',
    p_automated   BOOLEAN  DEFAULT FALSE,
    p_priority    SMALLINT DEFAULT 3
)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO kb_actions (
        alert_id, action_type, description,
        executed_by, is_automated, priority, status, executed_at
    ) VALUES (
        p_alert_id, p_type, p_description,
        p_executed_by, p_automated, p_priority, 'completed', NOW()
    ) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista completa: alerta + análisis + acciones
CREATE VIEW v_kb_full_history AS
SELECT
    a.id            AS alert_id,
    a.created_at    AS ingested_at,
    a.source,
    a.severity,
    a.alert_type,
    a.status        AS alert_status,
    a.source_ip,
    a.event_timestamp,
    n.plain_explanation,
    n.mitre_technique_id,
    n.mitre_technique_name,
    n.confidence_score,
    n.is_false_positive,
    COUNT(ac.id)    AS total_actions,
    COUNT(ac.id) FILTER (WHERE ac.status = 'completed') AS completed_actions,
    MAX(ac.executed_at) AS last_action_at
FROM kb_alerts a
LEFT JOIN kb_analysis n  ON n.alert_id = a.id
LEFT JOIN kb_actions  ac ON ac.alert_id = a.id
GROUP BY a.id, n.id
ORDER BY a.created_at DESC;

-- Vista: estadísticas por severidad
CREATE VIEW v_kb_severity_stats AS
SELECT
    severity,
    COUNT(*)                                          AS total,
    COUNT(*) FILTER (WHERE status = 'analyzed')       AS analyzed,
    COUNT(*) FILTER (WHERE status = 'false_positive') AS false_positives,
    ROUND(AVG(an.confidence_score), 1)                AS avg_confidence
FROM kb_alerts a
LEFT JOIN kb_analysis an ON an.alert_id = a.id
GROUP BY severity
ORDER BY CASE severity
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2
    WHEN 'medium' THEN 3   WHEN 'low' THEN 4 ELSE 5 END;

-- Vista: acciones más frecuentes
CREATE VIEW v_kb_top_actions AS
SELECT
    action_type,
    COUNT(*)                                               AS total,
    COUNT(*) FILTER (WHERE status = 'completed')           AS completed,
    COUNT(*) FILTER (WHERE is_automated = TRUE)            AS automated,
    ROUND(AVG(priority), 1)                                AS avg_priority
FROM kb_actions
GROUP BY action_type
ORDER BY total DESC;

-- ============================================================
-- DATOS SEMILLA — conocimiento base para reutilizar
-- ============================================================
INSERT INTO kb_knowledge (category, title, content, source_type, mitre_ids, confidence) VALUES
('brute_force_ssh',
 'Ataque de fuerza bruta SSH detectado',
 'Múltiples intentos fallidos de login SSH desde una misma IP en < 60 seg. Acción estándar: bloquear IP en firewall, revisar /var/log/auth.log.',
 'manual', ARRAY['T1110','T1110.001'], 95),

('port_scan',
 'Escaneo de puertos interno',
 'Un host interno genera conexiones SYN a múltiples puertos distintos en < 30 seg. Puede indicar movimiento lateral o herramienta de reconocimiento.',
 'manual', ARRAY['T1046'], 88),

('ransomware_indicators',
 'Indicadores de ransomware',
 'Cifrado masivo de archivos, cambio de extensiones, notas de rescate en disco. Aislar host de inmediato. No pagar rescate sin evaluación.',
 'mitre', ARRAY['T1486'], 99),

('credential_dump',
 'Volcado de credenciales del SO',
 'Acceso inusual a LSASS.exe, uso de mimikatz o similar. Resetear contraseñas de cuentas afectadas, activar Credential Guard.',
 'mitre', ARRAY['T1003'], 92),

('lateral_movement_rdp',
 'Movimiento lateral por RDP',
 'Sesiones RDP entre hosts internos fuera de horario laboral o desde cuentas de servicio. Revisar Event ID 4624/4625 en Windows.',
 'learned', ARRAY['T1021.001'], 85);

-- ============================================================
-- FIN DEL SCHEMA — BLOQUE 4
-- ============================================================
