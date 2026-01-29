# Browserlet

## What This Is

Browserlet est une extension Chrome qui permet d'automatiser des interactions avec des applications web legacy (sans API) de manière déterministe, résiliente et maintenable. Contrairement aux solutions full-IA qui consomment des tokens à chaque exécution, Browserlet utilise l'IA uniquement en phase de création pour générer des scripts d'automatisation dans un méta-langage sémantique (BSL). L'exécution est ensuite 100% déterministe, rapide et sans coût récurrent.

## Core Value

**Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA** — Les sélecteurs sémantiques ciblent l'intention ("le bouton de validation") plutôt que la structure DOM fragile (`#btn-submit-x7`), rendant les scripts maintenables quand l'UI évolue.

## Requirements

### Validated

- Semantic Resolver validé par POC (17/17 tests, janvier 2026)

### Active

- [ ] Mode Recording : capturer les actions utilisateur et générer un script BSL via LLM
- [ ] Génération BSL : support Claude API et Ollama (configurable par l'utilisateur)
- [ ] Execution Engine : exécution déterministe des scripts BSL avec semantic resolution
- [ ] Semantic Resolver : résolution d'éléments par hints sémantiques (role, text, aria, etc.)
- [ ] Side Panel UI : affichage contexte, liste scripts, exécution, résultats
- [ ] Triggers contextuels : détection de contexte et suggestions d'actions
- [ ] Gestion auth basique : vérification session existante, prompt manuel si déconnecté
- [ ] Stockage local : sauvegarde scripts dans chrome.storage
- [ ] Import/Export YAML : partage de scripts via fichiers
- [ ] Actions BSL : click, type, select, extract, wait_for, navigate, scroll, hover
- [ ] Variables et paramètres : inputs configurables, outputs structurés
- [ ] Interface FR + EN : i18n dès v1

### Out of Scope

- Serveur central — Phase 2, après validation du MVP extension
- Self-healing (réparation auto des sélecteurs via IA) — v1.1, nécessite plus de données d'usage
- SSO complet (SAML, CAS, OIDC) — v1.1, auth basique suffisante pour valider le concept
- MFA automatique — v1.1, trop complexe pour MVP
- Credential store chiffré — v1.1, prompt manuel acceptable pour v1
- Scheduling (exécution programmée) — v2
- Webhooks — v2
- Support Firefox — Chrome uniquement (Manifest V3 stable)
- Version SaaS hébergée — AGPL-3.0 pur, self-hosted only

## Context

**Origine :** Projet LINAGORA pour automatiser des tâches répétitives sur applications métier legacy (ERP, SIRH) sans API exposée.

**POC validé :** Le Semantic Resolver a été testé avec Playwright sur pages locales et sites réels (Google, GitHub, Wikipedia). 17/17 tests passés, performance < 100ms, zéro faux positif.

**Leçons du POC :**
- Toujours combiner plusieurs hints (un seul n'est jamais suffisant)
- Privilégier hints explicites (aria_label, data_attribute, role) sur near_label
- Utiliser data_attribute pour éléments dans listes/tableaux
- Prévoir fallback_selector comme filet de sécurité

**Personas cibles :**
- Marie (gestionnaire) : exécute des scripts pré-configurés
- Thomas (intégrateur IT) : crée et maintient les scripts
- Sophie (DSI) : valide les cas d'usage, suit l'adoption

## Constraints

- **Plateforme** : Chrome Extension Manifest V3 uniquement — pas de fragmentation multi-navigateurs
- **Licence** : AGPL-3.0 — copyleft fort, pas de vendor lock-in
- **Offline-first** : fonctionne sans connexion serveur (scripts locaux)
- **Performance** : résolution sémantique < 50ms, exécution step < 100ms
- **Sécurité** : pas de credentials en clair, exécution uniquement sur URL autorisées
- **Stack** : TypeScript, Preact + Tailwind (UI légère), Monaco Editor (YAML)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IA en création uniquement | Évite coût récurrent, exécution déterministe et rapide | — Pending |
| YAML pour BSL | Lisible par non-dev, standard, commentable | — Pending |
| Chrome uniquement | Focus sur Manifest V3 stable, évite fragmentation | — Pending |
| Claude API + Ollama | Flexibilité : cloud pour qualité, local pour offline/privacy | — Pending |
| Pas de serveur v1 | Valider l'extension seule avant d'ajouter complexité | — Pending |
| Auth basique v1 | Session existante + prompt suffisant pour valider le concept | — Pending |

---
*Last updated: 2026-01-29 after initialization*
