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
                console.error('No auth token provided in Authorization header');
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
                
                // Check if token is a JWT (should have 3 parts separated by dots)
                const tokenParts = authToken.split('.');
                if (tokenParts.length !== 3) {
                    console.error('Token is not a JWT (opaque token) - length:', tokenParts.length);
                    return {
                        statusCode: 401,
                        headers: {
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({ 
                            error: 'Unauthorized: Token is not a JWT. For Auth0 SPAs, you need to use an ID token or configure a custom API to get JWT access tokens.' 
                        })
                    };
                }
                
                const client = jwksClient({
                    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
                });
                
                // Decode token to get kid and check structure
                const decodedToken = jwt.decode(authToken, { complete: true });
                if (!decodedToken || !decodedToken.header || !decodedToken.header.kid) {
                    console.error('Invalid token format - missing kid');
                    throw new Error('Invalid token format');
                }
                
                // Get signing key
                const key = await new Promise((resolve, reject) => {
                    client.getSigningKey(decodedToken.header.kid, (err, signingKey) => {
                        if (err) {
                            console.error('Error getting signing key:', err);
                            reject(err);
                        } else {
                            resolve(signingKey.publicKey || signingKey.rsaPublicKey);
                        }
                    });
                });
                
                // Decode token first to see what's in it
                const decodedPreview = jwt.decode(authToken);
                const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
                const issuer = `https://${AUTH0_DOMAIN}/`;
                
                console.log('Token preview:', {
                    aud: decodedPreview?.aud,
                    iss: decodedPreview?.iss,
                    exp: decodedPreview?.exp,
                    email: decodedPreview?.email
                });
                
                // For SPAs, access tokens might not have strict audience requirements
                // Try verification with different audience options
                let decoded;
                let verifyError = null;
                
                // First, try with AUTH0_AUDIENCE if set
                if (process.env.AUTH0_AUDIENCE) {
                    try {
                        decoded = jwt.verify(authToken, key, {
                            audience: process.env.AUTH0_AUDIENCE,
                            issuer: issuer,
                            algorithms: ['RS256']
                        });
                        console.log('Token verified with AUTH0_AUDIENCE');
                    } catch (e) {
                        verifyError = e;
                        console.log('Failed with AUTH0_AUDIENCE, trying Client ID');
                    }
                }
                
                // If that failed, try with Client ID (common for SPAs)
                if (!decoded && AUTH0_CLIENT_ID) {
                    try {
                        decoded = jwt.verify(authToken, key, {
                            audience: AUTH0_CLIENT_ID,
                            issuer: issuer,
                            algorithms: ['RS256']
                        });
                        console.log('Token verified with Client ID');
                    } catch (e) {
                        verifyError = e;
                        console.log('Failed with Client ID, trying without audience validation');
                    }
                }
                
                // If still failed, try without audience validation (some SPAs don't require it)
                if (!decoded) {
                    try {
                        decoded = jwt.verify(authToken, key, {
                            issuer: issuer,
                            algorithms: ['RS256']
                        });
                        console.log('Token verified without audience validation');
                    } catch (e) {
                        verifyError = e;
                        throw verifyError || e; // Throw the last error
                    }
                }
                
                console.log('Token verified successfully for:', decoded.email || decoded.sub);
                console.log('All token claims:', JSON.stringify(decoded, null, 2));
                
                // Extract email from token - check multiple possible locations
                // Auth0 ID tokens typically have email at root level
                // But it might also be in custom claims or nested objects
                let userEmail = decoded.email;
                
                // Check for email in common alternative locations
                if (!userEmail) {
                    // Check for custom namespace claims (Auth0 custom rules)
                    for (const key of Object.keys(decoded)) {
                        if (key.includes('/email') || key.endsWith('email')) {
                            userEmail = decoded[key];
                            console.log('Found email in custom claim:', key);
                            break;
                        }
                    }
                }
                
                // If still no email, check if there's a name or nickname we can use temporarily
                // But really, we need the email
                if (!userEmail) {
                    console.error('No email found in token. Available claims:', Object.keys(decoded));
                    return {
                        statusCode: 401,
                        headers: {
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({ 
                            error: 'Unauthorized: Email not found in token. Please log out and log back in, or check Auth0 settings.',
                            availableClaims: Object.keys(decoded)
                        })
                    };
                }
                
                // Check email whitelist in Airtable
                const ALLOWED_USERS_TABLE = process.env.ALLOWED_USERS_TABLE || 'Allowed Users';
                try {
                    const userEmailLower = userEmail.toLowerCase();
                    const whitelistUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(ALLOWED_USERS_TABLE)}?filterByFormula=${encodeURIComponent(`{Email} = "${userEmailLower}"`)}`;
                    
                    const whitelistResponse = await fetch(whitelistUrl, {
                        headers: {
                            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!whitelistResponse.ok) {
                        console.error('Error checking whitelist:', await whitelistResponse.text());
                        // If table doesn't exist, allow access (fail open for easier setup)
                        // Remove this if you want strict enforcement
                    } else {
                        const whitelistData = await whitelistResponse.json();
                        if (!whitelistData.records || whitelistData.records.length === 0) {
                            return {
                                statusCode: 403,
                                headers: {
                                    'Access-Control-Allow-Origin': '*'
                                },
                                body: JSON.stringify({ error: 'Forbidden: Your email is not authorized to create brews' })
                            };
                        }
                    }
                } catch (whitelistError) {
                    console.error('Error checking email whitelist:', whitelistError);
                    // Fail open - allow access if whitelist check fails
                    // Change this to fail closed if you want strict enforcement
                }
                
                // Token is valid and email is whitelisted, continue
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
                    queryParams.push(`sort[0][field]=${encodeURIComponent(sort.field)}`);
                    queryParams.push(`sort[0][direction]=${sort.direction || 'desc'}`);
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
        let responseData;
        try {
            responseData = await response.json();
        } catch (e) {
            // If response isn't JSON, create error message
            const text = await response.text();
            return {
                statusCode: response.status,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: `Airtable API error: ${text || response.statusText}` })
            };
        }

        if (!response.ok) {
            return {
                statusCode: response.status,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: responseData.error?.message || responseData.error || 'Airtable API error',
                    details: responseData
                })
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

