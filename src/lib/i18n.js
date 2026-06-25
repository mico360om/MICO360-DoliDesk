import { useCallback } from 'react'
import { useSettings } from '../context/SettingsContext.jsx'

// Lightweight i18n. Translations cover the app chrome (navigation + common
// actions). Untranslated keys fall back to English, so new strings work
// immediately and locales can be filled in incrementally.

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية', rtl: true },
]

export const RTL_LANGS = new Set(['ar'])

const DICT = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.records': 'Records',
    'nav.modules': 'Modules',
    'nav.profiles': 'Profiles',
    'nav.settings': 'Settings',
    'action.refresh': 'Refresh',
    'action.search': 'Search',
    'action.export': 'Export CSV',
    'action.columns': 'Columns',
    'action.downloadPdf': 'Download PDF',
    'action.addProfile': 'Add profile',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.records': 'Enregistrements',
    'nav.modules': 'Modules',
    'nav.profiles': 'Profils',
    'nav.settings': 'Paramètres',
    'action.refresh': 'Actualiser',
    'action.search': 'Rechercher',
    'action.export': 'Exporter CSV',
    'action.columns': 'Colonnes',
    'action.downloadPdf': 'Télécharger le PDF',
    'action.addProfile': 'Ajouter un profil',
  },
  es: {
    'nav.dashboard': 'Panel',
    'nav.records': 'Registros',
    'nav.modules': 'Módulos',
    'nav.profiles': 'Perfiles',
    'nav.settings': 'Ajustes',
    'action.refresh': 'Actualizar',
    'action.search': 'Buscar',
    'action.export': 'Exportar CSV',
    'action.columns': 'Columnas',
    'action.downloadPdf': 'Descargar PDF',
    'action.addProfile': 'Añadir perfil',
  },
  de: {
    'nav.dashboard': 'Übersicht',
    'nav.records': 'Datensätze',
    'nav.modules': 'Module',
    'nav.profiles': 'Profile',
    'nav.settings': 'Einstellungen',
    'action.refresh': 'Aktualisieren',
    'action.search': 'Suchen',
    'action.export': 'CSV exportieren',
    'action.columns': 'Spalten',
    'action.downloadPdf': 'PDF herunterladen',
    'action.addProfile': 'Profil hinzufügen',
  },
  pt: {
    'nav.dashboard': 'Painel',
    'nav.records': 'Registos',
    'nav.modules': 'Módulos',
    'nav.profiles': 'Perfis',
    'nav.settings': 'Definições',
    'action.refresh': 'Atualizar',
    'action.search': 'Pesquisar',
    'action.export': 'Exportar CSV',
    'action.columns': 'Colunas',
    'action.downloadPdf': 'Baixar PDF',
    'action.addProfile': 'Adicionar perfil',
  },
  ar: {
    'nav.dashboard': 'لوحة التحكم',
    'nav.records': 'السجلات',
    'nav.modules': 'الوحدات',
    'nav.profiles': 'الملفات',
    'nav.settings': 'الإعدادات',
    'action.refresh': 'تحديث',
    'action.search': 'بحث',
    'action.export': 'تصدير CSV',
    'action.columns': 'الأعمدة',
    'action.downloadPdf': 'تنزيل PDF',
    'action.addProfile': 'إضافة ملف',
  },
}

export function translate(lang, key) {
  return (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key
}

// Hook returning a `t(key)` bound to the active language. Consumers re-render
// when the language setting changes (via SettingsContext).
export function useT() {
  const { settings } = useSettings()
  const lang = settings?.display?.language || 'en'
  return useCallback((key) => translate(lang, key), [lang])
}
