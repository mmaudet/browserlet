# PRD — Browserlet
## Extension Chrome d'automatisation web sémantique

> **Browserlet** — Des scripts intelligents pour vos applications web
> 
> *Browserlet — Automatisation web sémantique, sans code*

**Version** : 0.3 - POC Validé  
**Date** : 29 janvier 2026  
**Auteur** : Michel-Marie / LINAGORA  
**Statut** : POC validé — Prêt pour développement  
**Licence** : AGPL-3.0  
**Plateforme** : Chrome (Manifest V3)

---

## 1. Vision & Contexte

### 1.1 Vision produit

**Browserlet** est une extension Chrome qui permet d'automatiser des interactions avec des applications web legacy (sans API) de manière **déterministe, résiliente et maintenable**.

> **Pourquoi "Browserlet" ?**  
> Le nom combine *Browser* (navigateur) et le suffixe *-let* (petit programme autonome), à l'image des *applets*, *servlets* ou *bookmarklets*. Un **browserlet** est un petit script intelligent qui s'exécute dans votre navigateur pour automatiser vos tâches.

Contrairement aux solutions full-IA (Claude in Chrome, Comet) qui interprètent chaque action en temps réel, Browserlet utilise l'IA **uniquement en phase de création** pour générer des scripts d'automatisation dans un méta-langage sémantique. L'exécution est ensuite **100% déterministe**, rapide et sans coût récurrent.

### 1.2 Positionnement

| Solution | Création | Exécution | Résilience UI | Coût runtime |
|----------|----------|-----------|---------------|--------------|
| Selenium/Playwright | Manuelle, technique | Déterministe | Faible (XPath fragiles) | Nul |
| Claude in Chrome / Comet | Naturelle | IA temps réel | Forte | Élevé (tokens) |
| RPA (UiPath, etc.) | Assistée | Déterministe | Moyenne | Licence |
| **Browserlet** | IA-assistée | Déterministe | Forte (sémantique) | Nul |

### 1.3 Principes directeurs

1. **IA en création, pas en exécution** — L'intelligence est capitalisée dans le script, pas consommée à chaque run
2. **Sélecteurs sémantiques** — Cibler "le bouton de validation" plutôt que `#btn-submit-x7`
3. **Human-readable** — Le méta-langage doit être lisible et éditable par un non-développeur
4. **Open source (AGPL-3.0)** — Code ouvert, pas de vendor lock-in, copyleft fort
5. **Offline-first** — Fonctionne sans connexion serveur (scripts locaux)
6. **Chrome uniquement** — Focus sur Manifest V3 stable, pas de fragmentation multi-navigateurs

---

## 2. Problèmes à résoudre

### 2.1 Pour les organisations

- **Applications legacy sans API** : ERP, SIRH, outils métier anciens où l'extraction de données nécessite du copier-coller manuel
- **Coût des solutions RPA** : Licences élevées pour des besoins simples
- **Fragilité des scripts classiques** : Maintenance constante quand l'UI change légèrement
- **Dépendance aux tokens IA** : Solutions full-IA coûteuses et lentes pour des tâches répétitives

### 2.2 Pour les utilisateurs

- **Tâches répétitives** : Aller chercher une donnée sur 3 écrans différents, 50 fois par jour
- **Pas de compétences techniques** : Ne sait pas écrire de code ou manipuler des XPath
- **Besoin de fiabilité** : Un script qui marche aujourd'hui doit marcher demain

---

## 3. Personas

### 3.1 Marie — Gestionnaire administrative (utilisatrice finale)

- **Contexte** : Travaille dans une collectivité, utilise 4 applications web différentes sans API
- **Douleur** : Passe 2h/jour à copier des données d'un système à l'autre
- **Besoin** : Automatiser l'extraction sans dépendre de l'IT
- **Usage Browserlet** : Exécute des scripts pré-configurés, édite parfois des paramètres simples

### 3.2 Thomas — Intégrateur IT (créateur de scripts)

- **Contexte** : Responsable des outils internes, profil technique mais pas développeur
- **Douleur** : Reçoit des demandes d'automatisation qu'il ne peut satisfaire sans dev lourd
- **Besoin** : Créer des scripts rapidement, les maintenir facilement
- **Usage Browserlet** : Enregistre des parcours, affine le méta-langage généré, déploie sur le serveur central

### 3.3 Sophie — DSI / Responsable digital (décideur)

- **Contexte** : Doit moderniser les processus sans budget pour refondre les applications legacy
- **Douleur** : ROI flou des solutions RPA, dépendance éditeur
- **Besoin** : Solution légère, open source, déployable rapidement
- **Usage Browserlet** : Valide les cas d'usage, suit les métriques d'adoption

---

## 4. Spécification du méta-langage — Browserlet Script Language (BSL)

### 4.1 Principes de conception

- **Format** : YAML (lisible, standard, commentable)
- **Sélecteurs sémantiques** : Basés sur l'intention, pas sur la structure DOM
- **Fallbacks en cascade** : Plusieurs stratégies de sélection, utilisées dans l'ordre
- **Variables et contexte** : Données extraites réutilisables dans le script
- **Pas de Turing-completeness** : Pas de boucles infinies possibles, exécution garantie finie

### 4.2 Structure d'un script

```yaml
# browserlet-script.bsl.yaml
metadata:
  name: "Extraction factures fournisseur"
  description: "Récupère le montant et la date de la dernière facture"
  version: "1.0"
  author: "Thomas"
  target_app: 
    name: "ERP Comptabilité"
    url_pattern: "https://erp.entreprise.fr/*"
  created_at: "2026-01-28"
  updated_at: "2026-01-28"

# Variables d'entrée (optionnelles, paramétrables à l'exécution)
inputs:
  - name: fournisseur_id
    type: string
    description: "Code fournisseur à rechercher"
    required: true

# Séquence d'actions
steps:
  - id: step_login
    action: wait_for
    target:
      intent: "page de connexion chargée"
      hints:
        - url_contains: "/login"
        - element_exists:
            role: "textbox"
            label_contains: "identifiant"
    timeout: 10s

  - id: step_search
    action: type
    target:
      intent: "champ de recherche fournisseur"
      hints:
        - role: "searchbox"
        - role: "textbox"
          near_text: "Rechercher"
        - placeholder_contains: "fournisseur"
      fallback_selector: "input[name='supplier_search']"
    value: "{{inputs.fournisseur_id}}"

  - id: step_submit_search
    action: click
    target:
      intent: "lancer la recherche"
      hints:
        - role: "button"
          near_element: "{{step_search.target}}"
        - text_matches: "Rechercher|Chercher|OK"
        - aria_label_contains: "search"
      fallback_selector: "button[type='submit']"

  - id: step_wait_results
    action: wait_for
    target:
      intent: "résultats de recherche affichés"
      hints:
        - element_exists:
            role: "table"
        - element_exists:
            selector: ".results-list"
        - text_appears: "résultat"
    timeout: 15s

  - id: step_click_first_result
    action: click
    target:
      intent: "premier résultat de la liste"
      hints:
        - role: "row"
          index: 1
        - role: "link"
          within: "table"
          index: 0

  - id: step_extract_amount
    action: extract
    target:
      intent: "montant de la facture"
      hints:
        - near_label: "Montant|Total|Amount"
        - pattern: "\\d+[,.]\\d{2}\\s*€"
        - role: "cell"
          column_header_contains: "Montant"
    output:
      variable: facture_montant
      transform: parse_currency

  - id: step_extract_date
    action: extract
    target:
      intent: "date de la facture"
      hints:
        - near_label: "Date"
        - pattern: "\\d{2}/\\d{2}/\\d{4}"
    output:
      variable: facture_date
      transform: parse_date_fr

# Sortie structurée
outputs:
  - name: montant
    value: "{{facture_montant}}"
  - name: date
    value: "{{facture_date}}"
  - name: fournisseur
    value: "{{inputs.fournisseur_id}}"
```

### 4.3 Primitives d'action

| Action | Description | Paramètres clés |
|--------|-------------|-----------------|
| `click` | Clic sur un élément | `target`, `button` (left/right) |
| `type` | Saisie de texte | `target`, `value`, `clear_before` |
| `select` | Sélection dans dropdown | `target`, `option` (by text/value/index) |
| `extract` | Extraction de donnée | `target`, `output.variable`, `output.transform` |
| `wait_for` | Attente d'un état | `target`, `timeout` |
| `navigate` | Navigation URL | `url` |
| `scroll` | Scroll vers élément | `target`, `direction` |
| `hover` | Survol | `target` |
| `screenshot` | Capture d'écran | `output.variable` |
| `condition` | Branchement conditionnel | `if`, `then`, `else` |
| `loop` | Itération (bornée) | `over`, `max_iterations`, `steps` |

### 4.4 Système de sélection sémantique (Semantic Target Resolution)

L'ordre de résolution pour trouver un élément :

```
1. Hints sémantiques (évalués dans l'ordre, score de confiance)
   ├── role (ARIA role)
   ├── text_matches / text_contains
   ├── near_label / near_text (proximité visuelle)
   ├── placeholder_contains
   ├── aria_label_contains
   ├── pattern (regex sur le contenu)
   └── column_header_contains (pour tables)
   
2. Si score < seuil → fallback_selector (CSS/XPath classique)

3. Si toujours pas trouvé → erreur (ou self-healing si activé)
```

**Algorithme de scoring** :
- Chaque hint matché ajoute des points
- Certains hints sont "bloquants" (le role doit matcher)
- L'élément avec le meilleur score est sélectionné
- Seuil configurable (défaut: 0.7)

#### 4.4.1 Validation POC — Résultats et leçons apprises

> **POC réalisé le 29 janvier 2026** — 17 tests E2E automatisés (Playwright)  
> **Résultat : 100% de succès** après ajustements  
> **Verdict : GO**

Le Semantic Resolver a été validé sur :
- **Pages locales** : formulaires, boutons multiples, navigation, icônes ARIA, data-testid, fallback CSS
- **Sites réels** : Google, GitHub, Wikipedia
- **Performance** : < 50ms (simple), < 100ms (complexe)
- **Robustesse** : zéro faux positif

##### Corrections appliquées pendant le POC

| Test | Problème initial | Solution retenue |
|------|------------------|------------------|
| TC-004 (multi-boutons) | `near_label` inefficace dans un tableau (cellules DOM séparées) | Utiliser `data_attribute` quand disponible |
| TC-013 (GitHub Sign in) | `text_matches` strict confondait "Sign in" et "Sign in with passkey" | Combiner `text_contains` + `class_contains` pour discriminer |

##### Bonnes pratiques validées

1. **Toujours combiner plusieurs hints** — Un seul hint n'est jamais suffisant sur les sites réels
2. **Privilégier les hints explicites** — `aria_label`, `data_attribute`, `role` sont plus fiables que `near_label`
3. **Utiliser `data_attribute` pour les listes/tableaux** — Plus robuste que la proximité textuelle
4. **Prévoir un fallback_selector** — Filet de sécurité pour les cas difficiles
5. **Tester sur sites réels** — Les pages locales ne révèlent pas tous les edge cases

##### Fiabilité des hints (classement par robustesse)

| Rang | Hint | Fiabilité | Notes |
|------|------|-----------|-------|
| 🥇 | `data_attribute` (testid, action) | Très haute | Quand disponible, c'est le plus fiable |
| 🥇 | `role` | Très haute | Standard ARIA, stable |
| 🥇 | `type` (input/button) | Très haute | Attribut HTML natif |
| 🥈 | `aria_label` | Haute | Dépend de l'accessibilité du site |
| 🥈 | `name` | Haute | Stable mais pas toujours présent |
| 🥈 | `text_contains` | Haute | Attention aux textes similaires |
| 🥉 | `text_matches` (regex) | Moyenne | Puissant mais peut être trop strict |
| 🥉 | `placeholder_contains` | Moyenne | Pas toujours présent |
| ⚠️ | `near_label` | Variable | Échoue dans structures tabulaires |
| ⚠️ | `class_contains` | Variable | Classes CSS souvent minifiées |

##### Patterns recommandés par type d'élément

**Bouton d'action (submit, CTA)**
```yaml
target:
  intent: "bouton de validation"
  hints:
    - role: button
    - type: submit                    # Discriminant fort
    - text_contains: "Valider"        # Texte visible
    - aria_label: "Valider le formulaire"  # Accessibilité
  fallback_selector: "button[type='submit']"
```

**Champ de formulaire**
```yaml
target:
  intent: "champ email"
  hints:
    - type: email                     # Type HTML natif
    - name: email                     # Attribut name
    - placeholder_contains: "email"   # Indice visuel
  fallback_selector: "input[type='email']"
```

**Élément dans un tableau/liste**
```yaml
target:
  intent: "bouton supprimer de la ligne Item B"
  hints:
    - role: button
    - text_contains: "Supprimer"
    - data_attribute:                 # ✅ Plus fiable que near_label
        name: "item"
        value: "B"
  fallback_selector: "tr:has(td:contains('Item B')) button.delete"
```

**Élément icône (sans texte visible)**
```yaml
target:
  intent: "bouton fermer la modal"
  hints:
    - role: button
    - aria_label: "Fermer"            # ✅ Seul indice textuel
    - class_contains: "close"         # Indice secondaire
  fallback_selector: "[aria-label='Fermer'], .modal-close"
```

**Champ de recherche**
```yaml
target:
  intent: "barre de recherche"
  hints:
    - role: searchbox                 # Rôle ARIA spécifique
    - type: search                    # Type HTML5
    - name: "q"                       # Convention courante
    - placeholder_contains: "Rechercher"
  fallback_selector: "input[type='search'], input[name='q']"
```

##### Pièges à éviter

| ❌ Ne pas faire | ✅ Faire plutôt |
|-----------------|-----------------|
| Un seul hint `text_contains` | Combiner role + text + type |
| `text_matches: "^Sign in$"` trop strict | `text_contains: "Sign in"` + hint discriminant |
| `near_label` dans un tableau | `data_attribute` ou `parent_contains` |
| Compter sur les classes CSS minifiées | Utiliser `aria_label` ou `data_attribute` |
| Fallback trop générique (`button`) | Fallback contextuel (`form#login button[type='submit']`) |

### 4.5 Déclencheurs contextuels (Context Triggers)

Fonctionnalité clé : l'extension peut **reconnaître un contexte** (page, écran, état) et **proposer ou déclencher automatiquement** des actions.

#### 4.5.1 Structure d'un trigger

```yaml
triggers:
  - id: trigger_facture_ouverte
    name: "Facture détectée"
    description: "Propose d'extraire les données quand une facture est affichée"
    
    # Conditions de déclenchement (toutes doivent être vraies)
    conditions:
      - type: url
        pattern: "https://erp.entreprise.fr/invoices/*"
      
      - type: element_exists
        target:
          intent: "numéro de facture visible"
          hints:
            - text_matches: "Facture\\s+N°\\s*\\d+"
            - near_label: "Numéro"
      
      - type: element_exists
        target:
          intent: "montant affiché"
          hints:
            - pattern: "\\d+[,.]\\d{2}\\s*€"
            - near_label: "Total|Montant"
    
    # Comportement quand les conditions sont remplies
    behavior:
      mode: suggest  # suggest | auto_execute | silent_extract
      
      # Si suggest: ce qui est proposé à l'utilisateur
      suggestion:
        title: "📄 Facture détectée"
        description: "Extraire les données de cette facture ?"
        actions:
          - label: "Extraire"
            script: "extraction_facture"  # Référence à un script BSL
            params_from_context:
              - facture_numero: "{{detected.facture_numero}}"
          - label: "Extraire et envoyer vers ERP"
            script: "extraction_et_sync_erp"
      
      # Si auto_execute: exécuter directement (avec notification)
      auto_script: "extraction_facture"
      notify_on_complete: true
      
      # Si silent_extract: extraire sans UI, stocker pour plus tard
      silent_extract:
        variables:
          - name: facture_numero
            target: { hints: [...] }
          - name: montant
            target: { hints: [...] }
        store_in: "context_data"  # Accessible aux scripts suivants
    
    # Limites pour éviter le spam
    cooldown: 30s  # Ne pas re-déclencher avant 30s sur la même page
    max_per_session: 10
```

