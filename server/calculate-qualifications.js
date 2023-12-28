const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = '0db948a6-50f1-d9f3-4579-4f8036dc3830';
  const BASE_URL = 'api.forthcrm.com';
  const contactId = JSON.parse(event.body).contact_id;

  console.log('Received request with contact_id:', contactId);

  if (!contactId) {
    console.error('Contact ID is required');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Contact ID is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const API_PATH = `/v1/contacts/${contactId}/debts/enrolled`;
  const options = {
    hostname: BASE_URL,
    path: API_PATH,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  console.log('Making GET request to:', API_PATH);

  try {
    const response = await performHttpRequest(options);
    console.log('Response:', response);

    // Process the response to calculate the total debt amount for credit card or unsecured debts
    const debts = JSON.parse(response).response;
    const totalDebt = debts.reduce((acc, debt) => {
      if (debt.notes.includes('CreditCard') || debt.notes.includes('Unsecured')) {
        return acc + parseFloat(debt.current_debt_amount);
      }
      return acc;
    }, 0);

    console.log('Calculated total debt:', totalDebt);

    return {
      statusCode: 200,
      body: JSON.stringify({ totalDebt: totalDebt.toFixed(2) }),
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
