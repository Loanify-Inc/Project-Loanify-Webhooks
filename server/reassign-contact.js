const https = require('https');

// Function to make HTTPS requests
function performHttpRequest(options, requestBody) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Attempt to parse the JSON response
          const parsedData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject({ statusCode: res.statusCode, message: parsedData });
          }
        } catch (error) {
          reject({ statusCode: 500, message: "Failed to parse JSON response" });
        }
      });
    });

    req.on('error', (error) => {
      reject({ statusCode: 500, message: error.message });
    });

    // Write the request body and end the request
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY; // Ensure your API key is set in the Lambda environment variables
  const BASE_URL = 'api.forthcrm.com';

  // Parsing event body to retrieve dynamic values
  const body = JSON.parse(event.body);
  const contactId = body.contact_id;
  const assignedTo = body.assigned_to;

  // Validation for required fields
  if (!contactId || !assignedTo) {
    console.error('Contact ID and Assigned To are required');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Contact ID and Assigned To are required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const API_PATH = `/v1/contacts/${contactId}`;
  const requestBody = {
    "assigned_to": assignedTo
  };

  const requestOptions = {
    hostname: BASE_URL,
    path: API_PATH,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  try {
    const response = await performHttpRequest(requestOptions, requestBody);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
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




//8735070 = Kevin
//8715882 = Boomer
//8716108 = Rene
//8886206 = Alex
