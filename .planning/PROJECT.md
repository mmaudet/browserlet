# Browserlet

## What This Is

Browserlet est une extension Chrome qui permet d'automatiser des interactions avec des applications web legacy (sans API) de manière déterministe, résiliente et maintenable. Contrairement aux solutions full-IA qui consomment des tokens à chaque exécution, Browserlet utilise l'IA uniquement en phase de création pour générer des scripts d'automatisation dans un méta-langage sémantique (BSL). L'exécution est ensuite 100% déterministe, rapide et sans coût récurrent.

## Core Value

**Automatisation web résiliente pour applications legacy, sans coût récurrent d'IA** — Les sélecteurs sémantiques ciblent l'intention ("le bouton de validation") plutôt que la structure DOM fragile (`#btn-submit-x7`), rendant les scripts maintenables quand l'UI évolue.

## Current State (v1.0 Shipped)

**Shipped:** 2026-01-31
**Codebase:** 12,603 LOC TypeScript
**Tech Stack:** WXT, VanJS, Monaco Editor, Chrome Manifest V3

**What's Working:**
- Recording with 10 semantic hint types
- BSL playback with weighted semantic resolver
- LLM integration (Claude API + Ollama) with encrypted keys
- Contextual triggers (suggest + auto-execute modes)
- Side Panel UI with i18n (FR/EN)
- Cross-page navigation support

## Requirements

### Validated (v1.0)

- ✓ Mode Recording — v1.0 (capture actions, generate BSL via LLM)
- ✓ Génération BSL — v1.0 (Claude API + Ollama)
- ✓ Execution Engine — v1.0 (deterministic BSL playback)
- ✓ Semantic Resolver — v1.0 (10 hint types, 0.7 threshold)
- ✓ Side Panel UI — v1.0 (Monaco Editor, script list, results)
- ✓ Triggers contextuels — v1.0 (suggest mode, auto-execute)
- ✓ Gestion auth basique — v1.0 (session check, manual prompt)
- ✓ Stockage local — v1.0 (chrome.storage.local)
- ✓ Import/Export YAML — v1.0 (js-yaml, file-saver)
- ✓ Actions BSL — v1.0 (all 8 actions)
- ✓ Interface FR + EN — v1.0 (chrome.i18n)

### Active (Next Milestone)

- [ ] Self-healing selectors (LLM-assisted repair when selector fails)
- [ ] Execution replay (screenshots for debugging)
- [ ] Script version control
- [ ] User testing feedback integration

### Out of Scope

- Serveur central — v2, après validation terrain
- SSO complet (SAML, CAS, OIDC) — v1.1+
- MFA automatique — v1.1+
- Credential store chiffré — v1.1+
- Scheduling (exécution programmée) — v2
- Webhooks — v2
- Support Firefox — Chrome uniquement
- Version SaaS hébergée — AGPL-3.0 pur

## Context

**Origine :** Projet LINAGORA pour automatiser des tâches répétitives sur applications métier legacy (ERP, SIRH) sans API exposée.

**v1.0 Validated On:**
- Real legacy ERP (OBM - extranet.linagora.com)
- Google, GitHub, Wikipedia for semantic resolver
- macOS Chrome for cross-platform notification fix

**Personas cibles :**
- Marie (gestionnaire) : exécute des scripts pré-configurés
- Thomas (intégrateur IT) : crée et maintient les scripts
- Sophie (DSI) : valide les cas d'usage, suit l'adoption

## Constraints

- **Plateforme** : Chrome Extension Manifest V3 uniquement
- **Licence** : AGPL-3.0 — copyleft fort
- **Offline-first** : fonctionne sans serveur
- **Performance** : résolution < 50ms, step < 100ms
- **Sécurité** : API keys chiffrées (AES-GCM 256-bit)
- **Stack** : TypeScript, WXT, VanJS, Monaco Editor

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IA en création uniquement | Évite coût récurrent, exécution déterministe | ✓ Good |
| YAML pour BSL | Lisible par non-dev, standard, commentable | ✓ Good |
| Chrome uniquement | Focus Manifest V3, évite fragmentation | ✓ Good |
| Claude API + Ollama | Flexibilité cloud/local | ✓ Good |
| Pas de serveur v1 | Valider extension seule d'abord | ✓ Good |
| Auth basique v1 | Session + prompt suffisant pour MVP | ✓ Good |
| WXT framework | Auto-manifest, HMR, conventions | ✓ Good |
| VanJS for UI | Lightweight, no build step, reactive | ✓ Good |
| In-page notifications | Chrome buttons don't work on macOS | ✓ Good |
| 10 semantic hint types | Balances specificity and resilience | ✓ Good |
| 0.7 confidence threshold | Sweet spot for accuracy vs false negatives | ✓ Good |

---
*Last updated: 2026-01-31 after v1.0 milestone*
