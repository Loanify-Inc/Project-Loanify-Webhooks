const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY;
  const BASE_URL = 'api.forthcrm.com';
  const requestBody = JSON.parse(event.body);
  const phone = requestBody.phone;

  if (!phone) {
    console.error('Phone number is required');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Phone number is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const options = {
    hostname: BASE_URL,
    path: `/v1/contacts/search_by_phone/${phone}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  try {
    const response = await performHttpRequest(options);
    const searchResults = JSON.parse(response);

    if (searchResults.response && searchResults.response.length > 0) {
      const contactId = searchResults.response[0].id;

      return {
        statusCode: 200,
        body: JSON.stringify({ id: contactId }),
        headers: { 'Access-Control-Allow-Origin': '*' },
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No contacts found' }),
        headers: { 'Access-Control-Allow-Origin': '*' },
      };
    }
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }
};

function performHttpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject({ statusCode: res.statusCode, message: data });
        }
      });
    });

    req.on('error', (error) => {
      reject({ statusCode: 500, message: error.message });
    });

    req.end();
  });
}
