# Overview

FHIRHub is a sophisticated healthcare interoperability platform that converts HL7 v2.5 messages to FHIR R4 format, specifically optimized for French healthcare terminology and standards. The system provides both a standalone application and a SaaS solution with integrated AI capabilities for patient data analysis.

# System Architecture

## Frontend Architecture
- **Web-based Interface**: Static HTML/CSS/JavaScript served by Express.js
- **Modular Design**: Component-based structure with dynamic sidebar injection
- **Real-time Dashboard**: Live metrics and conversion statistics with simple charts
- **Responsive Design**: Mobile-friendly interface with French localization

## Backend Architecture
- **Node.js Express Server**: RESTful API with middleware for authentication, logging, and metrics
- **Modular Route Structure**: Organized endpoints for conversion, authentication, management, and AI services
- **Service Layer**: Dedicated services for database operations, terminology mapping, and AI provider management
- **Middleware Stack**: CORS, body parsing, authentication validation, and request logging

## Data Storage Solutions
- **Primary Database**: SQLite with better-sqlite3 for application data
- **FHIR Storage**: Integration with HAPI FHIR server (local or remote)
- **Cache Layer**: In-memory caching for conversion results and terminology mappings
- **File Storage**: Local filesystem for logs, temporary files, and terminology data

# Key Components

## Core Conversion Engine
- **HL7 Parser**: Custom parser supporting French HL7 segments and Z-segments
- **Advanced Converter**: Maps HL7 segments to FHIR R4 resources with French terminology support
- **French Terminology Adapter**: Integration with ANS (Agence du Numérique en Santé) terminologies
- **Cache-Enabled Converter**: Performance optimization with intelligent caching

## Authentication and Authorization
- **Dual Authentication**: JWT tokens for web users and API keys for applications
- **Role-Based Access**: Admin and user roles with appropriate permissions
- **Session Management**: Secure session handling with configurable expiration
- **PBKDF2 Password Hashing**: Industry-standard password security

## AI Integration
- **Multi-Provider Support**: Mistral AI, Anthropic Claude, OpenAI GPT, and Ollama
- **Unified AI Service**: Abstraction layer for consistent AI provider interaction
- **Patient Chatbot**: Contextual analysis of FHIR patient records
- **Knowledge Base**: Integrated FAQ and feature documentation for AI assistance

## HAPI FHIR Integration
- **Local HAPI Server**: Embedded HAPI FHIR server for offline deployments
- **Public Server Fallback**: Automatic fallback to public HAPI FHIR servers
- **Proxy Middleware**: CORS-enabled proxy for FHIR operations
- **Resource Management**: Full CRUD operations on FHIR resources

# Data Flow

## HL7 to FHIR Conversion Process
1. **Input Validation**: HL7 message syntax and structure validation
2. **Parsing**: Segment extraction and field mapping
3. **Terminology Mapping**: French healthcare codes and identifiers
4. **FHIR Resource Creation**: Bundle generation with proper resource relationships
5. **Validation**: FHIR R4 compliance verification
6. **Storage/Output**: Bundle storage in HAPI FHIR or direct response

## Authentication Flow
1. **Login Request**: Username/password or API key validation
2. **Token Generation**: JWT creation with role-based claims
3. **Request Validation**: Middleware verification for protected routes
4. **Session Management**: Token refresh and logout handling

## AI Processing Pipeline
1. **Provider Selection**: Active AI provider determination
2. **Context Enrichment**: Knowledge base integration for relevant information
3. **Prompt Engineering**: System and user prompt combination
4. **Response Generation**: AI provider API calls with retry logic
5. **Response Processing**: Formatting and error handling

# External Dependencies

## Required Dependencies
- **Node.js 20.x**: Runtime environment
- **Java OpenJDK 21**: Required for HAPI FHIR server
- **SQLite**: Database engine (bundled with better-sqlite3)
- **Python 3.11**: Optional for terminology processing

## AI Provider APIs
- **Mistral AI**: Default AI provider for patient analysis
- **Anthropic Claude**: Alternative AI provider
- **OpenAI GPT**: Alternative AI provider
- **Ollama**: Local AI provider option

## External Services
- **ANS Terminology Server**: French healthcare terminologies
- **Public HAPI FHIR Servers**: Fallback for FHIR operations
- **HAPI FHIR Local**: Embedded server for offline deployments

# Deployment Strategy

## Development Mode
- **Direct Node.js**: Simple npm start with environment configuration
- **Automatic Dependencies**: Script-based installation of required components
- **Hot Reload**: Development server with live reloading capabilities

## Production Deployment
- **Docker Containerization**: Multi-service deployment with docker-compose
- **SystemD Services**: Linux service integration for production servers
- **Health Monitoring**: Built-in health checks and metrics collection
- **Volume Persistence**: Data persistence across container restarts

## Scaling Considerations
- **Horizontal Scaling**: Load balancer compatible with stateless design
- **Database Migration**: SQLite to PostgreSQL for multi-instance deployments
- **Cache Distribution**: Redis integration for distributed caching
- **FHIR Server Clustering**: Multiple HAPI FHIR instances for high availability

# Changelog

Changelog:
- June 16, 2025. Initial setup

# User Preferences

Preferred communication style: Simple, everyday language.