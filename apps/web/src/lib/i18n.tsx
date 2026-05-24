"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type Locale = "es" | "en" | "fr";

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
};

// ─── Translations ─────────────────────────────────────────────────────────────

export const translations = {
  es: {
    // Nav
    nav_dashboard: "Dashboard",
    nav_alerts: "Alertas",
    nav_logs: "Logs",
    nav_chat: "Chat IA",
    nav_history: "Historial",
    nav_settings: "Settings",
    nav_admin: "Admin",
    nav_ops: "Operación",
    nav_system: "Sistema",
    // Topbar
    topbar_search_placeholder: "Buscar alerta, IP, hash, técnica MITRE…",
    topbar_model: "modelo",
    topbar_signout: "Salir",
    // Status widget
    status_backend: "Backend operativo",
    // Home
    home_welcome: "Bienvenido",
    home_hello: "Hola",
    home_subtitle: "SOC Copilot está listo. Arranca por el módulo que necesites o salta al dashboard para ver el estado en vivo.",
    home_go_dashboard: "Ir al Dashboard",
    home_analyze_alert: "Analizar una alerta",
    home_modules: "Módulos",
    home_available: "disponibles",
    // Tiles
    tile_alerts_title: "Alert Explainer",
    tile_alerts_desc: "Pega una alerta y obtén triage estructurado",
    tile_logs_title: "Logs",
    tile_logs_desc: "Analiza y filtra eventos por host, IP, técnica MITRE",
    tile_chat_title: "Chat IA",
    tile_chat_desc: "Conversa con el copiloto + RAG sobre tus alertas",
    tile_history_title: "Histórico",
    tile_history_desc: "Alertas previas y trazabilidad de decisiones",
    tile_dashboard_title: "Dashboard",
    tile_dashboard_desc: "Métricas en vivo y cobertura MITRE",
    tile_admin_title: "Administración",
    tile_admin_desc: "Gestión de usuarios, roles y configuración global",
    // Alerts page
    alerts_title: "Alert Explainer",
    alerts_subtitle: "Pega un log o alerta. La IA explica qué ocurre, asigna riesgo y mapea a MITRE ATT&CK.",
    alerts_source_placeholder: "Fuente (auth.log, nginx, syslog…)",
    alerts_history_link: "Histórico →",
    alerts_analyze_btn: "Analizar",
    alerts_analyzing_btn: "Analizando…",
    alerts_summary: "Resumen",
    alerts_mitre: "MITRE ATT&CK",
    alerts_reasoning: "Razonamiento",
    alerts_next_step: "Siguiente paso → recomendar acciones",
    alerts_loading: "Verificando sesión…",
    alerts_error: "Error:",
    // Chat page
    chat_title: "Chat IA",
    chat_subtitle: "Mentor SOC con RAG sobre MITRE ATT&CK + OWASP Top 10.",
    chat_kb_unavailable: "KB no disponible",
    chat_kb_docs: "docs",
    chat_starters_label: "Empieza con uno de estos:",
    chat_you: "Tú",
    chat_mentor: "Mentor",
    chat_thinking: "Mentor está pensando…",
    chat_sources: "Fuentes citables:",
    chat_log_context_toggle: "contexto del log (opcional)",
    chat_log_context_placeholder: "Pega aquí un log o alerta para que el mentor lo tenga en cuenta…",
    chat_input_placeholder: "Escribe tu pregunta…",
    chat_send_btn: "Enviar",
    chat_back_alerts: "← Alertas",
    // History page
    history_title: "Histórico",
    history_new_alert: "+ nueva alerta",
    history_loading: "Cargando…",
    history_empty: "Sin alertas todavía. Empieza en",
    history_col_id: "#",
    history_col_date: "Fecha",
    history_col_source: "Fuente",
    history_col_summary: "Resumen",
    history_col_risk: "Riesgo",
    history_col_mitre: "MITRE",
    history_open: "abrir →",
    // Respond page
    respond_title: "Next Step Recommender",
    respond_subtitle: "Acciones concretas para esta alerta, con justificación didáctica.",
    respond_no_alert: "Llega aquí desde una alerta. Empieza analizando un log en",
    respond_loading_alert: "Cargando alerta",
    respond_recommend_btn: "Recomendar acciones",
    respond_recommending_btn: "Generando recomendaciones…",
    respond_another_btn: "Generar otra recomendación",
    respond_recommendation: "Recomendación",
    respond_learning: "Modo aprendizaje",
    respond_new_alert: "← nueva alerta",
    // Login page
    login_title: "SOC Copilot",
    login_subtitle: "Inicia sesión para continuar.",
    login_register_subtitle: "Crea una cuenta. El primer usuario es admin.",
    login_name: "Nombre",
    login_level: "Nivel SOC",
    login_email: "Email",
    login_password: "Contraseña",
    login_confirm_password: "Confirmar contraseña",
    login_btn: "Iniciar sesión",
    login_register_btn: "Crear cuenta",
    login_loading_btn: "…",
    login_switch_to_register: "¿No tienes cuenta? Regístrate",
    login_switch_to_login: "Ya tengo cuenta",
    // Settings page
    settings_title: "Configuración de IA",
    settings_subtitle: "Usa la clave compartida del proyecto (con cuota diaria) o trae la tuya de Google AI Studio para no compartir cuota con el resto del equipo.",
    settings_default_model: "Modelo predeterminado",
    settings_model_desc: "Se usará en explicaciones, recomendaciones y chat cuando no selecciones otro explícitamente.",
    settings_save_model: "Guardar modelo",
    settings_api_key: "Tu API key de Gemini",
    // Profile page
    profile_title: "Mi Perfil",
    profile_subtitle: "Edita tu información personal. La contraseña y el rol se gestionan desde el panel de administración.",
    profile_name: "Nombre",
    profile_lastname: "Apellidos",
    profile_email: "Email",
    profile_save: "Guardar cambios",
    profile_saving: "Guardando...",
    profile_discard: "Descartar",
    // Theme
    theme_dark: "Oscuro",
    theme_light: "Claro",
  },

  en: {
    // Nav
    nav_dashboard: "Dashboard",
    nav_alerts: "Alerts",
    nav_logs: "Logs",
    nav_chat: "AI Chat",
    nav_history: "History",
    nav_settings: "Settings",
    nav_admin: "Admin",
    nav_ops: "Operations",
    nav_system: "System",
    // Topbar
    topbar_search_placeholder: "Search alert, IP, hash, MITRE technique…",
    topbar_model: "model",
    topbar_signout: "Sign out",
    // Status widget
    status_backend: "Backend online",
    // Home
    home_welcome: "Welcome",
    home_hello: "Hello",
    home_subtitle: "SOC Copilot is ready. Start with the module you need or jump to the dashboard to see the live status.",
    home_go_dashboard: "Go to Dashboard",
    home_analyze_alert: "Analyze an alert",
    home_modules: "Modules",
    home_available: "available",
    // Tiles
    tile_alerts_title: "Alert Explainer",
    tile_alerts_desc: "Paste an alert and get structured triage",
    tile_logs_title: "Logs",
    tile_logs_desc: "Analyze and filter events by host, IP, MITRE technique",
    tile_chat_title: "AI Chat",
    tile_chat_desc: "Chat with the copilot + RAG about your alerts",
    tile_history_title: "History",
    tile_history_desc: "Previous alerts and decision traceability",
    tile_dashboard_title: "Dashboard",
    tile_dashboard_desc: "Live metrics and MITRE coverage",
    tile_admin_title: "Administration",
    tile_admin_desc: "User management, roles and global configuration",
    // Alerts page
    alerts_title: "Alert Explainer",
    alerts_subtitle: "Paste a log or alert. The AI explains what happened, assigns risk and maps to MITRE ATT&CK.",
    alerts_source_placeholder: "Source (auth.log, nginx, syslog…)",
    alerts_history_link: "History →",
    alerts_analyze_btn: "Analyze",
    alerts_analyzing_btn: "Analyzing…",
    alerts_summary: "Summary",
    alerts_mitre: "MITRE ATT&CK",
    alerts_reasoning: "Reasoning",
    alerts_next_step: "Next step → recommend actions",
    alerts_loading: "Verifying session…",
    alerts_error: "Error:",
    // Chat page
    chat_title: "AI Chat",
    chat_subtitle: "SOC Mentor with RAG on MITRE ATT&CK + OWASP Top 10.",
    chat_kb_unavailable: "KB unavailable",
    chat_kb_docs: "docs",
    chat_starters_label: "Start with one of these:",
    chat_you: "You",
    chat_mentor: "Mentor",
    chat_thinking: "Mentor is thinking…",
    chat_sources: "Citable sources:",
    chat_log_context_toggle: "log context (optional)",
    chat_log_context_placeholder: "Paste a log or alert here for the mentor to consider…",
    chat_input_placeholder: "Type your question…",
    chat_send_btn: "Send",
    chat_back_alerts: "← Alerts",
    // History page
    history_title: "History",
    history_new_alert: "+ new alert",
    history_loading: "Loading…",
    history_empty: "No alerts yet. Start at",
    history_col_id: "#",
    history_col_date: "Date",
    history_col_source: "Source",
    history_col_summary: "Summary",
    history_col_risk: "Risk",
    history_col_mitre: "MITRE",
    history_open: "open →",
    // Respond page
    respond_title: "Next Step Recommender",
    respond_subtitle: "Concrete actions for this alert, with educational justification.",
    respond_no_alert: "Come here from an alert. Start by analyzing a log in",
    respond_loading_alert: "Loading alert",
    respond_recommend_btn: "Recommend actions",
    respond_recommending_btn: "Generating recommendations…",
    respond_another_btn: "Generate another recommendation",
    respond_recommendation: "Recommendation",
    respond_learning: "Learning mode",
    respond_new_alert: "← new alert",
    // Login page
    login_title: "SOC Copilot",
    login_subtitle: "Sign in to continue.",
    login_register_subtitle: "Create an account. The first user is admin.",
    login_name: "Name",
    login_level: "SOC Level",
    login_email: "Email",
    login_password: "Password",
    login_confirm_password: "Confirm password",
    login_btn: "Sign in",
    login_register_btn: "Create account",
    login_loading_btn: "…",
    login_switch_to_register: "Don't have an account? Register",
    login_switch_to_login: "I already have an account",
    // Settings page
    settings_title: "AI Configuration",
    settings_subtitle: "Use the project's shared key (with daily quota) or bring your own from Google AI Studio.",
    settings_default_model: "Default model",
    settings_model_desc: "Used in explanations, recommendations and chat when you don't select another explicitly.",
    settings_save_model: "Save model",
    settings_api_key: "Your Gemini API key",
    // Profile page
    profile_title: "My Profile",
    profile_subtitle: "Edit your personal information. Password and role are managed from the admin panel.",
    profile_name: "Name",
    profile_lastname: "Last name",
    profile_email: "Email",
    profile_save: "Save changes",
    profile_saving: "Saving...",
    profile_discard: "Discard",
    // Theme
    theme_dark: "Dark",
    theme_light: "Light",
  },

  fr: {
    // Nav
    nav_dashboard: "Tableau de bord",
    nav_alerts: "Alertes",
    nav_logs: "Logs",
    nav_chat: "Chat IA",
    nav_history: "Historique",
    nav_settings: "Paramètres",
    nav_admin: "Admin",
    nav_ops: "Opérations",
    nav_system: "Système",
    // Topbar
    topbar_search_placeholder: "Rechercher alerte, IP, hash, technique MITRE…",
    topbar_model: "modèle",
    topbar_signout: "Déconnexion",
    // Status widget
    status_backend: "Backend opérationnel",
    // Home
    home_welcome: "Bienvenue",
    home_hello: "Bonjour",
    home_subtitle: "SOC Copilot est prêt. Commencez par le module dont vous avez besoin ou accédez au tableau de bord.",
    home_go_dashboard: "Tableau de bord",
    home_analyze_alert: "Analyser une alerte",
    home_modules: "Modules",
    home_available: "disponibles",
    // Tiles
    tile_alerts_title: "Explication d'alertes",
    tile_alerts_desc: "Collez une alerte et obtenez un triage structuré",
    tile_logs_title: "Logs",
    tile_logs_desc: "Analysez et filtrez les événements par hôte, IP, technique MITRE",
    tile_chat_title: "Chat IA",
    tile_chat_desc: "Discutez avec le copilote + RAG sur vos alertes",
    tile_history_title: "Historique",
    tile_history_desc: "Alertes précédentes et traçabilité des décisions",
    tile_dashboard_title: "Tableau de bord",
    tile_dashboard_desc: "Métriques en direct et couverture MITRE",
    tile_admin_title: "Administration",
    tile_admin_desc: "Gestion des utilisateurs, rôles et configuration globale",
    // Alerts page
    alerts_title: "Explication d'alertes",
    alerts_subtitle: "Collez un log ou une alerte. L'IA explique ce qui s'est passé, attribue un risque et mappe vers MITRE ATT&CK.",
    alerts_source_placeholder: "Source (auth.log, nginx, syslog…)",
    alerts_history_link: "Historique →",
    alerts_analyze_btn: "Analyser",
    alerts_analyzing_btn: "Analyse en cours…",
    alerts_summary: "Résumé",
    alerts_mitre: "MITRE ATT&CK",
    alerts_reasoning: "Raisonnement",
    alerts_next_step: "Étape suivante → recommander des actions",
    alerts_loading: "Vérification de la session…",
    alerts_error: "Erreur :",
    // Chat page
    chat_title: "Chat IA",
    chat_subtitle: "Mentor SOC avec RAG sur MITRE ATT&CK + OWASP Top 10.",
    chat_kb_unavailable: "KB indisponible",
    chat_kb_docs: "docs",
    chat_starters_label: "Commencez avec l'un de ceux-ci :",
    chat_you: "Vous",
    chat_mentor: "Mentor",
    chat_thinking: "Le mentor réfléchit…",
    chat_sources: "Sources citables :",
    chat_log_context_toggle: "contexte du log (optionnel)",
    chat_log_context_placeholder: "Collez ici un log ou une alerte pour que le mentor en tienne compte…",
    chat_input_placeholder: "Écrivez votre question…",
    chat_send_btn: "Envoyer",
    chat_back_alerts: "← Alertes",
    // History page
    history_title: "Historique",
    history_new_alert: "+ nouvelle alerte",
    history_loading: "Chargement…",
    history_empty: "Pas encore d'alertes. Commencez à",
    history_col_id: "#",
    history_col_date: "Date",
    history_col_source: "Source",
    history_col_summary: "Résumé",
    history_col_risk: "Risque",
    history_col_mitre: "MITRE",
    history_open: "ouvrir →",
    // Respond page
    respond_title: "Recommandeur d'étapes",
    respond_subtitle: "Actions concrètes pour cette alerte, avec justification pédagogique.",
    respond_no_alert: "Arrivez ici depuis une alerte. Commencez par analyser un log dans",
    respond_loading_alert: "Chargement de l'alerte",
    respond_recommend_btn: "Recommander des actions",
    respond_recommending_btn: "Génération des recommandations…",
    respond_another_btn: "Générer une autre recommandation",
    respond_recommendation: "Recommandation",
    respond_learning: "Mode apprentissage",
    respond_new_alert: "← nouvelle alerte",
    // Login page
    login_title: "SOC Copilot",
    login_subtitle: "Connectez-vous pour continuer.",
    login_register_subtitle: "Créez un compte. Le premier utilisateur est admin.",
    login_name: "Nom",
    login_level: "Niveau SOC",
    login_email: "Email",
    login_password: "Mot de passe",
    login_confirm_password: "Confirmer le mot de passe",
    login_btn: "Se connecter",
    login_register_btn: "Créer un compte",
    login_loading_btn: "…",
    login_switch_to_register: "Pas de compte ? Inscrivez-vous",
    login_switch_to_login: "J'ai déjà un compte",
    // Settings page
    settings_title: "Configuration IA",
    settings_subtitle: "Utilisez la clé partagée du projet (avec quota journalier) ou apportez la vôtre depuis Google AI Studio.",
    settings_default_model: "Modèle par défaut",
    settings_model_desc: "Utilisé dans les explications, recommandations et chat si vous n'en sélectionnez pas un autre explicitement.",
    settings_save_model: "Enregistrer le modèle",
    settings_api_key: "Votre clé API Gemini",
    // Profile page
    profile_title: "Mon Profil",
    profile_subtitle: "Modifiez vos informations personnelles. Le mot de passe et le rôle sont gérés depuis le panneau d'administration.",
    profile_name: "Nom",
    profile_lastname: "Prénom",
    profile_email: "Email",
    profile_save: "Enregistrer",
    profile_saving: "Enregistrement...",
    profile_discard: "Annuler",
    // Theme
    theme_dark: "Sombre",
    theme_light: "Clair",
  },
} as const;

export type TranslationKey = keyof typeof translations.es;

// ─── Context ──────────────────────────────────────────────────────────────────

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nCtx = createContext<I18nState | null>(null);

const STORAGE_KEY = "soc:locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && saved in translations) setLocaleState(saved);
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  const t = (key: TranslationKey): string =>
    (translations[locale] as Record<string, string>)[key] ??
    (translations.es as Record<string, string>)[key] ??
    key;

  return (
    <I18nCtx.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
