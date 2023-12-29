const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = '0db948a6-50f1-d9f3-4579-4f8036dc3830';
  const BASE_URL = 'api.forthcrm.com';
  const API_PATH = '/v1/contacts';

  // Parse the incoming request body to extract contact data
  const body = JSON.parse(event.body);

  // Construct the request body for the Forth API call using the extracted data
  const forthRequestBody = {
    assigned_to: body.assigned_to,
    first_name: body.first_name,
    last_name: body.last_name,
    campaign_id: body.campaign_id,
    attorney_id: body.attorney_id,
    phone_number: body.phone_number,
    address: {
      address1: body.address.address1,
      address2: body.address.address2 || '', // Make address2 optional
      address3: body.address.address3 || '', // Make address3 optional
      city: body.address.city,
      state: body.address.state,
      zip: body.address.zip,
    },
    email: body.email,
    social_security_number: body.social_security_number,
    date_of_birth: body.date_of_birth,
    statusID: body.statusID,
    stageID: body.stageID,
    stage_label: body.stage_label,
    status_label: body.status_label,
  };

  const requestOptions = {
    hostname: BASE_URL,
    path: API_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  try {
    const response = await performHttpRequest(requestOptions, forthRequestBody);
    console.log('API Response:', response);

    // Handle the API response as needed

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'API call to Forth successful', response }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  } catch (error) {
    console.error('Error:', error.message);

    // Check if the error is in the expected format (Forth's response)
    if (error.status && error.status.code && error.status.message) {
      // Extract the error message from the error object
      const errorMessage = error.status.message;

      // Format the error message as needed
      const formattedErrorMessage = {
        error: errorMessage,
      };

      return {
        statusCode: error.status.code,
        body: JSON.stringify(formattedErrorMessage),
        headers: { 'Access-Control-Allow-Origin': '*' },
      };
    } else {
      // If the error is not in the expected format, return a generic error message
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'An unexpected error occurred' }),
        headers: { 'Access-Control-Allow-Origin': '*' },
      };
    }
  }
};

function performHttpRequest(options, requestBody) {
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

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}


