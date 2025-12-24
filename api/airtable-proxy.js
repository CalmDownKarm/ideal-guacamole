// Vercel Serverless Function to proxy Airtable API calls
// This keeps your API key secure on the server side

export default async function handler(req, res) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get Airtable credentials from environment variables
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing Airtable credentials' });
    }

    try {
        const { action, table, data, recordId, sort } = req.body;

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
                if (sort) {
                    url += `?sort[0][field]=${encodeURIComponent(sort.field)}&sort[0][direction]=${sort.direction || 'desc'}`;
                }
                options.method = 'GET';
                break;

            case 'get':
                // Get single record
                if (!recordId) {
                    return res.status(400).json({ error: 'recordId required for get action' });
                }
                url = `${baseUrl}/${recordId}`;
                options.method = 'GET';
                break;

            case 'create':
                // Create record
                if (!data || !data.fields) {
                    return res.status(400).json({ error: 'data.fields required for create action' });
                }
                url = baseUrl;
                options.method = 'POST';
                options.body = JSON.stringify(data);
                break;

            default:
                return res.status(400).json({ error: 'Invalid action. Use: list, get, or create' });
        }

        // Make request to Airtable
        const response = await fetch(url, options);
        const responseData = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: responseData.error?.message || 'Airtable API error' });
        }

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('Error in Airtable proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}

