# FHIRHub - HL7 to FHIR Converter Platform

## Overview

FHIRHub is a sophisticated HL7 v2.5 to FHIR R4 conversion platform specifically designed for French healthcare interoperability. The platform integrates French terminologies (ANS/MOS) and provides comprehensive conversion capabilities with AI-powered analysis features.

## System Architecture

### Overall Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     FHIRHub Platform                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Frontend      │   Backend API   │   External Services     │
│   (Web UI)      │   (Node.js)     │   (HAPI FHIR, AI)      │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Technology Stack
- **Backend**: Node.js 20.x with Express.js framework
- **Database**: SQLite with better-sqlite3 for local storage
- **Frontend**: Vanilla JavaScript with modular CSS architecture
- **FHIR Server**: HAPI FHIR (local or external integration)
- **AI Integration**: Multiple providers (Mistral AI, OpenAI, Anthropic Claude, Ollama)
- **Containerization**: Docker with multi-service orchestration

## Key Components

### 1. Backend Services
- **Core Application** (`app.js`): Main Express application with middleware configuration
- **HL7 Parser** (`hl7Parser.js`): Advanced HL7 v2.5 message parser with French segment support
- **FHIR Converter** (`hl7ToFhirAdvancedConverter.js`): Comprehensive HL7 to FHIR R4 conversion engine
- **French Terminology Adapter** (`french_terminology_adapter.js`): ANS terminology integration
- **Database Service**: SQLite-based data persistence with schema management
- **AI Service** (`utils/aiService.js`): Unified AI provider management

### 2. API Layer
- **Authentication APIs**: JWT-based authentication with API key support
- **Conversion APIs**: HL7 to FHIR conversion endpoints with validation
- **Management APIs**: Application, user, and API key management
- **System APIs**: Health checks, metrics, and system information
- **AI APIs**: Chatbot integration and analysis features

### 3. Frontend Interface
- **Modular Architecture**: Component-based structure with dynamic sidebar inclusion
- **Real-time Metrics**: Live conversion statistics and system monitoring
- **Responsive Design**: Mobile and desktop compatibility
- **French Localization**: Native French language interface

### 4. External Integrations
- **HAPI FHIR Server**: Local or cloud-based FHIR server integration
- **AI Providers**: Multi-provider AI integration (Mistral, OpenAI, Claude, Ollama)
- **French Terminologies**: ANS/MOS terminology systems integration

## Data Flow

### 1. HL7 Message Processing
```
HL7 Message Input → Parser → Validation → Conversion → FHIR Bundle → Storage/Export
```

### 2. Authentication Flow
```
User Login → JWT Generation → API Access → Session Management → Logout
```

### 3. AI Analysis Flow
```
FHIR Data → AI Service → Provider Selection → Analysis → Response Formatting
```

## External Dependencies

### Core Dependencies
- **Express.js**: Web application framework
- **better-sqlite3**: High-performance SQLite database driver
- **axios**: HTTP client for external API calls
- **cors**: Cross-origin resource sharing middleware
- **jsonwebtoken**: JWT authentication implementation
- **uuid**: Unique identifier generation

### AI Dependencies
- **@mistralai/mistralai**: Mistral AI integration
- **openai**: OpenAI GPT integration
- **@anthropic-ai/sdk**: Anthropic Claude integration

### FHIR Dependencies
- **fhir**: FHIR resource validation and manipulation
- **http-proxy-middleware**: FHIR server proxy functionality

### Development Dependencies
- **swagger-jsdoc**: API documentation generation
- **swagger-ui-express**: Interactive API documentation
- **morgan**: HTTP request logging

## Deployment Strategy

### 1. Development Mode
- Single Node.js process on port 5000
- SQLite database in `./storage/db/`
- Local HAPI FHIR server (optional)
- Environment: `NODE_ENV=development`

### 2. Production Mode
- Docker containerized deployment
- Multi-service architecture with docker-compose
- Persistent volumes for data storage
- Health checks and restart policies
- Environment: `NODE_ENV=production`

### 3. Hospital Mode (Offline)
- Standalone deployment with local HAPI FHIR
- French terminology caching
- Local AI provider support (Ollama)
- Complete offline operation capability

## Changelog

- June 16, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.