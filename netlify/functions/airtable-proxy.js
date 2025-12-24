// Netlify Serverless Function to proxy Airtable API calls
// This keeps your API key secure on the server side

exports.handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Get Airtable credentials from environment variables
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing Airtable credentials' })
        };
    }

    try {
        // Get Auth0 token from Authorization header
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const authToken = authHeader ? authHeader.replace('Bearer ', '') : null;
        
        const { action, table, data, recordId, sort, filter } = JSON.parse(event.body);
        
        // Require authentication for create action
        if (action === 'create') {
            if (!authToken) {
                return {
                    statusCode: 401,
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Unauthorized: No authentication token provided' })
                };
            }
            
            // Verify Auth0 token
            const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
            if (!AUTH0_DOMAIN) {
                return {
                    statusCode: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Server configuration error: AUTH0_DOMAIN not set' })
                };
            }
            
            // Verify JWT token with Auth0
            try {
                const jwt = require('jsonwebtoken');
                const jwksClient = require('jwks-rsa');
                
                const client = jwksClient({
                    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
                });
                
                // Decode token to get kid
                const decodedToken = jwt.decode(authToken, { complete: true });
                if (!decodedToken || !decodedToken.header || !decodedToken.header.kid) {
                    throw new Error('Invalid token format');
                }
                
                // Get signing key
                const key = await new Promise((resolve, reject) => {
                    client.getSigningKey(decodedToken.header.kid, (err, signingKey) => {
                        if (err) reject(err);
                        else resolve(signingKey.publicKey || signingKey.rsaPublicKey);
                    });
                });
                
                // Verify token
                const decoded = jwt.verify(authToken, key, {
                    audience: process.env.AUTH0_AUDIENCE || `https://${AUTH0_DOMAIN}/api/v2/`,
                    issuer: `https://${AUTH0_DOMAIN}/`,
                    algorithms: ['RS256']
                });
                
                // Token is valid, continue
            } catch (jwtError) {
                console.error('JWT verification error:', jwtError);
                return {
                    statusCode: 401,
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Unauthorized: Invalid or expired token' })
                };
            }
        }

        let url;
        let options = {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        // Build the Airtable API URL
        const tableName = encodeURIComponent(table);
        const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`;

        switch (action) {
            case 'list':
                // List records
                url = baseUrl;
                const queryParams = [];
                if (filter) {
                    queryParams.push(`filterByFormula=${encodeURIComponent(filter)}`);
                }
                if (sort) {
                    queryParams.push(`sort[0][field]=${encodeURIComponent(sort.field)}&sort[0][direction]=${sort.direction || 'desc'}`);
                }
                if (queryParams.length > 0) {
                    url += '?' + queryParams.join('&');
                }
                options.method = 'GET';
                break;

            case 'get':
                // Get single record
                if (!recordId) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'recordId required for get action' })
                    };
                }
                url = `${baseUrl}/${recordId}`;
                options.method = 'GET';
                break;

            case 'create':
                // Create record
                if (!data || !data.fields) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'data.fields required for create action' })
                    };
                }
                url = baseUrl;
                options.method = 'POST';
                options.body = JSON.stringify(data);
                break;

            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid action. Use: list, get, or create' })
                };
        }

        // Make request to Airtable
        const response = await fetch(url, options);
        const responseData = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: responseData.error?.message || 'Airtable API error' })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('Error in Airtable proxy:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

