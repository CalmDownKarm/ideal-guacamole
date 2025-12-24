// Netlify Serverless Function to return Auth0 configuration
// This keeps Auth0 credentials in environment variables

exports.handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            },
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Get Auth0 config from environment variables
    const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
    const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;

    // Return public config (domain and client ID are safe to expose)
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        },
        body: JSON.stringify({
            domain: AUTH0_DOMAIN || '',
            clientId: AUTH0_CLIENT_ID || ''
        })
    };
};

