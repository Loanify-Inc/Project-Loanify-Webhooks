const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY;
  const BASE_URL = 'api.forthcrm.com';
  const requestBody = JSON.parse(event.body);
  const ssn = requestBody.ssn;

  if (!ssn) {
    console.error('SSN is required');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'SSN is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const searchBody = JSON.stringify({
    field: "ssn",
    term: ssn
  });

  const options = {
    hostname: BASE_URL,
    path: '/v1/contacts/search',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  try {
    const response = await performHttpRequest(options, searchBody);

    // Parse the response
    const searchResults = JSON.parse(response);

    // Check if there are any results
    if (searchResults.response.total > 0) {
      const contactId = searchResults.response.results[0].id;

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

function performHttpRequest(options, postData) {
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

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}
