# Tickets 2.0 - Ticket Management System

A modern, multi-tenant ticket management system built with Next.js 15, Prisma, and MySQL.

## 🚀 Features

- **Multi-tenant Architecture**: Company-based data isolation
- **Role-based Access Control**: Granular permissions system
- **Ticket Management**: Create, edit, and track service tickets
- **Client Management**: Customer database with contact information
- **Service Catalog**: Manage service offerings and pricing
- **Dashboard Analytics**: Real-time metrics and reporting
- **PDF Generation**: Invoice and ticket export functionality
- **Modern UI**: Built with Shadcn/ui and Tailwind CSS

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: MySQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI Components**: Shadcn/ui + Tailwind CSS
- **Form Handling**: React Hook Form + Zod validation
- **State Management**: React Context + Server Actions
- **Testing**: Jest + React Testing Library + Playwright

## 📋 Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd tickets2.0
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="mysql://username:password@localhost:3306/tickets_db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Optional: For production
NODE_ENV="development"
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database
npm run seed
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run end-to-end tests
npm run test:e2e
```

## 📁 Project Structure

```
src/
├── actions/          # Server actions for data operations
├── app/             # Next.js app router pages
├── components/      # Reusable UI components
├── contexts/        # React contexts for state management
├── generated/       # Prisma generated types
├── hooks/           # Custom React hooks
├── lib/             # Utility libraries and configurations
├── middleware.ts    # Next.js middleware
└── types/           # TypeScript type definitions
```

## 🔐 Authentication & Authorization

The application uses NextAuth.js with a role-based permission system:

- **System Company**: Super admin access to all companies
- **Regular Companies**: Isolated access to their own data
- **Roles & Permissions**: Granular access control per feature

## 🗄️ Database Schema

### Core Entities

- **Companies**: Multi-tenant isolation
- **Users**: Authentication and role assignment
- **Clients**: Customer information
- **Services**: Service catalog with pricing
- **Tickets**: Service requests and tracking
- **Roles & Permissions**: Access control system

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🔧 Development

### Code Style

- ESLint configuration included
- Prettier formatting
- TypeScript strict mode enabled

### Database Migrations

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (development only)
npx prisma migrate reset
```

### Adding New Features

1. Create database migration if needed
2. Add server actions in `src/actions/`
3. Create UI components in `src/components/`
4. Add pages in `src/app/`
5. Update types and validation schemas

## 🐛 Troubleshooting

### Common Issues

**Database Connection**

- Verify DATABASE_URL in `.env.local`
- Ensure MySQL server is running
- Check database permissions

**Authentication Issues**

- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your environment

**Build Errors**

- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## 📈 Performance Optimization

- **Caching**: Implemented with Next.js cache utilities
- **Database Indexing**: Optimized queries with proper indexes
- **Code Splitting**: Automatic with Next.js App Router
- **Image Optimization**: Built-in Next.js Image component

## 🔒 Security Features

- **Input Validation**: Zod schemas for all user inputs
- **SQL Injection Prevention**: Prisma ORM protection
- **XSS Protection**: Input sanitization utilities
- **CSRF Protection**: Built-in NextAuth.js protection
- **Rate Limiting**: API endpoint protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation in `/docs`
- Review the troubleshooting section above
