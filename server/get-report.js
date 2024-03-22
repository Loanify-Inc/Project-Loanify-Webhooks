const https = require('https');
const AWS = require('aws-sdk');

// Update AWS SDK configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEYID,
  secretAccessKey: process.env.AWS_SECRET_ACCESSKEY,
  region: process.env.AWS_REGIONID,
});

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
  try {
    const API_KEY = process.env.API_KEY;
    const BASE_URL = 'api.forthcrm.com';
    const contactId = JSON.parse(event.body).contact_id;

    if (!contactId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Contact ID is required' }),
      };
    }

    // Fetch debts in parallel
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
        individualDebtAmount: parseFloat(debt.current_debt_amount).toFixed(2),
        debtType: allowedDebtTypes.find(type => debt.notes.includes(type))
      }));

    // Return the response with debtDetails
    return {
      statusCode: 200,
      body: JSON.stringify({ debtDetails }),
    };

  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