#### 4.5.2 Modes de déclenchement

| Mode | Description | UX | Cas d'usage |
|------|-------------|-----|-------------|
| `suggest` | Propose une action dans le Side Panel | Non-intrusif, user confirme | Extraction ponctuelle |
| `auto_execute` | Exécute automatiquement + notification | Petit toast de confirmation | Tâches répétitives validées |
| `silent_extract` | Extrait en arrière-plan, stocke | Invisible, icône badge | Collecte passive de contexte |

#### 4.5.3 Détection de contexte avancée

L'extension maintient un **Context State** mis à jour en continu :

```yaml
context_state:
  current_url: "https://erp.entreprise.fr/invoices/12345"
  page_title: "Facture N° 12345 - ERP Compta"
  
  # Éléments détectés sur la page (via triggers passifs)
  detected_entities:
    - type: invoice_number
      value: "12345"
      confidence: 0.95
      location: { selector: "h1.invoice-title" }
    
    - type: currency_amount
      value: 1234.56
      confidence: 0.90
      location: { near_label: "Total TTC" }
    
    - type: date
      value: "2026-01-15"
      confidence: 0.85
      format: "DD/MM/YYYY"
  
  # Historique de navigation récent (pour patterns multi-pages)
  navigation_history:
    - url: "https://erp.entreprise.fr/suppliers/456"
      timestamp: "2026-01-28T14:30:00"
      detected: { supplier_name: "Acme Corp" }
    - url: "https://erp.entreprise.fr/invoices/12345"
      timestamp: "2026-01-28T14:30:15"
      detected: { ... }
```

#### 4.5.4 Triggers multi-pages (workflows contextuels)

```yaml
triggers:
  - id: trigger_workflow_commande
    name: "Workflow commande complète"
    
    # Séquence de contextes à détecter
    sequence:
      - step: supplier_selected
        conditions:
          - type: url
            pattern: "*/suppliers/*"
          - type: element_exists
            target: { hints: [{ role: "heading", text_contains: "Fournisseur" }] }
        extract:
          - supplier_id
          - supplier_name
        timeout: 5m  # Fenêtre pour passer à l'étape suivante
      
      - step: invoice_opened
        conditions:
          - type: url
            pattern: "*/invoices/*"
        extract:
          - invoice_number
          - amount
    
    # Déclenché quand toute la séquence est complétée
    on_complete:
      mode: suggest
      suggestion:
        title: "🔗 Commande complète détectée"
        description: "Fournisseur {{supplier_name}} - Facture {{invoice_number}}"
        actions:
          - label: "Créer l'écriture comptable"
            script: "creation_ecriture"
            params_from_context:
              - supplier_id
              - invoice_number
              - amount
```

### 4.6 Gestion de l'authentification

Browserlet doit gérer les différents scénarios d'authentification des applications d'entreprise sans stocker de credentials en clair.

#### 4.6.1 Stratégies d'authentification

```yaml
auth:
  # Stratégie principale
  strategy: stored_session | manual_login | oidc_flow | sso_passthrough
  
  # Vérification de session active
  session_check:
    indicator:
      intent: "élément visible uniquement si connecté"
      hints:
        - text_contains: "Déconnexion"
        - role: button
          text_contains: "Mon compte"
    # OU vérifier l'absence d'un élément de login
    absence_indicator:
      intent: "formulaire de connexion"
      hints:
        - role: form
          has_field: "password"
  
  # Action si non connecté
  on_unauthenticated: prompt | auto_login | abort
  
  # Timeout d'attente authentification manuelle
  manual_timeout: 120s
```

#### 4.6.2 Stratégie `stored_session` (par défaut)

Réutilise la session active du navigateur (cookies). C'est le mode le plus simple et le plus courant.

```yaml
auth:
  strategy: stored_session
  session_check:
    indicator:
      hints:
        - selector: "[data-testid='user-menu']"
        - text_contains: "Bienvenue"
  on_unauthenticated: prompt  # Demande à l'user de se connecter manuellement
```

**Comportement :**
1. Script démarre
2. Vérifie `session_check.indicator`
3. Si présent → continue l'exécution
4. Si absent → selon `on_unauthenticated` :
   - `prompt` : Affiche "Veuillez vous connecter" dans le Side Panel, attend
   - `abort` : Arrête avec erreur `AUTH_REQUIRED`

#### 4.6.3 Stratégie `manual_login` (formulaire classique)

Pour les applications avec formulaire login/password classique. Browserlet peut pré-remplir les champs mais **ne stocke jamais les mots de passe en clair**.

```yaml
auth:
  strategy: manual_login
  
  login_form:
    url: "https://erp.entreprise.fr/login"
    
    username_field:
      intent: "champ identifiant"
      hints:
        - name: username
        - placeholder_contains: "Identifiant"
        - type: text
          near_label: "Login"
    
    password_field:
      intent: "champ mot de passe"
      hints:
        - type: password
        - name: password
    
    submit_button:
      intent: "bouton de connexion"
      hints:
        - type: submit
        - text_matches: "^(Connexion|Se connecter|Login)$"
  
  credentials:
    # Option 1 : Prompt à chaque fois
    source: prompt
    
    # Option 2 : Référence au credential store sécurisé de l'extension
    # (chiffré avec clé dérivée du master password utilisateur)
    source: credential_store
    credential_id: "erp-entreprise-thomas"
    
    # Option 3 : Variable d'environnement (pour CI/automation)
    source: env
    username_var: "ERP_USERNAME"
    password_var: "ERP_PASSWORD"
  
  # Vérification post-login
  success_indicator:
    intent: "page d'accueil connecté"
    hints:
      - url_contains: "/dashboard"
      - text_contains: "Tableau de bord"
  
  error_indicator:
    intent: "message d'erreur login"
    hints:
      - class_contains: "error"
        text_contains: "incorrect"
```

#### 4.6.4 Stratégie `sso_passthrough` (SAML, CAS, ADFS)

Pour les SSO d'entreprise qui redirigent vers un IdP externe puis reviennent sur l'application.

```yaml
auth:
  strategy: sso_passthrough
  
  sso_config:
    # Type de SSO (informatif)
    type: saml | cas | adfs | custom
    
    # Pattern URL de l'IdP (pour détecter qu'on est sur la mire SSO)
    idp_url_pattern: "https://sso.entreprise.fr/*"
    
    # Pattern URL de retour (pour détecter que l'auth est terminée)
    return_url_pattern: "https://erp.entreprise.fr/*"
    
    # L'extension NE gère PAS l'authentification sur l'IdP
    # Elle attend simplement que l'utilisateur s'authentifie
    behavior: wait_for_return
    
    # Timeout d'attente (l'utilisateur doit s'authentifier)
    timeout: 180s
  
  session_check:
    indicator:
      hints:
        - text_contains: "Déconnexion"
```

