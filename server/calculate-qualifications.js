const axios = require('axios');

exports.handler = async (event, context) => {
  const API_KEY = '0db948a6-50f1-d9f3-4579-4f8036dc3830';
  const BASE_URL = 'https://api.forthcrm.com/v1/contacts';

  // Extract the contact ID from the incoming request body
  const body = JSON.parse(event.body);
  const contactId = body.contact_id; // Ensure 'contact_id' matches the key in the incoming request

  console.log('Received request with contact_id:', contactId); // Added console log

  if (!contactId) {
    console.error('Contact ID is required'); // Added console error
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Contact ID is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const API_URL = `${BASE_URL}/${contactId}/debts/enrolled`;
  console.log('API URL:', API_URL); // Added console log

  /*try {
    console.log('Making GET request to:', API_URL); // Added console log
    const response = await axios({
      method: 'get',
      url: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY,
      },
    });

    console.log('Response:', response); // Added console log

    // Process the response to calculate the total debt amount for credit card or unsecured debts
    const debts = response.data.response;
    const totalDebt = debts.reduce((acc, debt) => {
      if (debt.notes.includes('CreditCard') || debt.notes.includes('Unsecured')) {
        return acc + parseFloat(debt.current_debt_amount);
      }
      return acc;
    }, 0);

    console.log('Calculated total debt:', totalDebt); // Added console log

    // Return the calculated total debt
    return {
      statusCode: 200,
      body: JSON.stringify({ totalDebt: totalDebt.toFixed(2) }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  } catch (error) {
    // Handle axios errors
    console.error('Error:', error.message); // Added console error
    return {
      statusCode: error.response ? error.response.status : 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }*/

  return {
    statusCode: 200,
    body: JSON.stringify({ totalDebt: "This worked" }),
    headers: { 'Access-Control-Allow-Origin': '*' },
  };
};
