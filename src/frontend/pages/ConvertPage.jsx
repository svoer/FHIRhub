import React, { useState } from 'react';
import { 
  ArrowPathIcon, 
  ChevronDownIcon, 
  CloudArrowUpIcon, 
  DocumentArrowDownIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';

/**
 * Page de conversion HL7 vers FHIR
 */
const ConvertPage = () => {
  // États pour gérer le formulaire
  const [hl7Input, setHl7Input] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [inputMethod, setInputMethod] = useState('text'); // 'text', 'file' ou 'monitoring'
  const [apiKey, setApiKey] = useState('');
  
  // États pour gérer la réponse
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showJsonResult, setShowJsonResult] = useState(false);
  
  // États pour la surveillance de fichiers
  const [monitoringDirectory, setMonitoringDirectory] = useState('');
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  
  // Fonctions de gestion des formulaires
  const handleInputMethodChange = (method) => {
    setInputMethod(method);
    // Réinitialiser les erreurs et résultats lors du changement de méthode
    setError(null);
    setResult(null);
  };
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };
  
  const handleTextInputChange = (e) => {
    setHl7Input(e.target.value);
    // Ne pas effacer les erreurs à chaque frappe
  };
  
  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
  };
  
  const handleDirectoryChange = (e) => {
    setMonitoringDirectory(e.target.value);
  };
  
  // Fonction pour gérer la conversion (simulation)
  const handleConvert = () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    // Vérification des entrées
    if (inputMethod === 'text' && !hl7Input.trim()) {
      setError('Veuillez entrer un message HL7');
      setIsLoading(false);
      return;
    }
    
    if (inputMethod === 'file' && !selectedFile) {
      setError('Veuillez sélectionner un fichier HL7');
      setIsLoading(false);
      return;
    }
    
    if (!apiKey.trim()) {
      setError('Veuillez entrer une clé API');
      setIsLoading(false);
      return;
    }
    
    // Simulation d'une conversion réussie (à remplacer par un appel API réel)
    setTimeout(() => {
      // Simuler une réponse
      const mockResult = {
        conversionTime: 245,
        resourceCount: 8,
        sourceFilename: inputMethod === 'file' ? selectedFile.name : 'message-direct.hl7',
        targetFilename: 'output-1234567890.json',
        result: {
          resourceType: 'Bundle',
          type: 'transaction',
          id: 'e6a6d13a-2cbf-4110-8fa5-19ac0c1b0221',
          entry: [
            { resource: { resourceType: 'Patient', id: 'p1' } },
            { resource: { resourceType: 'Encounter', id: 'e1' } },
            { resource: { resourceType: 'Observation', id: 'o1' } }
            // Etc... (simplifié pour l'exemple)
          ]
        }
      };
      
      setResult(mockResult);
      setIsLoading(false);
    }, 1500);
  };
  
  // Fonction pour démarrer/arrêter la surveillance (simulation)
  const toggleMonitoring = () => {
    if (!isMonitoringActive) {
      if (!monitoringDirectory.trim()) {
        setError('Veuillez entrer un répertoire à surveiller');
        return;
      }
      
      setIsLoading(true);
      
      // Simuler le démarrage de la surveillance
      setTimeout(() => {
        setIsMonitoringActive(true);
        setIsLoading(false);
      }, 1000);
    } else {
      setIsLoading(true);
      
      // Simuler l'arrêt de la surveillance
      setTimeout(() => {
        setIsMonitoringActive(false);
        setIsLoading(false);
      }, 1000);
    }
  };
  
  // Fonction pour analyser les fichiers existants (simulation)
  const scanDirectory = () => {
    if (!monitoringDirectory.trim()) {
      setError('Veuillez entrer un répertoire à analyser');
      return;
    }
    
    setIsLoading(true);
    
    // Simuler l'analyse
    setTimeout(() => {
      setResult({
        message: 'Analyse terminée',
        scannedFiles: 15,
        processedFiles: 12
      });
      setIsLoading(false);
    }, 2000);
  };
  
  // Fonction pour copier le JSON dans le presse-papier
  const copyToClipboard = () => {
    if (result && result.result) {
      navigator.clipboard.writeText(JSON.stringify(result.result, null, 2))
        .then(() => {
          // Afficher une confirmation temporaire
          alert('JSON copié dans le presse-papier');
        })
        .catch(err => {
          console.error('Erreur lors de la copie :', err);
        });
    }
  };
  
  // Préparation du contenu en fonction de la méthode d'entrée
  const renderInputForm = () => {
    switch (inputMethod) {
      case 'text':
        return (
          <div className="mt-4">
            <label htmlFor="hl7-input" className="block text-sm font-medium text-gray-700">
              Message HL7 v2.5
            </label>
            <textarea
              id="hl7-input"
              name="hl7-input"
              rows={10}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500 font-mono text-sm"
              placeholder="Entrez votre message HL7 ici (MSH|^~\\&|...)"
              value={hl7Input}
              onChange={handleTextInputChange}
            />
          </div>
        );
        
      case 'file':
        return (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Fichier HL7 v2.5
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-fhir-red-600 hover:text-fhir-red-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-fhir-red-500">
                    <span>Télécharger un fichier</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".hl7,.txt"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">ou glisser-déposer</p>
                </div>
                <p className="text-xs text-gray-500">
                  HL7 v2.5 (.hl7 ou .txt) jusqu'à 10MB
                </p>
                {selectedFile && (
                  <div className="mt-2 text-sm text-fhir-red-600">
                    Fichier sélectionné: {selectedFile.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
        
      case 'monitoring':
        return (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="directory-path" className="block text-sm font-medium text-gray-700">
                Répertoire à surveiller
              </label>
              <input
                type="text"
                id="directory-path"
                name="directory-path"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500"
                placeholder="/chemin/vers/repertoire"
                value={monitoringDirectory}
                onChange={handleDirectoryChange}
              />
              <p className="mt-1 text-xs text-gray-500">
                Les fichiers HL7 déposés dans ce répertoire seront automatiquement convertis
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <Button
                variant={isMonitoringActive ? 'danger' : 'primary'}
                onClick={toggleMonitoring}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                ) : isMonitoringActive ? (
                  'Arrêter la surveillance'
                ) : (
                  'Démarrer la surveillance'
                )}
              </Button>
              
              <Button
                variant="secondary"
                onClick={scanDirectory}
                disabled={isLoading || isMonitoringActive}
              >
                {isLoading ? (
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  'Analyser les fichiers existants'
                )}
              </Button>
            </div>
            
            {isMonitoringActive && (
              <Alert variant="success" title="Surveillance active">
                <p>Le répertoire <strong>{monitoringDirectory}</strong> est surveillé. 
                Les nouveaux fichiers HL7 sont automatiquement convertis.</p>
              </Alert>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Convertisseur HL7 vers FHIR</h1>
        <p className="mt-2 text-sm text-gray-500">
          Convertit les messages HL7 v2.5 au format FHIR R4 compatible avec les spécifications françaises
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formulaire de conversion */}
        <div className="md:col-span-1">
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <Card.Title>Source HL7</Card.Title>
                <Badge variant="health">v2.5</Badge>
              </div>
            </Card.Header>
            <Card.Body>
              {/* Sélecteur de méthode d'entrée */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6">
                  <button
                    onClick={() => handleInputMethodChange('text')}
                    className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                      inputMethod === 'text'
                        ? 'border-fhir-red-500 text-fhir-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Texte direct
                  </button>
                  <button
                    onClick={() => handleInputMethodChange('file')}
                    className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                      inputMethod === 'file'
                        ? 'border-fhir-red-500 text-fhir-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Fichier
                  </button>
                  <button
                    onClick={() => handleInputMethodChange('monitoring')}
                    className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                      inputMethod === 'monitoring'
                        ? 'border-fhir-red-500 text-fhir-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Surveillance
                  </button>
                </nav>
              </div>
              
              {/* Formulaire selon la méthode sélectionnée */}
              {renderInputForm()}
              
              {/* Clé API (pas nécessaire pour la surveillance) */}
              {inputMethod !== 'monitoring' && (
                <div className="mt-4">
                  <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">
                    Clé API
                  </label>
                  <input
                    type="text"
                    id="api-key"
                    name="api-key"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500"
                    placeholder="Entrez votre clé API"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                  />
                </div>
              )}
              
              {/* Message d'erreur */}
              {error && (
                <Alert variant="error" className="mt-4">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    {error}
                  </div>
                </Alert>
              )}
              
              {/* Bouton de conversion (pas pour la surveillance) */}
              {inputMethod !== 'monitoring' && (
                <div className="mt-6">
                  <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    onClick={handleConvert}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                        Conversion en cours...
                      </>
                    ) : (
                      'Convertir en FHIR'
                    )}
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
        
        {/* Résultats de la conversion */}
        <div className="md:col-span-1">
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <Card.Title>Résultat FHIR</Card.Title>
                <Badge variant="health">R4</Badge>
              </div>
            </Card.Header>
            <Card.Body>
              {result ? (
                <div className="space-y-4">
                  {/* En-tête résultat */}
                  <div className="bg-gradient-to-r from-fhir-red-50 to-fhir-orange-50 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <CheckCircleIcon className="h-6 w-6 text-fhir-red-500" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-fhir-red-800">Conversion réussie</h3>
                        <div className="mt-2 text-sm text-fhir-red-700">
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Temps de conversion: {result.conversionTime} ms</li>
                            <li>Ressources générées: {result.resourceCount}</li>
                            <li>Fichier source: {result.sourceFilename}</li>
                            <li>Fichier cible: {result.targetFilename}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions sur le résultat */}
                  <div className="flex space-x-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex items-center"
                      onClick={() => setShowJsonResult(!showJsonResult)}
                    >
                      <ChevronDownIcon className="h-5 w-5 mr-1" />
                      {showJsonResult ? 'Masquer le JSON' : 'Afficher le JSON'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center"
                      onClick={copyToClipboard}
                      disabled={!result || !result.result}
                    >
                      <ClipboardDocumentIcon className="h-5 w-5 mr-1" />
                      Copier
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center"
                      as="a"
                      href={`/api/files/fhir/${result.targetFilename}`}
                      download
                      disabled={!result || !result.targetFilename}
                    >
                      <DocumentArrowDownIcon className="h-5 w-5 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                  
                  {/* Affichage JSON */}
                  {showJsonResult && result.result && (
                    <div className="mt-4 relative">
                      <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs font-mono h-80">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                  <div className="rounded-full bg-gray-100 p-3 mb-4">
                    <DocumentArrowDownIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium mb-1">Aucun résultat à afficher</h3>
                  <p className="text-xs">
                    Utilisez le formulaire à gauche pour convertir un message HL7 en FHIR
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
      
      {/* Conseils */}
      <Card withBorder>
        <Card.Body>
          <h3 className="font-medium text-gray-900">Conseils d'utilisation</h3>
          <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Les messages HL7 doivent être au format v2.5 avec l'encodage par défaut (MSH|^~\&|...)</li>
            <li>La conversion utilise les terminologies françaises recommandées par l'ANS</li>
            <li>Les ressources FHIR générées sont au format R4 (4.0.1)</li>
            <li>Pour les intégrations système, utilisez plutôt l'API REST ou la surveillance de dossier</li>
            <li>Obtenez votre clé API depuis la section "Applications" du portail</li>
          </ul>
        </Card.Body>
      </Card>
    </div>
  );
};

export default ConvertPage;