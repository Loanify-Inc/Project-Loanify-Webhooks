const https = require('https');

// Function to perform HTTPS requests
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

exports.handler = async (event) => {
  // Handling OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*', // You can specify domains if you want to restrict it
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Add other methods as needed
        'Access-Control-Allow-Headers': 'Content-Type, API-Key', // Ensure you include any custom headers your requests use
      },
    };
  }

  try {
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

    // Fetch debts
    const debtResponse = await performHttpRequest({
      hostname: BASE_URL,
      path: `/v1/contacts/${contactId}/debts/enrolled`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY,
      },
    });

    // Process debts
    const debts = JSON.parse(debtResponse).response;
    const allowedDebtTypes = [
      'CreditCard', 'Unsecured', 'CheckCreditOrLineOfCredit', 'Collection',
      'MedicalDebt', 'ChargeAccount', 'Recreational', 'NoteLoan', 'InstallmentLoan',
    ];

    const debtDetails = debts
      .filter(debt => parseFloat(debt.current_debt_amount) >= 500 &&
        allowedDebtTypes.some(type => debt.notes.includes(type)))
      .map(debt => ({
        accountNumber: debt.og_account_num,
        companyName: debt.creditor.company_name,
        individualDebtAmount: parseFloat(debt.current_debt_amount),
        debtType: allowedDebtTypes.find(type => debt.notes.includes(type))
      }));

    const totalDebt = debtDetails
      .reduce((acc, debt) => acc + debt.individualDebtAmount, 0);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        totalDebt: totalDebt,
        debts: debtDetails,
      }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };

  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }
};



