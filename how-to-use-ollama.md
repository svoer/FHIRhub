# Guide d'utilisation d'Ollama avec FHIRHub

Ce guide vous explique comment utiliser Ollama comme fournisseur d'IA alternatif à Mistral dans FHIRHub.

## Prérequis

1. Avoir [Ollama](https://ollama.com/) installé sur votre machine ou sur un serveur accessible
2. S'assurer que le serveur Ollama est en cours d'exécution (généralement sur le port 11434)
3. Avoir au moins un modèle installé sur Ollama (par exemple, llama3, mistral ou gemma)

## Configuration d'Ollama dans FHIRHub

### Méthode 1 : Via l'interface graphique (recommandée)

1. Connectez-vous à FHIRHub avec un compte administrateur
2. Accédez à la page "Gestion des Fournisseurs d'IA" depuis le menu latéral
3. Vérifiez si Ollama est déjà configuré dans la liste des fournisseurs
   - Si oui, activez-le en utilisant le commutateur (switch)
   - Si non, cliquez sur "Ajouter un fournisseur"

4. Pour ajouter Ollama comme nouveau fournisseur :
   - Nom : "Ollama Local"
   - Type : Sélectionnez "ollama" dans la liste déroulante
   - Point d'accès (Endpoint) : `http://localhost:11434` (ou l'adresse de votre serveur Ollama)
   - Modèles : liste des modèles disponibles séparés par des virgules (par exemple, "llama3,mistral,gemma")
   - Cliquez sur "Ajouter"

5. Une fois ajouté, activez Ollama en cliquant sur le commutateur correspondant
   - Assurez-vous que les autres fournisseurs (comme Mistral) sont désactivés si vous souhaitez utiliser exclusivement Ollama

6. Testez la connexion en cliquant sur le bouton "Tester" à côté du fournisseur Ollama

### Méthode 2 : Via l'API

Si vous préférez configurer Ollama via l'API, voici les requêtes à effectuer :

1. Ajouter Ollama comme fournisseur d'IA :
   ```bash
   curl -X POST http://localhost:5000/api/ai-providers \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: dev-key" \
     -d '{
       "provider_name": "Ollama Local",
       "provider_type": "ollama",
       "endpoint": "http://localhost:11434",
       "models": "llama3,mistral,gemma",
       "enabled": false
     }'
   ```

2. Activer Ollama une fois ajouté (remplacez `{id}` par l'ID retourné) :
   ```bash
   curl -X PUT http://localhost:5000/api/ai-providers/{id} \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: dev-key" \
     -d '{
       "enabled": true
     }'
   ```

3. Désactiver Mistral si nécessaire (remplacez `{mistral_id}` par l'ID de Mistral) :
   ```bash
   curl -X PUT http://localhost:5000/api/ai-providers/{mistral_id} \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: dev-key" \
     -d '{
       "enabled": false
     }'
   ```

## Configuration du serveur Ollama

Pour que FHIRHub puisse communiquer correctement avec Ollama, votre serveur Ollama doit être configuré correctement :

1. Vérifiez que Ollama est en cours d'exécution :
   ```bash
   curl http://localhost:11434/api/tags
   ```
   Cette commande devrait renvoyer la liste des modèles disponibles.

2. Si vous utilisez Ollama sur une machine différente, assurez-vous que :
   - Le pare-feu permet les connexions sur le port 11434
   - Ollama est configuré pour écouter sur toutes les interfaces (`0.0.0.0`) et pas seulement sur localhost

3. Installez les modèles nécessaires si ce n'est pas déjà fait :
   ```bash
   ollama pull llama3     # Pour installer le modèle Llama 3
   ollama pull mistral    # Pour installer le modèle Mistral
   ollama pull gemma      # Pour installer le modèle Gemma
   ```

## Configuration avancée

### Variable d'environnement

Vous pouvez configurer l'adresse du serveur Ollama en définissant la variable d'environnement `OLLAMA_API_ENDPOINT` :

```bash
export OLLAMA_API_ENDPOINT=http://mon-serveur-ollama:11434
```

Cette configuration est prioritaire sur l'adresse configurée dans la base de données.

### Logs supplémentaires

Pour activer des logs supplémentaires concernant Ollama, vous pouvez modifier le niveau de log dans le fichier `.env` :

```
LOG_LEVEL=debug
```

## Résolution des problèmes

Si vous rencontrez des problèmes avec Ollama, voici quelques étapes de dépannage :

1. **Erreur de connexion** : Vérifiez que le serveur Ollama est bien en cours d'exécution et accessible à l'adresse configurée

2. **Modèles non disponibles** : Vérifiez que les modèles spécifiés sont bien installés sur le serveur Ollama

3. **Performances lentes** : Les performances dépendent de votre matériel. Ollama fonctionne mieux avec un GPU. Sur un CPU, les temps de réponse peuvent être plus longs.

4. **Logs d'erreur** : Consultez les logs de FHIRHub pour plus de détails sur les erreurs spécifiques

## Comparaison avec Mistral

| Fonctionnalité | Ollama | Mistral |
|----------------|--------|---------|
| Confidentialité | Toutes les données restent locales | Les requêtes transitent par les serveurs Mistral |
| Performance | Dépend du matériel local | Haute performance garantie |
| Coût | Gratuit | Requiert un abonnement/crédits |
| Modèles | Nombreux modèles open source | Modèles Mistral uniquement |
| Installation | Requiert une installation locale | Aucune installation requise |
| Connexion Internet | Non requise | Requise |

## Conclusion

Ollama offre une alternative flexible à Mistral, particulièrement adaptée pour les environnements où la confidentialité des données est primordiale ou lorsque vous souhaitez fonctionner sans connexion internet. La qualité des résultats dépendra du modèle utilisé et de votre matériel.