**Comportement :**
1. Script navigue vers l'application
2. Application redirige vers IdP SSO
3. Browserlet détecte l'URL IdP → affiche "Authentification SSO requise" dans Side Panel
4. Utilisateur s'authentifie normalement (peut inclure MFA)
5. IdP redirige vers l'application
6. Browserlet détecte le retour → vérifie `session_check` → continue

#### 4.6.5 Stratégie `oidc_flow` (OAuth2 / OpenID Connect)

Pour les applications utilisant OIDC (Keycloak, LemonLDAP, Azure AD, etc.).

```yaml
auth:
  strategy: oidc_flow
  
  oidc_config:
    # Détection du redirect vers authorize
    authorize_url_pattern: "*/authorize*"
    
    # Détection du callback
    callback_url_pattern: "*/callback*"
    
    # Provider connu (optionnel, aide à la détection)
    provider: keycloak | lemonldap | azure_ad | generic
    
    # Comportement
    behavior: wait_for_callback
    
    # Timeout
    timeout: 180s
  
  # Si l'app a un bouton "Se connecter avec SSO"
  login_trigger:
    intent: "bouton connexion OIDC"
    hints:
      - text_matches: "(Se connecter|Login|Connexion)"
      - text_contains: "SSO"
```

**Comportement :**
1. Script clique sur le bouton de login (si `login_trigger` défini)
2. Application redirige vers `authorize_url_pattern`
3. Browserlet affiche "Authentification OIDC en cours" dans Side Panel
4. Utilisateur s'authentifie sur l'IdP
5. Callback vers l'application
6. Browserlet détecte le callback → continue l'exécution

#### 4.6.6 Gestion du MFA / 2FA

Le MFA est géré en mode **pause + prompt** car Browserlet ne peut pas (et ne doit pas) automatiser les seconds facteurs.

```yaml
auth:
  strategy: manual_login  # ou autre
  
  mfa:
    enabled: true
    
    # Détection de la page MFA
    mfa_page_indicator:
      intent: "page de vérification 2FA"
      hints:
        - text_contains: "code de vérification"
        - text_contains: "authentification à deux facteurs"
        - placeholder_contains: "Code OTP"
    
    # Types supportés (informatif pour l'UI)
    supported_types:
      - otp      # Google Authenticator, etc.
      - sms     # Code par SMS
      - push    # Notification push
      - email   # Code par email
    
    # Message affiché à l'utilisateur
    prompt_message: "Entrez votre code 2FA puis cliquez sur Continuer"
    
    # Timeout d'attente MFA
    timeout: 120s
    
    # Bouton pour signaler que le MFA est fait
    # (Browserlet ajoute un bouton "Continuer" dans le Side Panel)
    continue_trigger: side_panel_button
```

**Comportement :**
1. Login réussi → page MFA détectée
2. Side Panel affiche : "🔐 Vérification 2FA requise"
3. Utilisateur entre son code et valide sur la page
4. Utilisateur clique "Continuer" dans le Side Panel (ou auto-détection si possible)
5. Script reprend

#### 4.6.7 Gestion des sessions expirées

Si la session expire **pendant** l'exécution d'un script :

```yaml
auth:
  # ... config principale ...
  
  session_recovery:
    enabled: true
    
    # Détecter une redirection vers login en cours d'exécution
    session_expired_indicator:
      - url_contains: "/login"
      - url_contains: "/session-expired"
      - text_contains: "Session expirée"
      - text_contains: "Veuillez vous reconnecter"
    
    # Comportement
    on_session_expired: pause_and_prompt | auto_reauth | abort
    
    # Si auto_reauth et credentials stockés → ré-exécute le flow auth
    # Puis reprend le script au step où il était
    resume_strategy: retry_current_step | restart_script
```

#### 4.6.8 Credential Store sécurisé

Browserlet peut stocker des credentials de manière sécurisée (optionnel, opt-in utilisateur) :

