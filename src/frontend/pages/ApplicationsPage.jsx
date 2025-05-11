import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusCircleIcon, 
  KeyIcon, 
  TrashIcon, 
  PencilIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  FolderIcon,
  CogIcon
} from '@heroicons/react/24/outline';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Alert from '../components/ui/Alert';

/**
 * Page de gestion des applications
 */
const ApplicationsPage = () => {
  // État pour simuler les applications existantes
  const [applications, setApplications] = useState([
    {
      id: 1,
      name: 'SIH Central',
      description: 'Système d\'Information Hospitalier principal',
      apiKeys: [
        { id: 1, name: 'Production', keyValue: 'sk_prod_1a2b3c4d5e6f', active: true, lastUsedAt: '2025-04-26T08:15:30Z' },
        { id: 2, name: 'Qualification', keyValue: 'sk_qual_7g8h9i0j1k2l', active: true, lastUsedAt: '2025-04-25T14:22:45Z' }
      ],
      active: true,
      contactEmail: 'admin@hopital-central.fr',
      createdAt: '2025-01-15T10:30:00Z'
    },
    {
      id: 2,
      name: 'MedLab Biologie',
      description: 'Interface laboratoire de biologie médicale',
      apiKeys: [
        { id: 3, name: 'Production', keyValue: 'sk_prod_3m4n5o6p7q8r', active: true, lastUsedAt: '2025-04-26T11:05:12Z' }
      ],
      active: true,
      contactEmail: 'tech@medlab.fr',
      createdAt: '2025-02-08T09:15:00Z'
    },
    {
      id: 3,
      name: 'PharmaSoft',
      description: 'Gestion pharmaceutique',
      apiKeys: [
        { id: 4, name: 'Production', keyValue: 'sk_prod_9s0t1u2v3w4x', active: false, lastUsedAt: '2025-03-12T15:30:22Z' }
      ],
      active: false,
      contactEmail: 'support@pharmasoft.fr',
      createdAt: '2025-03-01T14:45:00Z'
    }
  ]);
  
  // État pour gérer l'affichage des clés API
  const [visibleKeys, setVisibleKeys] = useState({});
  
  // État pour gérer l'affichage du formulaire d'ajout
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApp, setNewApp] = useState({
    name: '',
    description: '',
    contactEmail: ''
  });
  
  // État pour gérer l'ajout d'une clé API
  const [showAddKeyForm, setShowAddKeyForm] = useState(null);
  const [newKey, setNewKey] = useState({
    name: '',
    expiresAt: ''
  });
  
  // Gestion des erreurs et chargement
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Toggles pour l'affichage des clés API
  const toggleKeyVisibility = (appId, keyId) => {
    setVisibleKeys(prev => ({
      ...prev,
      [`${appId}-${keyId}`]: !prev[`${appId}-${keyId}`]
    }));
  };
  
  // Gérer le changement dans le formulaire d'ajout d'application
  const handleNewAppChange = (e) => {
    const { name, value } = e.target;
    setNewApp(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Gérer le changement dans le formulaire d'ajout de clé API
  const handleNewKeyChange = (e) => {
    const { name, value } = e.target;
    setNewKey(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Créer une nouvelle application (simulation)
  const handleCreateApplication = () => {
    setIsLoading(true);
    setError(null);
    
    // Vérification simple
    if (!newApp.name) {
      setError('Le nom de l\'application est requis');
      setIsLoading(false);
      return;
    }
    
    // Simuler une création d'application
    setTimeout(() => {
      const newAppData = {
        id: applications.length + 1,
        ...newApp,
        apiKeys: [
          { 
            id: Math.floor(Math.random() * 1000) + 10, 
            name: 'Production', 
            keyValue: `sk_prod_${Math.random().toString(36).substring(2, 15)}`,
            active: true,
            lastUsedAt: new Date().toISOString()
          }
        ],
        active: true,
        createdAt: new Date().toISOString()
      };
      
      setApplications(prev => [...prev, newAppData]);
      setNewApp({ name: '', description: '', contactEmail: '' });
      setShowAddForm(false);
      setSuccessMessage('Application créée avec succès');
      setIsLoading(false);
      
      // Effacer le message de succès après quelques secondes
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }, 1000);
  };
  
  // Créer une nouvelle clé API (simulation)
  const handleCreateApiKey = (appId) => {
    setIsLoading(true);
    setError(null);
    
    // Vérification simple
    if (!newKey.name) {
      setError('Le nom de la clé API est requis');
      setIsLoading(false);
      return;
    }
    
    // Simuler une création de clé API
    setTimeout(() => {
      const newKeyData = {
        id: Math.floor(Math.random() * 1000) + 100,
        ...newKey,
        keyValue: `sk_${newKey.name.toLowerCase()}_${Math.random().toString(36).substring(2, 15)}`,
        active: true,
        lastUsedAt: new Date().toISOString()
      };
      
      setApplications(prev => prev.map(app => {
        if (app.id === appId) {
          return {
            ...app,
            apiKeys: [...app.apiKeys, newKeyData]
          };
        }
        return app;
      }));
      
      setNewKey({ name: '', expiresAt: '' });
      setShowAddKeyForm(null);
      setSuccessMessage('Clé API créée avec succès');
      setIsLoading(false);
      
      // Effacer le message de succès après quelques secondes
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }, 1000);
  };
  
  // Modifier le statut d'une application (simulation)
  const toggleApplicationStatus = (appId) => {
    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        return {
          ...app,
          active: !app.active
        };
      }
      return app;
    }));
    
    setSuccessMessage('Statut de l\'application modifié');
    
    // Effacer le message de succès après quelques secondes
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };
  
  // Modifier le statut d'une clé API (simulation)
  const toggleApiKeyStatus = (appId, keyId) => {
    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        return {
          ...app,
          apiKeys: app.apiKeys.map(key => {
            if (key.id === keyId) {
              return {
                ...key,
                active: !key.active
              };
            }
            return key;
          })
        };
      }
      return app;
    }));
    
    setSuccessMessage('Statut de la clé API modifié');
    
    // Effacer le message de succès après quelques secondes
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };
  
  // Supprimer une application (simulation)
  const handleDeleteApplication = (appId) => {
    // Dans une application réelle, on demanderait confirmation
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette application ? Cette action est irréversible.')) {
      setApplications(prev => prev.filter(app => app.id !== appId));
      setSuccessMessage('Application supprimée avec succès');
      
      // Effacer le message de succès après quelques secondes
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }
  };
  
  // Supprimer une clé API (simulation)
  const handleRevokeApiKey = (appId, keyId) => {
    // Dans une application réelle, on demanderait confirmation
    if (window.confirm('Êtes-vous sûr de vouloir révoquer cette clé API ? Cette action est irréversible.')) {
      setApplications(prev => prev.map(app => {
        if (app.id === appId) {
          return {
            ...app,
            apiKeys: app.apiKeys.filter(key => key.id !== keyId)
          };
        }
        return app;
      }));
      
      setSuccessMessage('Clé API révoquée avec succès');
      
      // Effacer le message de succès après quelques secondes
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }
  };
  
  // Formatter la date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="mt-2 text-sm text-gray-500">
            Gérez les applications qui se connectent à l'API FHIRHub et leurs clés d'accès
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddForm(true)}
          className="flex items-center"
        >
          <PlusCircleIcon className="h-5 w-5 mr-2" />
          Nouvelle application
        </Button>
      </div>
      
      {/* Message de succès */}
      {successMessage && (
        <Alert variant="success" dismissible onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}
      
      {/* Formulaire d'ajout d'application */}
      {showAddForm && (
        <Card className="border border-fhir-red-100 bg-gradient-to-r from-white to-fhir-red-50">
          <Card.Header>
            <Card.Title>Nouvelle application</Card.Title>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nom de l'application *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500"
                  value={newApp.name}
                  onChange={handleNewAppChange}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500"
                  value={newApp.description}
                  onChange={handleNewAppChange}
                />
              </div>
              
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">
                  Email de contact
                </label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500"
                  value={newApp.contactEmail}
                  onChange={handleNewAppChange}
                />
              </div>
              
              {error && (
                <Alert variant="error">
                  {error}
                </Alert>
              )}
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setError(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateApplication}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    'Créer l\'application'
                  )}
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}
      
      {/* Liste des applications */}
      <div className="space-y-6">
        {applications.length === 0 ? (
          <Card className="text-center py-12">
            <Card.Body>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-fhir-red-100">
                <CogIcon className="h-8 w-8 text-fhir-red-600" />
              </div>
              <h3 className="mt-3 text-lg font-medium text-gray-900">Aucune application</h3>
              <p className="mt-2 text-sm text-gray-500">
                Vous n'avez pas encore créé d'application. Créez votre première application pour obtenir une clé API.
              </p>
              <div className="mt-6">
                <Button
                  variant="primary"
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center mx-auto"
                >
                  <PlusCircleIcon className="h-5 w-5 mr-2" />
                  Nouvelle application
                </Button>
              </div>
            </Card.Body>
          </Card>
        ) : (
          applications.map(app => (
            <Card key={app.id} className={!app.active ? 'opacity-75' : undefined}>
              <Card.Header>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <Card.Title>{app.name}</Card.Title>
                    <Badge variant={app.active ? 'success' : 'error'}>
                      {app.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleApplicationStatus(app.id)}
                      className="text-xs"
                    >
                      {app.active ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex items-center"
                      as={Link}
                      to={`/applications/${app.id}`}
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Éditer
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="text-xs flex items-center"
                      onClick={() => handleDeleteApplication(app.id)}
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </Card.Header>
              <Card.Body>
                {/* Détails de l'application */}
                <div className="text-sm text-gray-600">
                  {app.description && (
                    <p className="mb-2">{app.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <p><span className="font-medium">Email :</span> {app.contactEmail || 'Non spécifié'}</p>
                      <p><span className="font-medium">Créée le :</span> {formatDate(app.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <Link to={`/applications/${app.id}/parameters`} className="text-fhir-red-600 hover:text-fhir-red-800 font-medium">
                        Paramètres
                      </Link>
                      {' | '}
                      <Link to={`/applications/${app.id}/folders`} className="text-fhir-red-600 hover:text-fhir-red-800 font-medium">
                        Dossiers
                      </Link>
                      {' | '}
                      <Link to={`/stats?applicationId=${app.id}`} className="text-fhir-red-600 hover:text-fhir-red-800 font-medium">
                        Statistiques
                      </Link>
                    </div>
                  </div>
                </div>
                
                {/* Clés API */}
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-900">Clés API</h4>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex items-center text-xs"
                      onClick={() => setShowAddKeyForm(app.id)}
                      disabled={!app.active}
                    >
                      <KeyIcon className="h-4 w-4 mr-1" />
                      Nouvelle clé
                    </Button>
                  </div>
                  
                  {/* Formulaire d'ajout de clé API */}
                  {showAddKeyForm === app.id && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                      <h5 className="font-medium text-sm mb-3">Nouvelle clé API</h5>
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="keyName" className="block text-xs font-medium text-gray-700">
                            Nom de la clé *
                          </label>
                          <input
                            type="text"
                            id="keyName"
                            name="name"
                            placeholder="Ex: Qualification, Production, Test"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500 text-sm"
                            value={newKey.name}
                            onChange={handleNewKeyChange}
                            required
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="expiresAt" className="block text-xs font-medium text-gray-700">
                            Date d'expiration (optionnel)
                          </label>
                          <input
                            type="date"
                            id="expiresAt"
                            name="expiresAt"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-fhir-red-500 focus:ring-fhir-red-500 text-sm"
                            value={newKey.expiresAt}
                            onChange={handleNewKeyChange}
                          />
                        </div>
                        
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setShowAddKeyForm(null);
                              setError(null);
                            }}
                          >
                            Annuler
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleCreateApiKey(app.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                                Création...
                              </>
                            ) : (
                              'Créer la clé'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {app.apiKeys.length === 0 ? (
                    <div className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded-md">
                      Aucune clé API pour cette application
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Nom
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Clé
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Dernière utilisation
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Statut
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {app.apiKeys.map(key => (
                            <tr key={key.id}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {key.name}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                  <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                                    {visibleKeys[`${app.id}-${key.id}`] ? key.keyValue : '••••••••••••••••••••••'}
                                  </code>
                                  <button
                                    onClick={() => toggleKeyVisibility(app.id, key.id)}
                                    className="ml-2 text-gray-400 hover:text-gray-600"
                                  >
                                    {visibleKeys[`${app.id}-${key.id}`] ? (
                                      <EyeSlashIcon className="h-4 w-4" />
                                    ) : (
                                      <EyeIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(key.lastUsedAt)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge variant={key.active ? 'success' : 'error'}>
                                  {key.active ? 'Active' : 'Inactive'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs mr-2"
                                  onClick={() => toggleApiKeyStatus(app.id, key.id)}
                                >
                                  {key.active ? 'Désactiver' : 'Activer'}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => handleRevokeApiKey(app.id, key.id)}
                                >
                                  Révoquer
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ApplicationsPage;