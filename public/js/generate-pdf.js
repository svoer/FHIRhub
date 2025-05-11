/**
 * Script pour générer un PDF de la documentation technique
 * Utilise html2pdf.js pour convertir la documentation en PDF
 */
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier si le bouton de téléchargement existe
  const downloadPdfBtn = document.querySelector('.download-pdf-btn');
  
  if (downloadPdfBtn) {
    // Ajouter un gestionnaire d'événements au bouton
    downloadPdfBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Ajouter une animation de chargement
      const originalText = downloadPdfBtn.innerHTML;
      downloadPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération en cours...';
      downloadPdfBtn.style.pointerEvents = 'none';
      
      try {
        // Méthode plus directe : générer le PDF directement à partir du contenu HTML de la page
        // en excluant les éléments non désirés
        
        // Créer un conteneur pour le contenu à convertir en PDF
        const element = document.createElement('div');
        element.innerHTML = `
          <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h1 style="color: #e74c3c; font-size: 24px; margin-bottom: 10px;">Documentation Technique FHIRHub</h1>
            <p style="color: #666; margin-bottom: 30px; font-size: 16px;">Guide complet pour les développeurs et ingénieurs d'intégration</p>
            
            <div style="margin-bottom: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
              <h2 style="margin-top: 0; font-size: 18px; color: #e74c3c;">Table des matières</h2>
              <ul style="list-style-type: none; padding-left: 0;">
                ${Array.from(document.querySelectorAll('.documentation-section h2')).map((h2, index) => 
                  `<li style="margin-bottom: 8px;">${index + 1}. ${h2.textContent}</li>`
                ).join('')}
              </ul>
            </div>
        `;

        // Ajouter le contenu de chaque section de documentation
        document.querySelectorAll('.documentation-section').forEach(section => {
          element.innerHTML += `
            <div style="margin-bottom: 30px; page-break-inside: avoid;">
              <h2 style="color: #e74c3c; font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">${section.querySelector('h2').textContent}</h2>
              ${section.innerHTML.replace(/<h2.*?<\/h2>/s, '')}
            </div>
          `;
        });
        
        element.innerHTML += '</div>';
        
        // Définir les options pour la génération du PDF
        const options = {
          margin: 15,
          filename: 'FHIRHub_Documentation_Technique.pdf',
          image: { type: 'jpeg', quality: 1 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            putOnlyUsedFonts: true
          },
          pagebreak: { mode: 'avoid-all' }
        };
        
        // Configuration prête pour la génération du PDF
        
        // Créer une promesse pour attendre le rendu du HTML
        const renderPromise = new Promise(resolve => {
          // Créer un div temporaire qui sera visible
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(element);
          tempDiv.style.position = 'fixed';
          tempDiv.style.top = '0';
          tempDiv.style.left = '0';
          tempDiv.style.width = '210mm';
          tempDiv.style.zIndex = '-1000';
          tempDiv.style.backgroundColor = 'white';
          document.body.appendChild(tempDiv);
          
          // Donner un peu de temps pour que le DOM soit mis à jour
          setTimeout(() => {
            // Générer le PDF
            html2pdf()
              .from(tempDiv)
              .set(options)
              .save()
              .then(() => {
                document.body.removeChild(tempDiv);
                resolve();
              });
          }, 500);
        });
        
        // Attendre que le PDF soit généré
        renderPromise.then(() => {
          downloadPdfBtn.innerHTML = originalText;
          downloadPdfBtn.style.pointerEvents = 'auto';
        });
      } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        downloadPdfBtn.innerHTML = originalText;
        downloadPdfBtn.style.pointerEvents = 'auto';
        
        // Méthode de secours en cas d'échec
        alert('Génération du PDF alternative en cours...');
        
        // Approche directe : prendre le contenu visible comme il est
        const element = document.querySelector('.container');
        const opt = {
          margin: 10,
          filename: 'FHIRHub_Documentation_Technique.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Masquer temporairement les éléments non désirés
        const menuNav = document.querySelector('.section-nav');
        const docActions = document.querySelector('.doc-actions');
        const backTop = document.querySelector('.back-to-top');
        
        if (menuNav) menuNav.style.display = 'none';
        if (docActions) docActions.style.display = 'none';
        if (backTop) backTop.style.display = 'none';
        
        // Générer le PDF
        html2pdf()
          .from(element)
          .set(opt)
          .save()
          .then(() => {
            // Restaurer les éléments masqués
            if (menuNav) menuNav.style.display = '';
            if (docActions) docActions.style.display = '';
            if (backTop) backTop.style.display = '';
          });
      }
    });
  }
});