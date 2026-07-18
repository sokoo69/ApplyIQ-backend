# ApplyIQ Backend

The Node.js/Express REST API powering ApplyIQ. It provides full user authentication, application tracking, job listing management, and AI features powered by Google's Gemini models.

## Tech Stack
- **Node.js & Express**: API Framework
- **TypeScript**: Static typing
- **MongoDB & Mongoose**: Database and ODM
- **Google Gemini SDK**: AI models for Cover Letter Generation, Match Scoring, and Interview Coaching
- **JWT (JSON Web Tokens)**: HttpOnly cookies for secure authentication
- **Passport.js**: Google OAuth integration
- **Bcrypt**: Password hashing

## Local Setup

### Prerequisites
- Node.js (v18+)
- MongoDB (local or Atlas cluster)

### Environment Variables
Create a `.env` file in the root of this project with the following variables:

```env
PORT=8000
MONGO_URI=mongodb://127.0.0.1:27017/applyiq
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GEMINI_API_KEY=your_gemini_api_key
```

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

The server will run on `http://localhost:8000`.

## Key Features
- **Auth**: `/api/v1/auth/register`, `/login`, `/google`, `/me`, `/logout`
- **Jobs**: `/api/v1/jobs` (CRUD + Admin Moderation)
- **Applications**: `/api/v1/applications`
- **AI Tools**: `/api/v1/ai/match`, `/api/v1/ai/cover-letter`, `/api/v1/ai/chat` (SSE Streaming)
- **Dashboard**: `/api/v1/dashboard/summary` (MongoDB Aggregations)
