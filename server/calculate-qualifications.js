const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = '0db948a6-50f1-d9f3-4579-4f8036dc3830';
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

  try {
    const response = await performHttpRequest(options);

    // Parse the response and extract the required information
    const debts = JSON.parse(response).response;
    const debtDetails = debts.map(debt => ({
      accountNumber: debt.account_number,
      companyName: debt.company_name,
      individualDebtAmount: parseFloat(debt.current_debt_amount).toFixed(2),
      debtType: debt.notes,
    }));

    const totalDebt = debtDetails.reduce((acc, debt) => {
      const allowedDebtTypes = [
        'CreditCard',
        'Unsecured',
        'CheckCreditOrLineOfCredit',
        'Automobile',
        'Collection',
        'MedicalDebt',
        'ChargeAccount',
        'Recreational',
        'NoteLoan',
        'InstallmentLoan',
      ];

      if (allowedDebtTypes.some(type => debt.debtType.includes(type))) {
        return acc + parseFloat(debt.individualDebtAmount);
      }
      return acc;
    }, 0).toFixed(2);

    console.log('Calculated total debt:', totalDebt);
    console.log('Debt details:', debtDetails);

    return {
      statusCode: 200,
      body: JSON.stringify({ totalDebt: totalDebt, debts: debtDetails }),
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

