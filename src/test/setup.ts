import i18n from '@/i18n';

// I runner CI eseguono i test con browser language en-US: il rilevamento
// automatico sceglierebbe l'inglese e i18n.t() restituirebbe le traduzioni
// inglesi, facendo fallire i test che assertano le stringhe italiane.
void i18n.changeLanguage('it');