```
┌─────────────────────────────────────────────────────────────┐
│                    CREDENTIAL STORE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Chiffrement AES-256-GCM                                  │
│  • Clé dérivée du Master Password utilisateur (PBKDF2)      │
│  • Stocké dans chrome.storage.local (chiffré)               │
│  • Master Password JAMAIS stocké                            │
│  • Déverrouillage par session (timeout configurable)        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  credential_id     │  username  │  app_url          │    │
│  │  ─────────────     │  ────────  │  ───────          │    │
│  │  erp-entreprise    │  thomas    │  erp.entre...     │    │
│  │  sirh-rh           │  t.durand  │  sirh.corp...     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ⚠️  Le mot de passe est chiffré, pas visible              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.6.9 Flux d'authentification — Diagramme

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Script démarre                                                             │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐                                                            │
│  │ Vérifier    │                                                            │
│  │ session     │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│    ┌────┴────┐                                                              │
│    │         │                                                              │
│   OUI       NON                                                             │
│    │         │                                                              │
│    ▼         ▼                                                              │
│ ┌──────┐  ┌──────────────────┐                                              │
│ │Script│  │ Quelle stratégie?│                                              │
│ │ run  │  └────────┬─────────┘                                              │
│ └──────┘           │                                                        │
│              ┌─────┼─────┬─────────┬──────────┐                              │
│              │     │     │         │          │                             │
│              ▼     ▼     ▼         ▼          ▼                             │
│         ┌───────┐ ┌────┐ ┌─────┐ ┌──────┐ ┌──────┐                          │
│         │stored │ │man.│ │ sso │ │ oidc │ │abort │                          │
│         │session│ │login│ │pass │ │ flow │ │      │                         │
│         └───┬───┘ └──┬─┘ └──┬──┘ └──┬───┘ └──┬───┘                          │
│             │        │      │       │        │                              │
│             ▼        ▼      ▼       ▼        ▼                              │
│         ┌──────┐ ┌──────┐ ┌─────┐ ┌─────┐ ┌─────┐                           │
│         │Prompt│ │Form  │ │Wait │ │Wait │ │Error│                           │
│         │user  │ │login │ │ IdP │ │CallB│ │exit │                           │
│         └──┬───┘ └──┬───┘ └──┬──┘ └──┬──┘ └─────┘                           │
│            │        │        │       │                                      │
│            │        ▼        │       │                                      │
│            │   ┌─────────┐   │       │                                      │
│            │   │  MFA ?  │   │       │                                      │
│            │   └────┬────┘   │       │                                      │
│            │   OUI  │  NON   │       │                                      │
│            │    │   │   │    │       │                                      │
│            │    ▼   │   │    │       │                                      │
│            │ ┌─────┐│   │    │       │                                      │
│            │ │Pause││   │    │       │                                      │
│            │ │+OTP ││   │    │       │                                      │
│            │ └──┬──┘│   │    │       │                                      │
│            │    │   │   │    │       │                                      │
│            └────┴───┴───┴────┴───────┘                                      │
│                        │                                                    │
│                        ▼                                                    │
│                  ┌──────────┐                                               │
│                  │ Session  │                                               │
│                  │ active   │                                               │
│                  └────┬─────┘                                               │
│                       │                                                     │
│                       ▼                                                     │
│                  ┌──────────┐                                               │
│                  │  Script  │                                               │
│                  │   run    │                                               │
│                  └──────────┘                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Transformations de données

Fonctions built-in pour normaliser les données extraites :

| Transform | Description | Exemple |
|-----------|-------------|---------|
| `trim` | Supprime espaces | `"  hello  "` → `"hello"` |
| `parse_currency` | Parse montant | `"1 234,56 €"` → `1234.56` |
| `parse_date_fr` | Parse date FR | `"28/01/2026"` → `"2026-01-28"` |
| `parse_date_iso` | Parse date ISO | Direct |
| `regex_extract` | Extraction regex | Pattern avec groupe |
| `to_uppercase` | Majuscules | — |
| `to_lowercase` | Minuscules | — |
| `split` | Découpe string | Séparateur |

---

## 5. Architecture fonctionnelle

### 5.1 Composants de l'extension

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NAVIGATEUR CHROME                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────┐  ┌──────────────────────────┐  │
│  │              PAGE WEB                        │  │      SIDE PANEL          │  │
│  │                                              │  │      (Browserlet)          │  │
│  │                                              │  │                          │  │
│  │    ┌─────────────────────────────────┐      │  │  ┌────────────────────┐  │  │
│  │    │                                 │      │  │  │ 🔍 Contexte actuel │  │  │
│  │    │        Application cible        │      │  │  │                    │  │  │
│  │    │           (ERP, etc.)           │      │  │  │ Page: Facture #123 │  │  │
│  │    │                                 │      │  │  │ Détecté:           │  │  │
│  │    │                                 │      │  │  │ • Montant: 1234€   │  │  │
│  │    │   ┌───────────────────────┐     │      │  │  │ • Date: 28/01/26   │  │  │
│  │    │   │ Élément surligné      │◄────┼──────┼──┼──┤                    │  │  │
│  │    │   │ pendant exécution     │     │      │  │  └────────────────────┘  │  │
│  │    │   └───────────────────────┘     │      │  │                          │  │
│  │    │                                 │      │  │  ┌────────────────────┐  │  │
│  │    └─────────────────────────────────┘      │  │  │ 💡 Actions suggérées│  │  │
│  │                                              │  │  │                    │  │  │
│  │         ┌──────────────────┐                │  │  │ [Extraire facture] │  │  │
│  │         │  Content Script  │                │  │  │ [Envoyer vers ERP] │  │  │
│  │         │  • DOM Observer  │                │  │  │                    │  │  │
│  │         │  • Event Capture │                │  │  └────────────────────┘  │  │
│  │         │  • Highlighter   │                │  │                          │  │
│  │         └──────────────────┘                │  │  ┌────────────────────┐  │  │
│  │                                              │  │  │ 📜 Mes scripts     │  │  │
│  └─────────────────────────────────────────────┘  │  │                    │  │  │
│                                                    │  │ • Extraction fact. │  │  │
│  ┌─────────────────────────────────────────────┐  │  │ • Sync fournisseur │  │  │
│  │            SERVICE WORKER                    │  │  │ • Export données   │  │  │
│  │                                              │  │  │                    │  │  │
│  │  • Script Engine    • Trigger Engine        │  │  │ [+ Nouveau script] │  │  │
│  │  • Context Manager  • Storage Sync          │  │  └────────────────────┘  │  │
│  │  • Semantic Resolver                        │  │                          │  │
│  └─────────────────────────────────────────────┘  │  ┌────────────────────┐  │  │
│                                                    │  │ ⚙️ [Rec] [Settings]│  │  │
│                                                    │  └────────────────────┘  │  │
│                                                    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 UX du Side Panel

#### 5.2.1 Zones du panneau

Le Side Panel est divisé en **4 zones** principales :

```
┌─────────────────────────────────┐
│  HEADER                         │
│  Logo + Status connexion        │
├─────────────────────────────────┤
│  ZONE 1 : CONTEXTE              │
│  ─────────────────              │
│  Affiche en temps réel :        │
│  • URL / App détectée           │
│  • Entités reconnues            │
│  • État d'authentification      │
│  Mise à jour live via           │
│  Content Script                 │
├─────────────────────────────────┤
│  ZONE 2 : SUGGESTIONS           │
│  ─────────────────              │
│  Actions proposées par les      │
│  triggers contextuels           │
│  • Apparaît/disparaît selon     │
│    le contexte                  │
│  • Boutons d'action directs     │
├─────────────────────────────────┤
│  ZONE 3 : SCRIPTS               │
│  ─────────────────              │
│  • Liste des scripts            │
│    (locaux + serveur)           │
│  • Filtre par app/tag           │
│  • Bouton exécuter              │
│  • Indicateur "compatible       │
│    avec page actuelle"          │
├─────────────────────────────────┤
│  ZONE 4 : EXÉCUTION / OUTPUT    │
│  ─────────────────              │
│  Pendant exécution :            │
│  • Step en cours                │
│  • Progress bar                 │
│  • Bouton Stop                  │
│                                 │
│  Après exécution :              │
│  • Données extraites            │
│  • Boutons Copy/Export          │
│  • Historique récent            │
├─────────────────────────────────┤
│  FOOTER                         │
│  [● Rec] [Paramètres] [?]       │
└─────────────────────────────────┘
```

#### 5.2.2 États du panneau

| État | Affichage | Trigger |
|------|-----------|---------|
| **Idle** | Contexte + Scripts | Page sans trigger actif |
| **Suggestion** | Contexte + **Suggestions mises en avant** + Scripts | Trigger détecté |
| **Recording** | Mode enregistrement plein panneau | User clique "Rec" |
| **Executing** | Progress + logs en temps réel | Script en cours |
| **Authenticating** | Message auth + instructions + bouton Continuer | Session requise / SSO / MFA détecté |
| **Results** | Données extraites + actions | Fin d'exécution |
| **Editing** | Éditeur YAML intégré | User édite un script |

#### 5.2.3 Interactions clés

**Highlight bidirectionnel** :
- Hover sur un élément détecté dans le panneau → highlight sur la page
- Pendant recording : éléments cliqués highlightés + affichés dans le panneau
- Pendant exécution : élément en cours d'action surligné

**Notifications non-intrusives** :
- Badge sur l'icône extension quand suggestion disponible
- Petit toast en bas du panneau (pas de popup système)
- Son optionnel (désactivable)

#### 5.2.4 Mode Recording (enregistrement)

```
┌─────────────────────────────────┐
│  ● ENREGISTREMENT EN COURS      │
│  ═══════════════════════════    │
│                                 │
│  00:45  ⏱️                       │
│                                 │
│  Actions capturées :            │
│  ─────────────────              │
│  1. ✓ Navigation vers           │
│     /invoices/list              │
│                                 │
│  2. ✓ Click sur                 │
│     "Rechercher" (button)       │
│                                 │
│  3. ✓ Type dans                 │
│     champ recherche             │
│     → "ACME"                    │
│                                 │
│  4. ● En attente...             │
│                                 │
│                                 │
│  ┌─────────┐  ┌───────────────┐ │
│  │ ⏹ Stop  │  │ ✗ Annuler     │ │
│  └─────────┘  └───────────────┘ │
│                                 │
│  Astuce: Naviguez normalement,  │
│  vos actions sont capturées.    │
└─────────────────────────────────┘
```

#### 5.2.5 Mode Exécution

```
┌─────────────────────────────────┐
│  ▶ EXÉCUTION                    │
│  ═══════════════                │
│                                 │
│  Script: Extraction facture     │
│                                 │
│  ████████████░░░░░░  Step 3/5   │
│                                 │
│  ✓ Navigation OK                │
│  ✓ Recherche fournisseur        │
│  ● Extraction montant...        │
│  ○ Extraction date              │
│  ○ Finalisation                 │
│                                 │
│  ┌─────────────────────────────┐│
│  │ 👁 Voir sur la page         ││
│  │ Élément: .invoice-total     ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │        ⏹ ARRÊTER            ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

#### 5.2.6 Affichage des résultats

