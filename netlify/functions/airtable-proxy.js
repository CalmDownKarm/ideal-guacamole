// Netlify Serverless Function to proxy Airtable API calls
// This keeps your API key secure on the server side

exports.handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
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
        const { action, table, data, recordId, sort, filter } = JSON.parse(event.body);

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

