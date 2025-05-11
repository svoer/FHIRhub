/**
 * FHIRHub Modern Dialogs - Design 2025
 * Remplace les boîtes de dialogue standards par des interfaces modernes et élégantes
 */

const ModernDialogs = (() => {
    // Styles CSS pour nos dialogues modernes
    const styles = `
        .modern-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.4);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            opacity: 0;
            transition: opacity 0.3s ease;
            padding: 20px;
        }
        
        .modern-dialog-overlay.visible {
            opacity: 1;
        }
        
        .modern-dialog {
            background-color: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            transform: translateY(20px);
            transition: transform 0.3s ease;
            border: 1px solid rgba(0, 0, 0, 0.03);
            overflow: hidden;
        }
        
        .modern-dialog.visible {
            transform: translateY(0);
        }
        
        .modern-dialog-header {
            padding: 20px 24px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .modern-dialog-title {
            font-size: 1.2rem;
            font-weight: 500;
            color: #333;
            margin: 0;
        }
        
        .modern-dialog-body {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
            max-height: 60vh;
            color: #444;
            line-height: 1.6;
        }
        
        .modern-dialog-body.scrollable {
            overflow-y: auto;
        }
        
        .modern-dialog-body pre {
            white-space: pre-wrap;
            font-family: 'SF Mono', 'Consolas', monospace;
            background-color: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 0;
            color: #333;
            font-size: 0.9rem;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }
        
        .modern-dialog-body .file-list {
            margin: 0;
            padding: 0;
            list-style: none;
        }
        
        .modern-dialog-body .file-list li {
            padding: 8px 12px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }
        
        .modern-dialog-body .file-list li:last-child {
            border-bottom: none;
        }
        
        .modern-dialog-body .file-group {
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        
        .modern-dialog-body .file-group-title {
            font-weight: 500;
            margin-bottom: 8px;
            color: #333;
        }
        
        .modern-dialog-footer {
            padding: 16px 24px;
            border-top: 1px solid rgba(0, 0, 0, 0.05);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        
        .modern-dialog-btn {
            padding: 10px 18px;
            border-radius: 8px;
            border: none;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.95rem;
        }
        
        .modern-dialog-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        .modern-dialog-btn:active {
            transform: translateY(0);
        }
        
        .modern-dialog-btn-primary {
            background: linear-gradient(to right, var(--primary-gradient-start), var(--primary-gradient-end));
            color: white;
        }
        
        .modern-dialog-btn-primary:hover {
            opacity: 0.9;
        }
        
        .modern-dialog-btn-secondary {
            background-color: white;
            color: #333;
            border: 1px solid rgba(0, 0, 0, 0.08);
        }
        
        .modern-dialog-btn-secondary:hover {
            background-color: #f8f9fa;
        }
        
        .modern-dialog-icon {
            margin-right: 8px;
            font-size: 1.2rem;
            color: var(--primary-color);
        }
        
        .modern-dialog-content-wrapper {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        @media (max-width: 576px) {
            .modern-dialog {
                width: 95%;
            }
            
            .modern-dialog-header,
            .modern-dialog-body,
            .modern-dialog-footer {
                padding: 16px;
            }
        }
    `;

    // Variables pour suivre les dialogues actifs
    let activeDialog = null;
    let isInitialized = false;

    // Initialiser le module
    function initialize() {
        if (isInitialized) return;
        
        // Ajouter les styles
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        
        // Surcharger la méthode alert native
        window._originalAlert = window.alert;
        window.alert = showAlert;
        
        // Surcharger la méthode confirm native
        window._originalConfirm = window.confirm;
        window.confirm = showConfirm;
        
        // Surcharger la méthode prompt native
        window._originalPrompt = window.prompt;
        window.prompt = showPrompt;
        
        isInitialized = true;
    }

    // Créer l'élément de dialog
    function createDialogElement({ title, buttons, content, icon }) {
        // Supprimer tout dialogue existant
        closeActiveDialog();
        
        // Créer l'overlay
        const overlay = document.createElement('div');
        overlay.classList.add('modern-dialog-overlay');
        
        // Créer le dialogue
        const dialog = document.createElement('div');
        dialog.classList.add('modern-dialog');
        
        // Créer l'en-tête
        const header = document.createElement('div');
        header.classList.add('modern-dialog-header');
        
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        
        if (icon) {
            const iconElem = document.createElement('i');
            iconElem.className = `fas fa-${icon} modern-dialog-icon`;
            titleContainer.appendChild(iconElem);
        }
        
        const titleElem = document.createElement('h3');
        titleElem.classList.add('modern-dialog-title');
        titleElem.textContent = title || 'Message';
        titleContainer.appendChild(titleElem);
        
        header.appendChild(titleContainer);
        dialog.appendChild(header);
        
        // Créer le corps
        const body = document.createElement('div');
        body.classList.add('modern-dialog-body');
        
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }
        
        dialog.appendChild(body);
        
        // Créer le pied de page
        if (buttons && buttons.length > 0) {
            const footer = document.createElement('div');
            footer.classList.add('modern-dialog-footer');
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.classList.add('modern-dialog-btn');
                button.classList.add(`modern-dialog-btn-${btn.type || 'secondary'}`);
                button.textContent = btn.text;
                
                if (btn.onClick) {
                    button.addEventListener('click', () => {
                        btn.onClick();
                        closeDialog(overlay, dialog);
                    });
                } else {
                    button.addEventListener('click', () => closeDialog(overlay, dialog));
                }
                
                footer.appendChild(button);
            });
            
            dialog.appendChild(footer);
        }
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Afficher avec animation
        setTimeout(() => {
            overlay.classList.add('visible');
            dialog.classList.add('visible');
        }, 10);
        
        // Stocker comme dialogue actif
        activeDialog = { overlay, dialog };
        
        return { overlay, dialog };
    }

    // Fermer un dialogue spécifique
    function closeDialog(overlay, dialog) {
        dialog.classList.remove('visible');
        overlay.classList.remove('visible');
        
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
        
        if (activeDialog && activeDialog.overlay === overlay) {
            activeDialog = null;
        }
    }

    // Fermer le dialogue actif
    function closeActiveDialog() {
        if (activeDialog) {
            closeDialog(activeDialog.overlay, activeDialog.dialog);
        }
    }

    // Afficher une alerte
    function showAlert(message, title = 'Information') {
        if (!isInitialized) initialize();
        
        return new Promise(resolve => {
            createDialogElement({
                title,
                content: `<p>${message}</p>`,
                icon: 'info-circle',
                buttons: [
                    {
                        text: 'OK',
                        type: 'primary',
                        onClick: () => resolve()
                    }
                ]
            });
        });
    }

    // Afficher une confirmation
    function showConfirm(message, title = 'Confirmation') {
        if (!isInitialized) initialize();
        
        return new Promise(resolve => {
            createDialogElement({
                title,
                content: `<p>${message}</p>`,
                icon: 'question-circle',
                buttons: [
                    {
                        text: 'Annuler',
                        type: 'secondary',
                        onClick: () => resolve(false)
                    },
                    {
                        text: 'OK',
                        type: 'primary',
                        onClick: () => resolve(true)
                    }
                ]
            });
        });
    }

    // Afficher un prompt
    function showPrompt(message, defaultValue = '', title = 'Saisie') {
        if (!isInitialized) initialize();
        
        return new Promise(resolve => {
            const inputContainer = document.createElement('div');
            inputContainer.classList.add('modern-dialog-content-wrapper');
            
            const messageElem = document.createElement('p');
            messageElem.textContent = message;
            inputContainer.appendChild(messageElem);
            
            const input = document.createElement('input');
            input.type = 'text';
            input.style.width = '100%';
            input.style.padding = '10px';
            input.style.borderRadius = '8px';
            input.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            input.style.fontSize = '1rem';
            input.value = defaultValue;
            inputContainer.appendChild(input);
            
            const { dialog } = createDialogElement({
                title,
                content: inputContainer,
                icon: 'pencil-alt',
                buttons: [
                    {
                        text: 'Annuler',
                        type: 'secondary',
                        onClick: () => resolve(null)
                    },
                    {
                        text: 'OK',
                        type: 'primary',
                        onClick: () => resolve(input.value)
                    }
                ]
            });
            
            // Mettre le focus sur l'input
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);
            
            // Gérer la touche Entrée
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    resolve(input.value);
                    closeActiveDialog();
                }
            });
        });
    }

    // Afficher un dialogue personnalisé pour les doublons de fichiers
    function showDuplicatesDialog(duplicatesData) {
        if (!isInitialized) initialize();
        
        return new Promise(resolve => {
            // Créer le contenu du dialogue
            const content = document.createElement('div');
            
            // Titre principal
            const mainTitle = document.createElement('h4');
            mainTitle.textContent = `${duplicatesData.totalDuplicates} fichiers en doublon détectés`;
            mainTitle.style.marginTop = '0';
            mainTitle.style.marginBottom = '16px';
            content.appendChild(mainTitle);
            
            // Analyser et afficher les groupes
            if (duplicatesData.groups && duplicatesData.groups.length > 0) {
                duplicatesData.groups.forEach((group, index) => {
                    const groupDiv = document.createElement('div');
                    groupDiv.classList.add('file-group');
                    
                    const groupTitle = document.createElement('div');
                    groupTitle.classList.add('file-group-title');
                    groupTitle.innerHTML = `<i class="fas fa-folder-open"></i> Groupe ${index + 1}: ${group.name || 'Fichiers similaires'}`;
                    groupDiv.appendChild(groupTitle);
                    
                    const filesList = document.createElement('ul');
                    filesList.classList.add('file-list');
                    
                    group.files.forEach(file => {
                        const fileItem = document.createElement('li');
                        fileItem.innerHTML = `<i class="fas fa-file"></i> ${file.name} <small>(${file.date || 'Date inconnue'})</small>`;
                        filesList.appendChild(fileItem);
                    });
                    
                    groupDiv.appendChild(filesList);
                    content.appendChild(groupDiv);
                });
            }
            
            createDialogElement({
                title: 'Fichiers en doublon détectés',
                content,
                icon: 'copy',
                buttons: [
                    {
                        text: 'Annuler',
                        type: 'secondary',
                        onClick: () => resolve(false)
                    },
                    {
                        text: 'Supprimer les plus anciens',
                        type: 'primary',
                        onClick: () => resolve(true)
                    }
                ]
            });
        });
    }

    // API publique
    return {
        initialize,
        alert: showAlert,
        confirm: showConfirm,
        prompt: showPrompt,
        showDuplicatesDialog,
        closeActiveDialog
    };
})();

// Initialiser automatiquement
document.addEventListener('DOMContentLoaded', () => {
    ModernDialogs.initialize();
    console.log('Modern Dialogs initialized');
});