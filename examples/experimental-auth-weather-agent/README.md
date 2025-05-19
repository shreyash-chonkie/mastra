# Authentication Example for Mastra

This example demonstrates how to integrate Mastra with various authentication providers.

## Supported Authentication Providers

- Supabase
- Firebase
- WorkOS
- Composio
- Supertokens
- Arcade

## Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Configure your environment variables (see below)
4. Run the example: `pnpm run dev`

## Environment Variables

Create a `.env` file in the root of this example with the following variables:

```env
# Select the auth provider (supabase, firebase, workos, composio, supertokens)
AUTH_PROVIDER=supabase

# Supabase Configuration
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Firebase Configuration
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# WorkOS Configuration
WORKOS_API_KEY=
WORKOS_CLIENT_ID=

# Composio Configuration
COMPOSIO_API_KEY=

# Supertokens Configuration
SUPERTOKENS_CONNECTION_URI=
SUPERTOKENS_API_KEY=
```

## Provider-Specific Setup

### Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Create a 'users' table with an 'isAdmin' boolean column
3. Get your Supabase URL and anon key from your project settings

### Firebase

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Generate a new private key in Project settings > Service accounts
3. Set up custom claims for admin users using Firebase Admin SDK

### WorkOS

1. Create a WorkOS account at [workos.com](https://workos.com)
2. Set up your organization and get your API key
3. Configure your directory sync or SSO connection

### Composio

1. Sign up for Composio and get your API credentials
2. Follow Composio's documentation to set up authentication

### Supertokens

1. Set up Supertokens following their [documentation](https://supertokens.com/docs/guides)
2. Configure your app to use Supertokens for session management

## Usage

This example provides a weather agent that requires authentication. The agent will only respond to authorized users based on their role/permissions.

To test the authentication:

1. Get an authentication token from your chosen provider
2. Make a request to the API with the token in the Authorization header
3. The server will validate your token and check your permissions before processing the request
