const https = require('https');

exports.handler = async (event, context) => {
  try {
    const API_KEY = process.env.API_KEY;
    const BASE_URL = 'api.forthcrm.com';
    const requestBody = JSON.parse(event.body);
    const contactId = requestBody.contact_id;

    if (!contactId) {
      console.error('Contact ID is required');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Contact ID is required' }),
        headers: { 'Access-Control-Allow-Origin': '*' },
      };
    }

    const options = {
      hostname: BASE_URL,
      path: `/v1/contacts/${contactId}`, // Modified to use the contact ID in the path
      method: 'GET', // Changed to GET request
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY,
      },
    };

    const response = await performHttpRequest(options);
    const contactInfo = JSON.parse(response).response;

    // Extracting required fields
    const fullName = `${contactInfo.first_name} ${contactInfo.last_name}`;
    const result = {
      id: contactInfo.id,
      fullName,
      firstName: contactInfo.first_name,
      lastName: contactInfo.last_name,
      email: contactInfo.email,
      phoneNumber: contactInfo.phone_number,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
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
      res.on('data', (chunk) => data += chunk);
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

    req.end(); // No postData is needed for a GET request
  });
}

