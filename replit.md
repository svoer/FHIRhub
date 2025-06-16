# FHIRHub

## Overview

FHIRHub is a comprehensive healthcare interoperability platform designed for converting HL7 v2.5 messages to FHIR R4 format. The application specializes in French healthcare standards and terminologies, providing seamless integration with HAPI FHIR servers. It features a web-based interface, API management, user authentication, and intelligent caching mechanisms.

## System Architecture

### Backend Architecture
- **Runtime**: Node.js application with Express.js framework
- **Database**: SQLite for data persistence (better-sqlite3 package)
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **API Design**: RESTful APIs with Swagger documentation
- **Middleware**: CORS, body-parser, morgan for logging, helmet for security

### Frontend Architecture
- **Technology**: Static HTML/CSS/JavaScript with React components
- **UI Components**: React-based interface with icons from react-icons
- **Visualization**: ReactFlow for workflow diagrams, Dagre for graph layouts
- **State Management**: Zustand for client-side state management

### Data Storage Solutions
- **Primary Database**: SQLite database stored in `./storage/db/fhirhub.db`
- **File Storage**: Organized directory structure under `/storage` for data, cache, and configuration
- **Caching**: Intelligent conversion caching to improve performance
- **Backup Strategy**: Configurable backup directory structure

## Key Components

### Core Conversion Engine
- **HL7 Parser**: Supports French HL7 v2.5 message parsing with Z-segments
- **FHIR Converter**: Converts to FHIR R4 bundles with French terminology support
- **Terminology Service**: Integration with French healthcare terminologies (ASIP-SANTÉ)
- **Cache System**: Reduces conversion times through intelligent caching

### User Management
- **Role-based Access Control**: Administrator and regular user roles
- **Session Management**: Secure session handling with configurable secrets
- **Password Security**: PBKDF2 with salt for password hashing

### API Management
- **API Key Authentication**: Secure API access with key management
- **Application Registration**: Client application management system
- **Rate Limiting**: Built-in request queuing to prevent server overload
- **Auto-push Features**: Automatic FHIR bundle submission to configured servers

### AI Integration
- **Multiple Providers**: Support for Mistral AI, Ollama, and OpenAI
- **Knowledge Base**: Integrated chatbot with FAQ and documentation
- **Provider Management**: Configurable AI provider settings with failover

### FHIR Server Integration
- **HAPI FHIR Compatibility**: Full integration with HAPI FHIR servers
- **Multi-server Support**: Configuration for local and remote FHIR servers
- **Validation**: FHIR resource validation before submission
- **Status Monitoring**: Real-time server health checking

## Data Flow

1. **HL7 Message Input**: Messages received via API or web interface
2. **Parsing**: HL7 messages parsed with French-specific handling
3. **Conversion**: Transformation to FHIR R4 bundles with terminology mapping
4. **Validation**: FHIR resource validation and cleaning
5. **Storage**: Conversion logs and results stored in SQLite
6. **Delivery**: FHIR bundles pushed to configured HAPI servers
7. **Monitoring**: Metrics collection for Prometheus/Grafana integration

## External Dependencies

### Required Node.js Packages
- **Web Framework**: express, cors, body-parser, morgan, helmet
- **Database**: better-sqlite3, sqlite3
- **Authentication**: bcrypt, jsonwebtoken
- **HL7/FHIR**: fhir, fhir.js, hl7-parser, hl7-standard, simple-hl7
- **AI Services**: @mistralai/mistralai, @anthropic-ai/sdk, openai
- **Utilities**: uuid, axios, archiver, multer, marked, cheerio

### Optional Integrations
- **HAPI FHIR Server**: Configurable external or local server
- **Monitoring**: Prometheus metrics export capability
- **Documentation**: Swagger UI for API documentation

## Deployment Strategy

### Environment Configuration
- **Production Ready**: Configured via environment variables in `.env`
- **Database Path**: Configurable SQLite database location
- **Security**: Session secrets and API keys via environment
- **Logging**: Configurable log levels and retention policies

### Server Requirements
- **Node.js**: Version 20+ (configured in .replit)
- **Java**: OpenJDK 17/21 for HAPI FHIR server (optional)
- **Python**: 3.11+ for HL7 parsing utilities
- **Memory**: Minimum 512MB recommended for full stack

### Deployment Options
- **Standalone**: Single Node.js application
- **With HAPI FHIR**: Full stack with local HAPI server
- **Container Ready**: Directory structure supports containerization
- **Replit Compatible**: Configured for Replit deployment

## Changelog

Changelog:
- June 16, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.