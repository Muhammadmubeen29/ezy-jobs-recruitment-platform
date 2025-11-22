# MongoDB Migration Guide

This document outlines the changes made to migrate the server from PostgreSQL/Sequelize to MongoDB/Mongoose.

## Changes Made

### 1. Dependencies Updated
- **Removed**: `pg`, `pg-hstore`, `sequelize`, `sequelize-cli`
- **Added**: `mongoose`

### 2. Database Configuration
- Updated `config/database.js` to use MongoDB connection with Mongoose
- Added connection options for development, test, and production environments
- Added SSL support for production

### 3. Models Converted
All Sequelize models have been converted to Mongoose schemas:
- `User` - User authentication and profile management
- `Job` - Job postings
- `Application` - Job applications
- `Resume` - User resumes
- `ChatRoom` - Chat rooms for communication
- `Message` - Chat messages
- `Contract` - Interview contracts
- `Interview` - Interview scheduling
- `InterviewerRating` - Interviewer feedback
- `Transaction` - Payment transactions

### 4. Controllers Updated
- Updated `auth.controller.js` to use Mongoose syntax
- Replaced Sequelize queries with Mongoose equivalents:
  - `findOne({ where: { field: value } })` → `findOne({ field: value })`
  - `findByPk(id)` → `findById(id)`
  - `attributes: { exclude: ['field'] }` → `.select('-field')`
  - `user.dataValues` → `user.toObject()`

### 5. Migrations Removed
- Removed all Sequelize migration files (not needed for MongoDB)
- Created MongoDB seeder script for initial data

### 6. Seeder Script
- Created `seeders/mongodb-seeder.js` for populating the database
- Added `npm run seed` script to package.json

## Environment Variables

Update your `.env` file with MongoDB connection string:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/ezyjobs
# OR for MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ezyjobs

# Remove PostgreSQL variables
# DB_USERNAME=
# DB_PASSWORD=
# DB_DATABASE=
# DB_HOST=
```

## Running the Application

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   - Copy `.env.example` to `.env`
   - Update MongoDB connection string

3. **Seed the database** (optional):
   ```bash
   npm run seed
   ```

4. **Start the server**:
   ```bash
   npm run dev  # Development
   npm start    # Production
   ```

## Test Accounts

After running the seeder, you can use these test accounts:

- **Admin**: admin@ezyjobs.com / Admin@123
- **Recruiter**: recruiter@ezyjobs.com / Recruiter@123
- **Interviewer**: interviewer@ezyjobs.com / Interviewer@123
- **Candidate**: candidate@ezyjobs.com / Candidate@123

## Key Differences

### Data Types
- UUIDs → ObjectIds (MongoDB's native ID type)
- `id` field → `_id` field (MongoDB standard)
- `createdAt`/`updatedAt` → Automatic timestamps in Mongoose

### Queries
- Sequelize uses `where` clauses → Mongoose uses direct object queries
- Sequelize `attributes` → Mongoose `.select()`
- Sequelize `findByPk` → Mongoose `findById`

### Relationships
- Sequelize associations → Mongoose virtual populate
- Foreign keys → ObjectId references

## Notes

- All existing API endpoints remain the same
- Authentication and authorization logic unchanged
- Socket.io functionality preserved
- Stripe integration maintained
- Email functionality preserved

## Troubleshooting

1. **Connection Issues**: Ensure MongoDB is running and connection string is correct
2. **Schema Validation**: Check that all required fields are provided
3. **ObjectId References**: Ensure foreign key references use valid ObjectIds
4. **Indexes**: MongoDB automatically creates indexes for better performance

## Next Steps

1. Test all API endpoints
2. Verify authentication flow
3. Check payment processing
4. Test real-time features (chat, video calls)
5. Update client-side code if needed for ObjectId handling
