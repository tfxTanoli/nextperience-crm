# Nextperience CRM Multi-Company System

A comprehensive Customer Relationship Management (CRM) system built with React, TypeScript, and Supabase, designed for multi-company event management businesses.

## Features

### Core CRM Functionality
- **Lead Management**: Kanban-style pipeline with drag-and-drop functionality
- **Customer Management**: Centralized customer database with reusable profiles
- **Pipeline Management**: Customizable sales stages with probabilities and colors
- **Activity Tracking**: Timeline-based activity logging and follow-ups

### Multi-Company Support
- **Business Units**: Separate business entities with isolated data
- **Role-Based Access Control**: Admin, Manager, Sales Rep, Finance Officer, Viewer roles
- **User Management**: Cross-company user access with granular permissions

### Event Management
- **Event Types**: Configurable event categories
- **Lead Tracking**: Event-specific lead information (PAX, value, date)
- **Customer Reusability**: Link multiple events to existing customers

### Quotation System
- **Template Management**: HTML-based quotation templates
- **Digital Signatures**: Built-in signature capture
- **Payment Integration**: Xendit payment gateway support
- **Public Links**: Shareable quotation links for clients

### Payment Processing
- **Multiple Gateways**: Support for various payment providers
- **Payment Verification**: Manual verification workflow
- **Partial Payments**: Support for deposits and installments
- **Check Payments**: Manual check payment processing

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Payment**: Xendit API integration
- **Authentication**: Google OAuth + Supabase Auth
- **Build Tool**: Vite
- **Deployment**: Ready for Vercel/Netlify deployment

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Google OAuth credentials (optional)
- Xendit account (for payments)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nextperience-crm
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with:
- Supabase URL and anon key
- Google OAuth credentials
- Xendit API keys

5. Run database migrations:
```bash
npm run migrate
```

6. Start the development server:
```bash
npm run dev
```

## Database Schema

The system uses a comprehensive PostgreSQL schema with:
- Companies and business units
- User roles and permissions
- Leads and pipeline stages
- Customers and events
- Quotations and templates
- Payment processing
- Audit logging

## Key Components

### Lead Management
- `LeadsKanban.tsx`: Main pipeline interface
- `LeadModal.tsx`: Lead creation/editing form
- `CustomerSelector.tsx`: Customer selection component

### Settings Management
- `PipelineSettings.tsx`: Pipeline stage configuration
- `BusinessUnitsManagement.tsx`: Multi-company setup
- `UserManager.tsx`: Role-based access control

### Quotation System
- `QuotationModal.tsx`: Quotation creation
- `TemplatesPage.tsx`: Template management
- `PaymentModal.tsx`: Payment processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is proprietary software developed for Nextperience Corporate.

## Support

For support and questions, contact the development team.