```
┌─────────────────────────────────┐
│  ✓ EXTRACTION TERMINÉE          │
│  ═══════════════════            │
│                                 │
│  Durée: 3.2s                    │
│                                 │
│  Données extraites :            │
│  ┌─────────────────────────────┐│
│  │ {                           ││
│  │   "fournisseur": "ACME",    ││
│  │   "montant": 1234.56,       ││
│  │   "date": "2026-01-28",     ││
│  │   "numero": "FAC-2026-0042" ││
│  │ }                           ││
│  └─────────────────────────────┘│
│                                 │
│  ┌────────┐ ┌────────┐ ┌──────┐ │
│  │📋 JSON │ │📊 CSV  │ │↗ Send│ │
│  └────────┘ └────────┘ └──────┘ │
│                                 │
│  ┌─────────────────────────────┐│
│  │     ▶ Exécuter à nouveau    ││
│  └─────────────────────────────┘│
│                                 │
│  ─────────────────────────────  │
│  Historique récent              │
│  • 14:32 - Extraction OK        │
│  • 14:28 - Extraction OK        │
│  • 14:15 - Erreur step 3        │
└─────────────────────────────────┘
```

#### 5.2.7 États d'authentification

**Connexion requise (session absente)**
```
┌─────────────────────────────────┐
│  🔐 CONNEXION REQUISE           │
│  ═══════════════════            │
│                                 │
│  Script: Extraction facture     │
│                                 │
│  ┌─────────────────────────────┐│
│  │                             ││
│  │  ⚠️ Vous n'êtes pas         ││
│  │  connecté à l'application.  ││
│  │                             ││
│  │  Veuillez vous identifier   ││
│  │  sur la page, puis cliquez  ││
│  │  sur "Continuer".           ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │       ▶ Continuer           ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │       ✗ Annuler             ││
│  └─────────────────────────────┘│
│                                 │
│  ⏱ Timeout: 1:58               │
└─────────────────────────────────┘
```

**SSO en cours (redirection IdP)**
```
┌─────────────────────────────────┐
│  🔐 AUTHENTIFICATION SSO        │
│  ═══════════════════════        │
│                                 │
│  Script: Extraction facture     │
│  (en pause)                     │
│                                 │
│  ┌─────────────────────────────┐│
│  │                             ││
│  │  🔄 Redirection SSO         ││
│  │  détectée                   ││
│  │                             ││
│  │  Authentifiez-vous sur      ││
│  │  la page de votre           ││
│  │  fournisseur d'identité.    ││
│  │                             ││
│  │  Le script reprendra        ││
│  │  automatiquement.           ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  IdP détecté :                  │
│  sso.entreprise.fr              │
│                                 │
│  ┌─────────────────────────────┐│
│  │       ✗ Annuler             ││
│  └─────────────────────────────┘│
│                                 │
│  ⏱ Timeout: 2:45               │
└─────────────────────────────────┘
```

**MFA / 2FA requis**
```
┌─────────────────────────────────┐
│  🔐 VÉRIFICATION 2FA            │
│  ══════════════════             │
│                                 │
│  Script: Extraction facture     │
│  (en pause)                     │
│                                 │
│  ┌─────────────────────────────┐│
│  │                             ││
│  │  📱 Double authentification ││
│  │  requise                    ││
│  │                             ││
│  │  Complétez la vérification  ││
│  │  sur la page :              ││
│  │  • Code OTP                 ││
│  │  • Push notification        ││
│  │  • SMS                      ││
│  │                             ││
│  │  Puis cliquez "Continuer"   ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │       ▶ Continuer           ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │       ✗ Annuler             ││
│  └─────────────────────────────┘│
│                                 │
│  ⏱ Timeout: 1:12               │
└─────────────────────────────────┘
```

**Session expirée (pendant exécution)**
```
┌─────────────────────────────────┐
│  ⚠️ SESSION EXPIRÉE             │
│  ═══════════════════            │
│                                 │
│  Script: Extraction facture     │
│  Interrompu au step 3/5        │
│                                 │
│  ┌─────────────────────────────┐│
│  │                             ││
│  │  Votre session a expiré     ││
│  │  pendant l'exécution.       ││
│  │                             ││
│  │  Reconnectez-vous sur la    ││
│  │  page, puis choisissez :    ││
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  🔄 Reprendre au step 3     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │  ↻ Recommencer le script    ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │  ✗ Abandonner               ││
│  └─────────────────────────────┘│
│                                 │
│  ⏱ Timeout: 1:45               │
└─────────────────────────────────┘
```

### 5.3 Flux d'enregistrement (Record Mode)

```
┌──────────────────────────────────────────────────────────────────┐
│                      RECORDING FLOW                              │
└──────────────────────────────────────────────────────────────────┘

User                    Side Panel                   Content Script         LLM
  │                         │                             │                   │
  │  1. Click "● Rec"       │                             │                   │
  │────────────────────────>│  Active recording mode      │                   │
  │                         │────────────────────────────>│                   │
  │                         │                             │                   │
  │  2. Navigue, clique,    │                             │                   │
  │     saisit...           │                             │                   │
  │─────────────────────────────────────────────────────>│                   │
  │                         │                             │                   │
  │                         │  3. Chaque action capturée: │                   │
  │                         │     • Event type            │                   │
  │                         │     • DOM context           │                   │
  │                         │     • Visual context        │                   │
  │                         │<────────────────────────────│                   │
  │                         │                             │                   │
  │  Voit actions listées   │                             │                   │
  │<────────────────────────│  (update live)              │                   │
  │                         │                             │                   │
  │  4. Click "⏹ Stop"      │                             │                   │
  │────────────────────────>│                             │                   │
  │                         │                             │                   │
  │                         │  5. Send captured data      │                   │
  │                         │─────────────────────────────────────────────────>
  │                         │                             │                   │
  │                         │  6. Return BSL script      │                   │
  │                         │<─────────────────────────────────────────────────
  │                         │                             │                   │
  │  7. Preview & Edit      │                             │                   │
  │     dans le Side Panel  │                             │                   │
  │<────────────────────────│                             │                   │
  │                         │                             │                   │
  │  8. Save (local/server) │                             │                   │
  │────────────────────────>│                             │                   │
```

### 5.4 Flux d'exécution (Run Mode)

```
┌──────────────────────────────────────────────────────────────────┐
│                      EXECUTION FLOW                              │
└──────────────────────────────────────────────────────────────────┘

     Script BSL         Service Worker          Content Script           DOM
          │                    │                       │                   │
          │  Load script       │                       │                   │
          │───────────────────>│                       │                   │
          │                    │                       │                   │
          │                    │  For each step:       │                   │
          │                    │  ────────────         │                   │
          │                    │                       │                   │
          │                    │  Resolve target       │                   │
          │                    │──────────────────────>│                   │
          │                    │                       │  Query DOM        │
          │                    │                       │──────────────────>│
          │                    │                       │  Candidates       │
          │                    │                       │<──────────────────│
          │                    │                       │                   │
          │                    │                       │  Score & select   │
          │                    │                       │                   │
          │                    │  Best element         │                   │
          │                    │<──────────────────────│                   │
          │                    │                       │                   │
          │                    │  Execute action       │                   │
          │                    │──────────────────────>│                   │
          │                    │                       │  Highlight +      │
          │                    │                       │  perform action   │
          │                    │                       │──────────────────>│
          │                    │                       │                   │
          │                    │  Update Side Panel    │                   │
          │                    │  (progress)           │                   │
          │                    │                       │                   │
          │                    │  Next step...         │                   │
```

### 5.5 Flux des Triggers Contextuels

```
┌──────────────────────────────────────────────────────────────────┐
│                   CONTEXTUAL TRIGGER FLOW                        │
└──────────────────────────────────────────────────────────────────┘

     Content Script        Service Worker          Side Panel
          │                      │                      │
          │  Page loaded /       │                      │
          │  DOM changed         │                      │
          │─────────────────────>│                      │
          │                      │                      │
          │                      │  Evaluate all        │
          │                      │  active triggers     │
          │                      │                      │
          │                      │  Trigger matched?    │
          │                      │  ├─ No: continue     │
          │                      │  │   monitoring      │
          │                      │  │                   │
          │                      │  └─ Yes:             │
          │                      │     ├─ suggest mode: │
          │                      │     │  Show in panel │
          │                      │     │───────────────>│  💡 Suggestion
          │                      │     │                │     affichée
          │                      │     │                │
          │                      │     ├─ auto_execute: │
          │                      │     │  Run script    │
          │                      │     │───────────────>│  ▶ Exécution
          │                      │     │                │     lancée
          │                      │     │                │
          │                      │     └─ silent:       │
          │                      │        Store context │
          │                      │        (no UI)       │
          │                      │                      │
```

