const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY;
  const BASE_URL = 'api.forthcrm.com';
  const contactId = JSON.parse(event.body).contact_id;

  if (!contactId) {
    console.error('Contact ID is required');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Contact ID is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const API_PATH = `/v1/contacts/${contactId}/pull_credit/Xactus360`;
  const options = {
    hostname: BASE_URL,
    path: API_PATH,
    method: 'POST', // Changed to POST
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  try {
    const response = await performHttpRequest(options);

    // Parse the response and extract the required information
    const creditInfo = JSON.parse(response);

    // Here, you can process the creditInfo as needed

    return {
      statusCode: 200,
      body: JSON.stringify(creditInfo),
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
