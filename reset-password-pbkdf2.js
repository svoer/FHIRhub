const crypto = require('crypto');
const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Récupérer les arguments de la ligne de commande
const [,, usernameArg, passwordArg] = process.argv;

// Configuration
const dbPath = process.env.DB_PATH || path.join(__dirname, 'storage', 'db', 'fhirhub.db');
const username = usernameArg || 'admin';
const newPassword = passwordArg || 'admin123';

// Vérifier si la base de données existe
if (!fs.existsSync(dbPath)) {
    console.error(`Erreur: La base de données n'existe pas à l'emplacement: ${dbPath}`);
    console.error(`Vérifiez le chemin ou utilisez la variable d'environnement DB_PATH.`);
    
    // Rechercher des emplacements alternatifs
    const alternatives = [
        path.join(__dirname, 'data', 'fhirhub.db'),
        path.join(__dirname, 'storage/db/fhirhub.db'),
        path.join(__dirname, 'db/fhirhub.db')
    ];
    
    let found = false;
    for (const alt of alternatives) {
        if (fs.existsSync(alt)) {
            console.log(`Base de données trouvée à: ${alt}`);
            found = true;
        }
    }
    
    if (!found) {
        console.error(`Aucune base de données trouvée. Utilisez: node ${path.basename(__filename)} [username] [password]`);
        process.exit(1);
    }
}

// Générer un salt aléatoire
const salt = crypto.randomBytes(16).toString('hex');

// Dériver la clé à partir du mot de passe et du sel
const hash = crypto.pbkdf2Sync(newPassword, salt, 10000, 64, 'sha512').toString('hex');

// Combiner le sel et le hash pour le stockage
const passwordToStore = `${salt}:${hash}`;

console.log(`Nouveau mot de passe formaté: ${passwordToStore}`);

try {
    // Connexion à la base de données
    const db = new sqlite3(dbPath);
    
    // Vérifier si l'utilisateur existe
    const userExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get(username);
    
    if (userExists.count === 0) {
        console.error(`Aucun utilisateur trouvé avec le nom d'utilisateur: ${username}`);
        console.log(`Utilisateurs disponibles dans la base de données:`);
        
        // Afficher les utilisateurs disponibles
        const users = db.prepare('SELECT username, role FROM users').all();
        users.forEach(user => {
            console.log(` - ${user.username} (${user.role})`);
        });
        
        db.close();
        process.exit(1);
    }
    
    // Mise à jour du mot de passe
    const stmt = db.prepare('UPDATE users SET password = ?, updated_at = datetime("now") WHERE username = ?');
    const result = stmt.run(passwordToStore, username);
    
    // Ajouter une entrée dans les logs système
    try {
        db.prepare(`
            INSERT INTO system_logs (event_type, message, severity, user_id, ip_address) 
            VALUES (?, ?, ?, (SELECT id FROM users WHERE username = ?), ?)
        `).run(
            'PASSWORD_RESET',
            `Mot de passe réinitialisé pour l'utilisateur "${username}" via script`,
            'INFO',
            username,
            '127.0.0.1'
        );
    } catch (logError) {
        // Ignorer les erreurs de logging, ne pas bloquer la réinitialisation
        console.warn(`Note: Impossible d'enregistrer l'événement dans les logs système: ${logError.message}`);
    }
    
    if (result.changes === 0) {
        console.error(`Échec de la mise à jour du mot de passe pour: ${username}`);
    } else {
        // Afficher le message de confirmation avec des couleurs
        console.log('\x1b[32m%s\x1b[0m', `✓ Le mot de passe de l'utilisateur ${username} a été réinitialisé avec succès!`);
        console.log('\x1b[36m%s\x1b[0m', `Utilisez ces identifiants pour vous connecter:`);
        console.log('\x1b[36m%s\x1b[0m', ` Nom d'utilisateur : ${username}`);
        console.log('\x1b[36m%s\x1b[0m', ` Mot de passe     : ${newPassword}`);
        
        // Instructions pour Grafana
        console.log('\n\x1b[33m%s\x1b[0m', `Pour appliquer ce même mot de passe à Grafana, exécutez:`);
        console.log('\x1b[33m%s\x1b[0m', ` 1. Modifiez docker-compose.yml: GF_SECURITY_ADMIN_PASSWORD=${newPassword}`);
        console.log('\x1b[33m%s\x1b[0m', ` 2. Redémarrez les containers: docker-compose restart`);
    }
    
    // Fermer la connexion
    db.close();
} catch (error) {
    console.error(`\x1b[31mErreur lors de la mise à jour du mot de passe:\x1b[0m`, error.message);
    console.error(`Commande: node ${path.basename(__filename)} [username] [password]`);
}