### 5.6 Stockage et synchronisation

```
                    ┌────────────────────────────┐
                    │        EXTENSION           │
                    └────────────┬───────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │  Local Storage  │       │  Central Server │
          │                 │       │   (optionnel)   │
          │ • Scripts user  │       │                 │
          │ • Triggers user │       │ • Scripts org   │
          │ • Credentials   │       │ • Triggers org  │
          │ • History       │       │ • Versioning    │
          │ • Preferences   │       │ • Analytics     │
          └─────────────────┘       └─────────────────┘
```

### 5.7 Serveur central (optionnel, self-hosted)

> **Note** : Le serveur central est également sous licence AGPL-3.0. Pas de version SaaS hébergée. Les organisations déploient leur propre instance.

**Fonctionnalités** :
- Stockage et versioning des scripts et triggers
- Gestion des droits (qui peut voir/exécuter/éditer)
- Déploiement vers les extensions clientes
- Logs d'exécution centralisés
- Analytics (scripts les plus utilisés, taux d'échec, triggers les plus déclenchés)

**API REST simple** :
```
GET    /api/scripts                    # Liste des scripts accessibles
GET    /api/scripts/{id}               # Détail d'un script
POST   /api/scripts                    # Créer un script
PUT    /api/scripts/{id}               # Mettre à jour
DELETE /api/scripts/{id}               # Supprimer

GET    /api/triggers                   # Liste des triggers
GET    /api/triggers/{id}              # Détail d'un trigger
POST   /api/triggers                   # Créer un trigger
PUT    /api/triggers/{id}              # Mettre à jour
DELETE /api/triggers/{id}              # Supprimer

POST   /api/logs                       # Envoyer un log d'exécution
GET    /api/sync                       # Sync incrémentale (scripts + triggers)
```

---

## 6. User Stories

### 6.1 MVP (v1.0)

#### Enregistrement & Création

| ID | Story | Priorité |
|----|-------|----------|
| US-01 | En tant que créateur, je peux enregistrer un parcours en cliquant sur "Record", navigant sur le site, puis "Stop" | Must |
| US-02 | En tant que créateur, je peux voir le script BSL généré après enregistrement | Must |
| US-03 | En tant que créateur, je peux éditer manuellement le script BSL dans un éditeur intégré | Must |
| US-04 | En tant que créateur, je peux nommer et décrire mon script | Must |
| US-05 | En tant que créateur, je peux définir des variables d'entrée pour rendre le script paramétrable | Should |
| US-06 | En tant que créateur, je peux tester mon script pas-à-pas (debug mode) | Should |

#### Exécution

| ID | Story | Priorité |
|----|-------|----------|
| US-10 | En tant qu'utilisateur, je peux voir la liste des scripts disponibles (locaux + serveur) dans le Side Panel | Must |
| US-11 | En tant qu'utilisateur, je peux exécuter un script en un clic | Must |
| US-12 | En tant qu'utilisateur, je peux renseigner les paramètres d'entrée avant exécution | Must |
| US-13 | En tant qu'utilisateur, je peux voir les données extraites à la fin de l'exécution | Must |
| US-14 | En tant qu'utilisateur, je peux copier les données extraites (JSON/CSV) | Must |
| US-15 | En tant qu'utilisateur, je peux interrompre un script en cours | Must |
| US-16 | En tant qu'utilisateur, je vois une notification en cas d'échec avec le step concerné | Must |

#### Triggers contextuels

| ID | Story | Priorité |
|----|-------|----------|
| US-17 | En tant qu'utilisateur, je vois le contexte actuel de la page (URL, entités détectées) dans le Side Panel | Must |
| US-18 | En tant qu'utilisateur, je reçois des suggestions d'actions quand l'extension reconnaît un contexte pertinent | Must |
| US-19 | En tant que créateur, je peux définir des triggers contextuels pour proposer automatiquement des scripts | Should |
| US-19b | En tant que créateur, je peux configurer un trigger en mode "auto_execute" pour les tâches répétitives validées | Should |
| US-19c | En tant qu'utilisateur, je peux activer/désactiver les suggestions automatiques par site | Should |

#### Stockage

| ID | Story | Priorité |
|----|-------|----------|
| US-20 | En tant que créateur, je peux sauvegarder un script localement | Must |
| US-21 | En tant que créateur, je peux exporter un script en fichier YAML | Should |
| US-22 | En tant que créateur, je peux importer un script depuis un fichier YAML | Should |
| US-23 | En tant qu'admin, je peux configurer l'URL du serveur central | Should |
| US-24 | En tant qu'utilisateur, je peux synchroniser les scripts depuis le serveur central | Should |

#### Authentification (Must have)

| ID | User Story | Priorité |
|----|------------|----------|
| US-30 | En tant qu'utilisateur, si un script nécessite une connexion et que je ne suis pas connecté, je vois un message clair dans le Side Panel | Must |
| US-31 | En tant qu'utilisateur, quand je suis redirigé vers une mire SSO (SAML/CAS), le script attend que je m'authentifie puis reprend automatiquement | Must |
| US-32 | En tant qu'utilisateur, quand une page MFA/2FA apparaît, le script se met en pause et m'indique de compléter la vérification | Must |
| US-33 | En tant qu'utilisateur, si ma session expire pendant l'exécution d'un script, je suis notifié et peux me reconnecter puis reprendre | Must |
| US-34 | En tant qu'utilisateur, je peux stocker mes credentials de manière sécurisée (chiffrée) pour les apps que j'utilise fréquemment | Should |
| US-35 | En tant qu'utilisateur, je peux définir un Master Password pour déverrouiller mes credentials stockés | Should |
| US-36 | En tant qu'utilisateur, je peux configurer un timeout de session pour le credential store (re-demande le Master Password) | Could |

### 6.2 v1.1 — Améliorations

| ID | Story | Priorité |
|----|-------|----------|
| US-30 | En tant que créateur, je peux utiliser l'IA pour améliorer les sélecteurs d'un script existant | Should |
| US-31 | En tant qu'utilisateur, je peux activer le "self-healing" pour qu'un script se répare automatiquement si un sélecteur échoue | Should |
| US-32 | En tant que créateur, je peux programmer l'exécution d'un script (schedule) | Could |
| US-33 | En tant qu'utilisateur, je peux envoyer les données extraites vers un webhook | Could |
| US-34 | En tant qu'utilisateur, je peux chaîner plusieurs scripts | Could |

### 6.3 v2.0 — Avancé

| ID | Story | Priorité |
|----|-------|----------|
| US-40 | En tant qu'admin, je peux gérer les droits d'accès aux scripts sur le serveur central | Could |
| US-41 | En tant qu'admin, je peux voir les analytics d'utilisation | Could |
| US-42 | En tant que créateur, je peux versionner mes scripts sur le serveur | Could |
| US-43 | En tant qu'utilisateur, je peux exécuter un script sur plusieurs onglets en parallèle | Could |

---

## 7. Exigences non-fonctionnelles

### 7.1 Performance

- Exécution d'un step < 100ms (hors temps de chargement réseau)
- Résolution sémantique d'un sélecteur < 50ms
- Extension popup ouvre en < 200ms

### 7.2 Fiabilité

- Un script valide une fois doit fonctionner sur la même version de l'application cible
- Taux de succès cible : > 95% sur UI stable
- Gestion propre des timeouts et erreurs

### 7.3 Sécurité

- Credentials stockés de manière chiffrée (chrome.storage.local avec encryption)
- Pas de transmission de credentials au serveur central
- Scripts exécutés uniquement sur les URL autorisées (target_app.url_pattern)
- Content Security Policy stricte

### 7.4 Compatibilité

- Chrome 120+ (Manifest V3)
- Fonctionne sur SPA (React, Vue, Angular)
- Gère les iframes same-origin
- Gère les shadow DOM

### 7.5 Maintenabilité

- Code TypeScript
- Tests unitaires sur le Semantic Resolver
- Tests E2E sur des scenarios types

---

## 8. Stack technique proposée

### 8.1 Extension Chrome

| Composant | Technologie |
|-----------|-------------|
| Runtime | Chrome Extension Manifest V3 |
| Langage | TypeScript |
| UI Popup | Preact + Tailwind (léger) |
| Editeur YAML | Monaco Editor (embeddé) |
| Storage | chrome.storage.local + chrome.storage.sync |
| Parsing YAML | yaml (npm) |
| Test | Vitest + Playwright |

### 8.2 Serveur central (optionnel)

| Composant | Technologie |
|-----------|-------------|
| Backend | Node.js + Fastify ou Python + FastAPI |
| Database | PostgreSQL |
| Auth | OpenID Connect (compatible Keycloak/LemonLDAP) |
| Déploiement | Docker |

### 8.3 Génération IA

| Composant | Technologie |
|-----------|-------------|
| LLM | Claude API (ou modèle local via Ollama) |
| Prompt | Few-shot avec exemples BSL |

---

## 9. Roadmap

> **Note** : Le POC Semantic Resolver a été validé (17/17 tests). Le code du POC sert de base pour la Phase 1.

### Phase 1 — MVP (8-10 semaines)

**Semaines 1-2** : Fondations
- Setup projet extension (Manifest V3, TypeScript, build)
- Implémentation Content Script de base (DOM observation)
- Structure de données BSL (parser/validator)

**Semaines 3-4** : Semantic Resolver
- ✅ Base validée par POC — partir du code existant
- Intégration du resolver dans l'extension
- Ajout hints manquants (parent_contains, column_header_contains)
- Tests E2E avec Playwright (patterns du POC)

**Semaines 5-6** : Exécution
- Engine d'exécution séquentiel
- Actions de base (click, type, extract, wait_for)
- Gestion des erreurs et timeouts

**Semaines 7-8** : Enregistrement
- Mode recording (capture d'événements)
- Intégration LLM pour génération BSL
- UI basique de preview/edit

**Semaines 9-10** : Polish & Release
- UI Popup complète
- Stockage local
- Import/Export YAML
- Documentation utilisateur
- Tests E2E

### Phase 2 — Serveur & Collaboration (6 semaines)

- API serveur central
- Sync extension ↔ serveur
- Gestion multi-utilisateurs basique

### Phase 3 — Avancé (6 semaines)

- Self-healing avec IA
- Scheduling
- Webhooks
- Analytics

---

## 10. Risques et mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Manifest V3 limitations (service worker lifecycle) | Élevé | Moyenne | Utiliser chrome.alarms, design stateless |
| Sites avec détection de bots | Moyen | Moyenne | Timing humain-like, pas de headless |
| ~~Complexité du Semantic Resolver~~ | ~~Élevé~~ | ~~Moyenne~~ | ✅ **Risque mitigé** — POC validé 17/17 tests |
| Adoption utilisateur | Élevé | Moyenne | Focus UX, scripts prêts à l'emploi pour cas courants |
| Maintenance des scripts quand UI change | Moyen | Haute | Self-healing v1.1, alerting sur échecs |

---

## 11. Métriques de succès

### 11.1 Adoption

- Nombre d'installations actives
- Nombre de scripts créés
- Nombre d'exécutions / jour

### 11.2 Fiabilité

- Taux de succès des exécutions (cible > 95%)
- Temps moyen entre échecs pour un script donné
- Nombre de scripts nécessitant self-healing

### 11.3 Productivité

- Temps gagné estimé (basé sur durée manuelle vs automatisée)
- NPS utilisateurs

---

## 12. Questions ouvertes

1. ~~**Nom du projet**~~ : ✅ **Browserlet** validé
   - Tagline grand public : *Des scripts intelligents pour vos applications web*
   - Tagline technique : *Automatisation web sémantique, sans code*

2. ~~**Licence**~~ : ✅ **AGPL-3.0** — Cohérent avec la stratégie open source LINAGORA

3. ~~**Monétisation**~~ : ✅ **Aucune** — Projet 100% open source, pas de version payante

4. ~~**Intégration Twake**~~ : ✅ **Non prévue** — Browserlet reste un outil standalone

5. ~~**Support Firefox**~~ : ✅ **Non** — Chrome uniquement (Manifest V3 stable)

---

## Annexes

### A. Exemples de scripts BSL additionnels

*À compléter avec des cas d'usage concrets clients*

### B. Résultats POC Semantic Resolver (Janvier 2026)

#### Contexte

POC réalisé pour valider le concept de sélection sémantique avant développement complet.

**Outils utilisés** : Playwright + Extension Chrome
**Date** : 29 janvier 2026
**Durée d'exécution** : 38.2 secondes

#### Résultats

```
╔════════════════════════════════════════════════════════════╗
║   ✅ GO — Le POC est validé                                ║
║                                                            ║
║   Tests:  17 total | 17 passés | 0 échoués                 ║
║   Taux de succès: 100%                                     ║
╚════════════════════════════════════════════════════════════╝
```

#### Détail des tests

| Catégorie | Tests | Durée moy. | Résultat |
|-----------|-------|------------|----------|
| Pages locales (formulaires, boutons, ARIA) | 8 | 1.7s | ✅ 8/8 |
| Sites réels (Google, GitHub, Wikipedia) | 5 | 3.1s | ✅ 5/5 |
| Performance (< 50ms, < 100ms) | 2 | 1.7s | ✅ 2/2 |
| Robustesse (pas de faux positifs) | 2 | 1.6s | ✅ 2/2 |

#### Corrections nécessaires

2 tests ont nécessité des ajustements pour passer :

| Test | Problème | Solution |
|------|----------|----------|
| TC-004 | `near_label` échoue dans tableau | `data_attribute` |
| TC-013 | Regex trop strict sur "Sign in" | `text_contains` + `class_contains` |

#### Conclusion

Le Semantic Resolver tient sa promesse :
- **Résolution fiable** sur sites variés (legacy, SPA, accessibles)
- **Performance acceptable** (< 100ms même sur pages complexes)
- **Zéro faux positif** (critique pour l'automatisation)

**Recommandation** : Procéder au développement complet de Browserlet.

### C. Wireframes UI

*À produire*

---

**Prochaines étapes** (post-POC) :
1. [x] ~~Valider la vision et le périmètre MVP~~ ✅ POC validé
2. [x] ~~Répondre aux questions ouvertes~~ ✅ Section 12 complétée
3. [x] ~~Valider le Semantic Resolver~~ ✅ 17/17 tests passés
4. [ ] Préparer le projet pour développement avec GSD (Get Shit Done)
5. [ ] Identifier 2-3 cas d'usage pilotes concrets
6. [ ] Estimer les ressources nécessaires (8-10 semaines estimées)

---

## Historique des versions

| Version | Date | Changements |
|---------|------|-------------|
| 0.1 | 28 janv. 2026 | Version initiale — structure BSL, architecture |
| 0.2 | 29 janv. 2026 | Ajout authentification complète (SSO/MFA), questions ouvertes tranchées |
| **0.3** | **29 janv. 2026** | **POC validé** — Leçons apprises, bonnes pratiques hints, annexe résultats |
